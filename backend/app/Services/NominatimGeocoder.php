<?php

namespace App\Services;

use App\Support\DakarBounds;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Géocodage via Nominatim (OpenStreetMap), limité au périmètre de Dakar.
 *
 * - search()      : adresse structurée (champs du formulaire) → positions candidates.
 * - searchText()  : texte libre saisi dans la barre de recherche de la carte.
 * - reverse()     : position du repère sur la carte → adresse lisible.
 *
 * Toutes les réponses sont mises en cache et les appels espacés d'au moins
 * une seconde, conformément à la politique d'usage de Nominatim.
 */
class NominatimGeocoder
{
    public function search(
        string $adresse,
        string $quartier,
        string $ville,
        ?string $complement = null,
        ?string $commune = null,
    ): array {
        $query = implode(', ', array_filter([$adresse, $quartier, $commune, $ville, $complement]));
        $fallbackQuery = $commune ? implode(', ', array_filter([$quartier, $commune, $ville])) : null;

        return $this->lookup($query, $fallbackQuery);
    }

    public function searchText(string $text): array
    {
        $text = trim($text);
        $query = str_contains(mb_strtolower($text), 'dakar') ? $text : $text.', Dakar';

        return $this->lookup($query, null);
    }

    /**
     * @return array{latitude: float, longitude: float, display_name: ?string, adresse: ?string, quartier: ?string, commune: ?string, ville: string}
     */
    public function reverse(float $latitude, float $longitude): array
    {
        $cacheKey = sprintf('nominatim:reverse:%.5f,%.5f', $latitude, $longitude);

        return Cache::remember($cacheKey, now()->addMinutes(config('geocoding.cache_minutes')), function () use ($latitude, $longitude): array {
            $response = $this->client()->get($this->endpoint('reverse'), array_filter([
                'lat' => $latitude,
                'lon' => $longitude,
                'format' => 'jsonv2',
                'addressdetails' => 1,
                'zoom' => 18,
                'email' => config('geocoding.email'),
            ]));

            $this->ensureAvailable($response);

            $payload = $response->json() ?? [];

            // Nominatim répond 200 avec une clé "error" quand il n'y a rien à cet endroit (mer, etc.).
            if (isset($payload['error'])) {
                return $this->describe(['lat' => $latitude, 'lon' => $longitude]);
            }

            return $this->describe($payload + ['lat' => $latitude, 'lon' => $longitude]);
        });
    }

    private function lookup(string $query, ?string $fallbackQuery): array
    {
        $cacheKey = 'nominatim:'.sha1(mb_strtolower($query));

        return Cache::remember($cacheKey, now()->addMinutes(config('geocoding.cache_minutes')), function () use ($query, $fallbackQuery): array {
            $response = $this->searchRequest($query);
            $this->ensureAvailable($response);

            if ($response->json() === [] && $fallbackQuery) {
                $response = $this->searchRequest($fallbackQuery);
                $this->ensureAvailable($response);
            }

            $results = collect($response->json())
                ->filter(fn (array $result): bool => isset($result['lat'], $result['lon']))
                ->map(fn (array $result): array => $this->describe($result, $query))
                ->filter(fn (array $result): bool => DakarBounds::contains($result['latitude'], $result['longitude']))
                ->values()
                ->all();

            if ($results === []) {
                throw new RuntimeException('Adresse introuvable dans le périmètre de Dakar.');
            }

            return $results;
        });
    }

    private function searchRequest(string $query): Response
    {
        return $this->client()->get($this->endpoint('search'), array_filter([
            'q' => $query,
            'format' => 'jsonv2',
            'addressdetails' => 1,
            'limit' => 5,
            'countrycodes' => 'sn',
            'bounded' => 1,
            'viewbox' => $this->viewbox(),
            'email' => config('geocoding.email'),
        ]));
    }

    /**
     * Transforme un résultat Nominatim en champs directement utilisables par le formulaire terrain.
     */
    private function describe(array $result, ?string $fallbackLabel = null): array
    {
        $address = $result['address'] ?? [];
        $street = trim(implode(' ', array_filter([
            $address['house_number'] ?? null,
            $address['road'] ?? $address['pedestrian'] ?? $address['footway'] ?? $address['square'] ?? null,
        ])));
        $placeName = ($result['name'] ?? '') !== '' ? $result['name'] : null;

        return [
            'latitude' => (float) $result['lat'],
            'longitude' => (float) $result['lon'],
            'display_name' => $result['display_name'] ?? $fallbackLabel,
            'adresse' => $street !== '' ? $street : $placeName,
            'quartier' => $this->withoutAdministrativePrefix(
                $address['neighbourhood'] ?? $address['quarter'] ?? $address['hamlet'] ?? $address['suburb'] ?? null
            ),
            'commune' => $this->withoutAdministrativePrefix(
                $address['commune'] ?? $address['suburb'] ?? $address['city_district'] ?? null
            ),
            'ville' => 'Dakar',
            'address' => $address,
        ];
    }

    /** « Commune de Médina » → « Médina », « Arrondissement des Almadies » → « Almadies ». */
    private function withoutAdministrativePrefix(?string $name): ?string
    {
        if ($name === null || trim($name) === '') {
            return null;
        }

        return trim(preg_replace(
            '/^(commune|arrondissement|quartier)\s+(de\s+la\s+|de\s+l[\'’]|des\s+|du\s+|de\s+|d[\'’])?/iu',
            '',
            $name
        ));
    }

    private function endpoint(string $operation): string
    {
        $searchUrl = config('geocoding.nominatim_url');

        return $operation === 'reverse'
            ? preg_replace('#/search/?$#', '/reverse', $searchUrl)
            : $searchUrl;
    }

    private function client(): PendingRequest
    {
        $lock = Cache::lock('nominatim:request', 2);

        try {
            $lock->block(5);
            $lastRequestAt = (float) Cache::get('nominatim:last-request-at', 0);
            $waitMicroseconds = 1_000_000 - (int) ((microtime(true) - $lastRequestAt) * 1_000_000);

            if ($waitMicroseconds > 0) {
                usleep($waitMicroseconds);
            }

            Cache::put('nominatim:last-request-at', microtime(true), now()->addMinute());

            // Le serveur public de Nominatim a parfois des lenteurs passagères :
            // une seconde tentative (après 1 s, pour respecter le rythme imposé) suffit généralement.
            return Http::acceptJson()
                // Le serveur public répond parfois en 5 à 7 s : 10 s évite d'abandonner une réponse en route.
                ->timeout(10)
                ->retry(2, 1000, fn ($exception) => $exception instanceof ConnectionException, throw: false)
                ->withOptions(['verify' => config('geocoding.ca_bundle') ?: true])
                ->withHeaders([
                    'User-Agent' => config('geocoding.user_agent'),
                    'Accept-Language' => 'fr',
                ]);
        } finally {
            optional($lock)->release();
        }
    }

    private function ensureAvailable(Response $response): void
    {
        if ($response->successful()) {
            return;
        }

        Log::warning('Nominatim a refusé la requête de géocodage.', [
            'status' => $response->status(),
            'body' => mb_substr($response->body(), 0, 200),
            'user_agent' => config('geocoding.user_agent'),
        ]);

        throw new GeocodingUnavailableException('Le service de géocodage est temporairement indisponible.');
    }

    private function viewbox(): string
    {
        $bounds = config('geography.dakar.bounds');

        return implode(',', [$bounds['west'], $bounds['north'], $bounds['east'], $bounds['south']]);
    }
}
