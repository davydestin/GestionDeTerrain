<?php

namespace App\Http\Controllers;

use App\Http\Requests\MapTerrainRequest;
use App\Support\Search;
use App\Http\Requests\NearbyTerrainRequest;
use App\Http\Requests\SearchTerrainRequest;
use App\Http\Requests\StoreTerrainRequest;
use App\Http\Requests\UpdateTerrainRequest;
use App\Http\Resources\TerrainResource;
use App\Models\Reservation;
use App\Models\Terrain;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\PublicViewer;
use Illuminate\Validation\Rule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class TerrainController extends Controller
{
    public function index(SearchTerrainRequest $request): AnonymousResourceCollection
    {
        $terrains = $this->publicTerrainQuery($request->validated(), PublicViewer::from($request))
            // Photos incluses : la liste publique affiche la photo principale de chaque terrain.
            ->with(['images' => fn ($query) => $query->orderByDesc('est_principale')->orderBy('id')])
            ->orderBy('nom')
            ->paginate(15);

        return TerrainResource::collection($terrains);
    }

    public function map(MapTerrainRequest $request): AnonymousResourceCollection
    {
        $bounds = config('geography.dakar.bounds');
        $south = max((float) ($request->input('south', $bounds['south'])), $bounds['south']);
        $north = min((float) ($request->input('north', $bounds['north'])), $bounds['north']);
        $west = max((float) ($request->input('west', $bounds['west'])), $bounds['west']);
        $east = min((float) ($request->input('east', $bounds['east'])), $bounds['east']);

        if ($south >= $north || $west >= $east) {
            throw ValidationException::withMessages([
                'bounds' => 'La zone visible est hors du périmètre de Dakar.',
            ]);
        }

        $terrains = $this->publicTerrainQuery($request->validated(), PublicViewer::from($request))
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->whereBetween('latitude', [$south, $north])
            ->whereBetween('longitude', [$west, $east])
            ->with(['images' => fn ($query) => $query->orderByDesc('est_principale')->orderBy('id')])
            ->orderBy('nom')
            ->limit(500)
            ->get();

        return TerrainResource::collection($terrains);
    }

    public function nearby(NearbyTerrainRequest $request): AnonymousResourceCollection
    {
        $latitude = (float) $request->validated('latitude');
        $longitude = (float) $request->validated('longitude');
        $radius = (float) $request->validated('radius', 5000);
        $limit = (int) $request->validated('limit', 50);
        $query = $this->publicTerrainQuery($request->validated(), PublicViewer::from($request))
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->with(['images' => fn ($imageQuery) => $imageQuery->orderByDesc('est_principale')->orderBy('id')]);

        if (DB::connection()->getDriverName() === 'mysql') {
            $query->select('terrains.*')
                ->selectRaw(
                    'ST_Distance_Sphere(POINT(terrains.longitude, terrains.latitude), POINT(?, ?)) AS distance_m',
                    [$longitude, $latitude]
                )
                ->whereRaw(
                    'ST_Distance_Sphere(POINT(terrains.longitude, terrains.latitude), POINT(?, ?)) <= ?',
                    [$longitude, $latitude, $radius]
                )
                ->orderBy('distance_m')
                ->limit($limit);

            return TerrainResource::collection($query->get());
        }

        $latitudeDelta = $radius / 111_320;
        $longitudeDelta = $radius / max(1, 111_320 * cos(deg2rad($latitude)));
        $terrains = $query
            ->whereBetween('latitude', [$latitude - $latitudeDelta, $latitude + $latitudeDelta])
            ->whereBetween('longitude', [$longitude - $longitudeDelta, $longitude + $longitudeDelta])
            ->get()
            ->map(function (Terrain $terrain) use ($latitude, $longitude): Terrain {
                $terrain->setAttribute('distance_m', $this->haversineDistance(
                    $latitude,
                    $longitude,
                    (float) $terrain->latitude,
                    (float) $terrain->longitude
                ));

                return $terrain;
            })
            ->filter(fn (Terrain $terrain) => $terrain->distance_m <= $radius)
            ->sortBy('distance_m')
            ->take($limit)
            ->values();

        return TerrainResource::collection($terrains);
    }

    /**
     * Page d'accueil (« Terrains à la une ») : la seule vue où un gestionnaire voit aussi
     * les terrains des autres. Chaque terrain indique s'il appartient au gestionnaire connecté.
     */
    public function featured(Request $request): AnonymousResourceCollection
    {
        $viewer = PublicViewer::from($request);

        $terrains = $this->publicTerrainQuery()
            ->with(['images' => fn ($query) => $query->orderByDesc('est_principale')->orderBy('id')])
            ->withCount('images')
            ->orderByDesc('images_count')
            ->latest()
            ->limit(6)
            ->get()
            ->each(fn (Terrain $terrain) => $terrain->setAttribute(
                'est_a_moi',
                $viewer?->role === User::ROLE_GESTIONNAIRE && (int) $terrain->gestionnaire_id === (int) $viewer->id,
            ));

        return TerrainResource::collection($terrains);
    }

    public function show(Request $request, Terrain $terrain): TerrainResource
    {
        abort_unless($terrain->ville === 'Dakar' && $terrain->statut === 'ACTIF', 404);
        // Terrain d'un autre gestionnaire : invisible pour un gestionnaire (même réponse que s'il n'existait pas).
        abort_unless($terrain->estVisiblePour(PublicViewer::from($request)), 404);

        return new TerrainResource($terrain->load([
            'commune:id,nom',
            'images' => fn ($query) => $query->orderByDesc('est_principale')->orderBy('id'),
            'indisponibiliteEnCours',
        ]));
    }

    /**
     * Terrains du gestionnaire connecté, avec ce qu'il faut pour la page « Mes terrains » :
     * photo principale, nombre de réservations (total et à venir), horaires actifs,
     * filtres (recherche, statut) et compteurs globaux.
     */
    public function managedIndex(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'statut' => ['sometimes', 'nullable', Rule::in(['ACTIF', 'INACTIF'])],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        $owned = fn () => $request->user()->terrains();

        $terrains = $owned()
            ->withManagementDetails()
            ->when($filters['search'] ?? null, function (Builder $query, string $search): void {
                $like = '%'.$search.'%';
                $query->where(fn (Builder $nested) => $nested
                    ->where('nom', Search::like(), $like)
                    ->orWhere('quartier', Search::like(), $like)
                    ->orWhere('adresse', Search::like(), $like)
                    ->orWhere('type', Search::like(), $like));
            })
            ->when($filters['statut'] ?? null, fn (Builder $query, string $statut) => $query->where('statut', $statut))
            ->orderBy('nom')
            ->paginate(12)
            ->withQueryString();

        return TerrainResource::collection($terrains)->additional([
            'stats' => [
                'total' => $owned()->count(),
                'actifs' => $owned()->where('statut', 'ACTIF')->count(),
                'inactifs' => $owned()->where('statut', 'INACTIF')->count(),
                'sans_horaires' => $owned()->whereDoesntHave('horaires', fn ($query) => $query->where('actif', true))->count(),
                'reservations_en_attente' => Reservation::query()
                    ->whereIn('terrain_id', $owned()->pluck('id'))
                    ->where('statut', 'EN_ATTENTE')
                    ->count(),
            ],
        ]);
    }

    /** Fiche de gestion d'un terrain (propriétaire uniquement), quel que soit son statut. */
    public function managedShow(Request $request, Terrain $terrain): TerrainResource
    {
        Gate::authorize('update', $terrain);

        return new TerrainResource(
            Terrain::query()
                ->whereKey($terrain->getKey())
                ->withManagementDetails()
                ->with(['horaires' => fn ($query) => $query->orderBy('jour_semaine')])
                ->firstOrFail()
        );
    }

    public function store(StoreTerrainRequest $request): JsonResponse
    {
        $terrain = $request->user()->terrains()->create(
            $request->validated() + ['ville' => 'Dakar']
        );

        AuditLogger::log('terrain.cree', 'Création du terrain « '.$terrain->nom.' »', $terrain, [
            'tarif_horaire' => $terrain->tarif_horaire,
            'statut' => $terrain->statut,
        ]);

        return response()->json([
            'terrain' => (new TerrainResource($terrain->load('commune:id,nom')))->resolve($request),
        ], 201);
    }

    public function update(UpdateTerrainRequest $request, Terrain $terrain): JsonResponse
    {
        $terrain->update($request->validated());

        if ($changes = AuditLogger::changes($terrain)) {
            AuditLogger::log('terrain.modifie', 'Modification du terrain « '.$terrain->nom.' »', $terrain, ['changements' => $changes]);
        }

        return response()->json([
            'terrain' => (new TerrainResource($terrain->refresh()->load('commune:id,nom')))->resolve($request),
        ]);
    }

    public function destroy(Terrain $terrain): JsonResponse
    {
        Gate::authorize('delete', $terrain);

        DB::transaction(function () use ($terrain): void {
            $lockedTerrain = Terrain::query()->lockForUpdate()->findOrFail($terrain->getKey());

            $hasUpcomingReservations = $lockedTerrain->reservations()
                ->whereIn('statut', ['EN_ATTENTE', 'CONFIRMEE'])
                ->where('date_fin', '>', now())
                ->exists();

            if ($hasUpcomingReservations) {
                throw new HttpException(
                    409,
                    'Ce terrain a des réservations à venir : traitez-les ou passez le terrain en INACTIF.'
                );
            }

            $lockedTerrain->delete();
        });

        AuditLogger::log('terrain.supprime', 'Suppression du terrain « '.$terrain->nom.' »', $terrain);

        return response()->json(status: 204);
    }

    /**
     * Terrains publics (Dakar, actifs). `$viewer` applique la règle de visibilité :
     * un gestionnaire connecté n'y voit que ses propres terrains (voir Terrain::scopeVisiblesPour).
     */
    private function publicTerrainQuery(array $filters = [], ?User $viewer = null): Builder
    {
        return Terrain::query()
            ->where('ville', 'Dakar')
            ->where('statut', 'ACTIF')
            ->visiblesPour($viewer)
            ->when(isset($filters['commune_id']), fn (Builder $query) => $query->where('commune_id', $filters['commune_id']))
            ->when(isset($filters['commune']), fn (Builder $query) => $query->whereHas('commune', fn (Builder $communeQuery) => $communeQuery->where('nom', $filters['commune'])))
            ->when(isset($filters['quartier']), fn (Builder $query) => $query->where('quartier', Search::like(), '%'.$filters['quartier'].'%'))
            // « type » = revêtement du terrain de foot (gazon synthétique, gazon naturel…) : recherche partielle.
            ->when(isset($filters['type']), fn (Builder $query) => $query->where('type', Search::like(), '%'.$filters['type'].'%'))
            ->when(isset($filters['min_price']), fn (Builder $query) => $query->where('tarif_horaire', '>=', $filters['min_price']))
            ->when(isset($filters['max_price']), fn (Builder $query) => $query->where('tarif_horaire', '<=', $filters['max_price']))
            ->with(['commune:id,nom', 'indisponibiliteEnCours']);
    }

    private function haversineDistance(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadius = 6_371_000;
        $latitudeDelta = deg2rad($lat2 - $lat1);
        $longitudeDelta = deg2rad($lon2 - $lon1);
        $a = sin($latitudeDelta / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($longitudeDelta / 2) ** 2;

        return $earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}