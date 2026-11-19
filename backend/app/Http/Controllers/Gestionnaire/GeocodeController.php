<?php

namespace App\Http\Controllers\Gestionnaire;

use App\Http\Controllers\Controller;
use App\Http\Requests\GeocodeAddressRequest;
use App\Http\Requests\ReverseGeocodeRequest;
use App\Services\GeocodingUnavailableException;
use App\Services\NominatimGeocoder;
use Closure;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class GeocodeController extends Controller
{
    /** Adresse (texte libre ou champs du formulaire) → positions candidates dans Dakar. */
    public function search(GeocodeAddressRequest $request, NominatimGeocoder $geocoder): JsonResponse
    {
        return $this->guard(fn () => [
            'results' => $request->filled('q')
                ? $geocoder->searchText($request->string('q')->toString())
                : $geocoder->search(
                    adresse: $request->string('adresse')->toString(),
                    quartier: $request->string('quartier')->toString(),
                    ville: $request->string('ville')->toString() ?: 'Dakar',
                    complement: $request->string('complement')->toString() ?: null,
                    commune: $request->string('commune')->toString() ?: null,
                ),
        ]);
    }

    /** Position du repère sur la carte → adresse lisible pour pré-remplir le formulaire. */
    public function reverse(ReverseGeocodeRequest $request, NominatimGeocoder $geocoder): JsonResponse
    {
        return $this->guard(fn () => [
            'result' => $geocoder->reverse(
                (float) $request->input('latitude'),
                (float) $request->input('longitude'),
            ),
        ]);
    }

    private function guard(Closure $callback): JsonResponse
    {
        try {
            return response()->json($callback());
        } catch (GeocodingUnavailableException $exception) {
            return response()->json(['message' => $exception->getMessage()], 503);
        } catch (LockTimeoutException) {
            return response()->json([
                'message' => 'Trop de recherches simultanées, réessayez dans quelques secondes.',
            ], 503);
        } catch (ConnectionException $exception) {
            Log::warning('Nominatim ne répond pas.', ['error' => $exception->getMessage()]);

            return response()->json([
                'message' => 'Le service d’adresses ne répond pas pour le moment. Réessayez ou complétez l’adresse à la main.',
            ], 503);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }
}
