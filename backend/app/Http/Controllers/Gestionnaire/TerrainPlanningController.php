<?php

namespace App\Http\Controllers\Gestionnaire;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreHoraireRequest;
use App\Http\Requests\StoreIndisponibiliteRequest;
use App\Http\Requests\UpdateHoraireRequest;
use App\Http\Requests\UpdateIndisponibiliteRequest;
use App\Models\Horaire;
use App\Models\Indisponibilite;
use App\Models\Terrain;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpKernel\Exception\HttpException;

class TerrainPlanningController extends Controller
{
    public function horaires(Terrain $terrain): JsonResponse
    {
        Gate::authorize('update', $terrain);

        return response()->json([
            'horaires' => $terrain->horaires()->orderBy('jour_semaine')->get(),
        ]);
    }

    public function storeHoraire(StoreHoraireRequest $request, Terrain $terrain): JsonResponse
    {
        $validated = $request->validated();
        $horaire = DB::transaction(function () use ($terrain, $validated) {
            $lockedTerrain = Terrain::query()->lockForUpdate()->findOrFail($terrain->getKey());

            return $lockedTerrain->horaires()->create($validated + ['actif' => true]);
        });

        return response()->json(['horaire' => $horaire], 201);
    }

    public function updateHoraire(UpdateHoraireRequest $request, Terrain $terrain, Horaire $horaire): JsonResponse
    {
        $validated = $request->validated();
        $horaire = DB::transaction(function () use ($terrain, $horaire, $validated) {
            $lockedTerrain = Terrain::query()->lockForUpdate()->findOrFail($terrain->getKey());
            $lockedHoraire = $lockedTerrain->horaires()->findOrFail($horaire->id);
            $lockedHoraire->update($validated);

            return $lockedHoraire->fresh();
        });

        return response()->json(['horaire' => $horaire]);
    }

    public function destroyHoraire(Terrain $terrain, Horaire $horaire): JsonResponse
    {
        Gate::authorize('update', $terrain);
        DB::transaction(function () use ($terrain, $horaire): void {
            $lockedTerrain = Terrain::query()->lockForUpdate()->findOrFail($terrain->getKey());
            $lockedTerrain->horaires()->findOrFail($horaire->id)->delete();
        });

        return response()->json(status: 204);
    }

    public function indisponibilites(Terrain $terrain): JsonResponse
    {
        Gate::authorize('update', $terrain);

        return response()->json([
            'indisponibilites' => $terrain->indisponibilites()->orderBy('date_debut')->get(),
        ]);
    }

    public function storeIndisponibilite(StoreIndisponibiliteRequest $request, Terrain $terrain): JsonResponse
    {
        $validated = $request->validated();
        $indisponibilite = DB::transaction(function () use ($terrain, $validated) {
            $lockedTerrain = Terrain::query()->lockForUpdate()->findOrFail($terrain->getKey());
            $this->ensureNoReservationOverlap(
                $lockedTerrain,
                $validated['date_debut'],
                $validated['date_fin']
            );

            return $lockedTerrain->indisponibilites()->create($validated);
        });

        return response()->json(['indisponibilite' => $indisponibilite], 201);
    }

    public function updateIndisponibilite(
        UpdateIndisponibiliteRequest $request,
        Terrain $terrain,
        Indisponibilite $indisponibilite
    ): JsonResponse {
        $indisponibilite = $terrain->indisponibilites()->findOrFail($indisponibilite->id);
        $validated = $request->validated();
        $indisponibilite = DB::transaction(function () use ($terrain, $indisponibilite, $validated) {
            $lockedTerrain = Terrain::query()->lockForUpdate()->findOrFail($terrain->getKey());
            $start = $validated['date_debut'] ?? $indisponibilite->date_debut;
            $end = $validated['date_fin'] ?? $indisponibilite->date_fin;
            $this->ensureNoReservationOverlap($lockedTerrain, $start, $end);

            $indisponibilite->update($validated);

            return $indisponibilite->fresh();
        });

        return response()->json(['indisponibilite' => $indisponibilite]);
    }

    public function destroyIndisponibilite(Terrain $terrain, Indisponibilite $indisponibilite): JsonResponse
    {
        Gate::authorize('update', $terrain);
        $terrain->indisponibilites()->findOrFail($indisponibilite->id)->delete();

        return response()->json(status: 204);
    }

    private function ensureNoReservationOverlap(Terrain $terrain, mixed $start, mixed $end): void
    {
        $overlap = $terrain->reservations()
            ->whereIn('statut', ['EN_ATTENTE', 'CONFIRMEE'])
            ->where('date_debut', '<', $end)
            ->where('date_fin', '>', $start)
            ->lockForUpdate()
            ->first() !== null;

        if ($overlap) {
            throw new HttpException(409, 'Cette période chevauche une réservation active.');
        }
    }
}