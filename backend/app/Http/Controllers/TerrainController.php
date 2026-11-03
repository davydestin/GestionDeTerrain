<?php

namespace App\Http\Controllers;

use App\Http\Requests\MapTerrainRequest;
use App\Http\Requests\NearbyTerrainRequest;
use App\Http\Requests\SearchTerrainRequest;
use App\Http\Requests\StoreTerrainRequest;
use App\Http\Requests\UpdateTerrainRequest;
use App\Http\Resources\TerrainResource;
use App\Models\Terrain;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class TerrainController extends Controller
{
    public function index(SearchTerrainRequest $request): AnonymousResourceCollection
    {
        $terrains = $this->publicTerrainQuery($request->validated())
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

        $terrains = $this->publicTerrainQuery($request->validated())
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
        $query = $this->publicTerrainQuery($request->validated())
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

    public function show(Terrain $terrain): TerrainResource
    {
        abort_unless($terrain->ville === 'Dakar' && $terrain->statut === 'ACTIF', 404);

        return new TerrainResource($terrain->load([
            'commune:id,nom',
            'images' => fn ($query) => $query->orderByDesc('est_principale')->orderBy('id'),
        ]));
    }

    public function managedIndex(Request $request): AnonymousResourceCollection
    {
        $terrains = $request->user()
            ->terrains()
            ->with('commune:id,nom')
            ->withCount('reservations')
            ->orderBy('nom')
            ->paginate(15);

        return TerrainResource::collection($terrains);
    }

    public function store(StoreTerrainRequest $request): JsonResponse
    {
        $terrain = $request->user()->terrains()->create(
            $request->validated() + ['ville' => 'Dakar']
        );

        return response()->json([
            'terrain' => (new TerrainResource($terrain->load('commune:id,nom')))->resolve($request),
        ], 201);
    }

    public function update(UpdateTerrainRequest $request, Terrain $terrain): JsonResponse
    {
        $terrain->update($request->validated());

        return response()->json([
            'terrain' => (new TerrainResource($terrain->refresh()->load('commune:id,nom')))->resolve($request),
        ]);
    }

    public function destroy(Terrain $terrain): JsonResponse
    {
        Gate::authorize('delete', $terrain);

        $terrain->delete();

        return response()->json(status: 204);
    }

    private function publicTerrainQuery(array $filters = []): Builder
    {
        return Terrain::query()
            ->where('ville', 'Dakar')
            ->where('statut', 'ACTIF')
            ->when(isset($filters['commune_id']), fn (Builder $query) => $query->where('commune_id', $filters['commune_id']))
            ->when(isset($filters['commune']), fn (Builder $query) => $query->whereHas('commune', fn (Builder $communeQuery) => $communeQuery->where('nom', $filters['commune'])))
            ->when(isset($filters['quartier']), fn (Builder $query) => $query->where('quartier', 'like', '%'.$filters['quartier'].'%'))
            ->when(isset($filters['type']), fn (Builder $query) => $query->where('type', $filters['type']))
            ->when(isset($filters['min_price']), fn (Builder $query) => $query->where('tarif_horaire', '>=', $filters['min_price']))
            ->when(isset($filters['max_price']), fn (Builder $query) => $query->where('tarif_horaire', '<=', $filters['max_price']))
            ->with('commune:id,nom');
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