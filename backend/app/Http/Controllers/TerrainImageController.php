<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTerrainImagesRequest;
use App\Http\Resources\TerrainImageResource;
use App\Models\Terrain;
use App\Models\TerrainImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class TerrainImageController extends Controller
{
    public function store(StoreTerrainImagesRequest $request, Terrain $terrain): JsonResponse
    {
        $files = $request->file('images', []);
        $makePrimary = $request->boolean('est_principale');
        $storedPaths = [];

        try {
            $images = DB::transaction(function () use ($terrain, $files, $makePrimary, &$storedPaths) {
                $lockedTerrain = Terrain::query()->lockForUpdate()->findOrFail($terrain->getKey());
                $hasPrimary = $lockedTerrain->images()->where('est_principale', true)->exists();
                $setPrimary = $makePrimary || ! $hasPrimary;

                if ($setPrimary) {
                    $lockedTerrain->images()->update(['est_principale' => false]);
                }

                $createdImages = collect();

                foreach ($files as $index => $file) {
                    $path = $file->store('terrains/'.$lockedTerrain->getKey(), 'public');

                    if ($path === false) {
                        throw new RuntimeException('Impossible d’enregistrer la photo.');
                    }

                    $storedPaths[] = $path;
                    $createdImages->push($lockedTerrain->images()->create([
                        'chemin_image' => $path,
                        'est_principale' => $setPrimary && $index === 0,
                    ]));
                }

                return $createdImages;
            });
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($storedPaths);
            throw $exception;
        }

        return response()->json([
            'data' => $images->map(
                fn (TerrainImage $image) => (new TerrainImageResource($image))->resolve($request)
            ),
        ], 201);
    }

    public function setPrimary(Request $request, Terrain $terrain, TerrainImage $image): TerrainImageResource
    {
        Gate::authorize('update', $terrain);

        DB::transaction(function () use ($terrain, $image): void {
            $lockedTerrain = Terrain::query()->lockForUpdate()->findOrFail($terrain->getKey());
            $selectedImage = $lockedTerrain->images()->findOrFail($image->getKey());

            $lockedTerrain->images()->update(['est_principale' => false]);
            $selectedImage->update(['est_principale' => true]);
        });

        return new TerrainImageResource($image->refresh());
    }

    public function destroy(Terrain $terrain, TerrainImage $image): JsonResponse
    {
        Gate::authorize('update', $terrain);

        $storedPath = null;

        DB::transaction(function () use ($terrain, $image, &$storedPath): void {
            $lockedTerrain = Terrain::query()->lockForUpdate()->findOrFail($terrain->getKey());
            $selectedImage = $lockedTerrain->images()->findOrFail($image->getKey());
            $storedPath = $selectedImage->chemin_image;
            $wasPrimary = $selectedImage->est_principale;

            $selectedImage->delete();

            if ($wasPrimary) {
                $replacement = $lockedTerrain->images()->orderBy('id')->first();
                $lockedTerrain->images()->update(['est_principale' => false]);
                $replacement?->update(['est_principale' => true]);
            }
        });

        if ($storedPath !== null) {
            Storage::disk('public')->delete($storedPath);
        }

        return response()->json(status: 204);
    }

    public function show(TerrainImage $terrainImage): StreamedResponse
    {
        $terrain = $terrainImage->terrain;

        abort_unless($terrain && $terrain->ville === 'Dakar' && $terrain->statut === 'ACTIF', 404);
        abort_unless(Storage::disk('public')->exists($terrainImage->chemin_image), 404);

        return Storage::disk('public')->response($terrainImage->chemin_image);
    }
}