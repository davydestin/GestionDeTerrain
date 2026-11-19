<?php

namespace App\Http\Controllers;

use App\Http\Resources\TerrainResource;
use App\Models\Terrain;
use App\Services\AuditLogger;
use App\Support\PublicViewer;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\HttpException;

class TerrainAvailabilityController extends Controller
{
    /**
     * Le gestionnaire change la disponibilité de son terrain :
     *  - DISPONIBLE                       : réactive le terrain et met fin à la fermeture en cours ;
     *  - INDISPONIBLE + jusqu_au          : ferme le terrain de maintenant jusqu'à cette date (reste visible) ;
     *  - INDISPONIBLE sans date           : désactive le terrain jusqu'à nouvel ordre (masqué aux clients).
     */
    public function update(Request $request, Terrain $terrain): TerrainResource
    {
        Gate::authorize('update', $terrain);

        $validated = $request->validate([
            'etat' => ['required', Rule::in(['DISPONIBLE', 'INDISPONIBLE'])],
            'jusqu_au' => ['nullable', 'date', 'after:now'],
            'motif' => ['nullable', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($terrain, $validated): void {
            $locked = Terrain::query()->lockForUpdate()->findOrFail($terrain->getKey());
            $now = now()->startOfMinute();

            if ($validated['etat'] === 'DISPONIBLE') {
                $locked->update(['statut' => 'ACTIF']);
                // Les fermetures en cours se terminent maintenant ; les fermetures futures sont conservées.
                $locked->indisponibilites()
                    ->where('date_debut', '<=', $now)
                    ->where('date_fin', '>', $now)
                    ->update(['date_fin' => $now]);

                return;
            }

            if (empty($validated['jusqu_au'])) {
                $locked->update(['statut' => 'INACTIF']);

                return;
            }

            $until = Carbon::parse($validated['jusqu_au']);
            $conflicts = $locked->reservations()
                ->whereIn('statut', ['EN_ATTENTE', 'CONFIRMEE'])
                ->where('date_debut', '<', $until)
                ->where('date_fin', '>', $now)
                ->count();

            if ($conflicts > 0) {
                throw new HttpException(409, sprintf(
                    '%d réservation%s en attente ou confirmée%s sur cette période : refusez-les ou choisissez une date plus proche.',
                    $conflicts,
                    $conflicts > 1 ? 's' : '',
                    $conflicts > 1 ? 's' : '',
                ));
            }

            $locked->indisponibilites()->create([
                'date_debut' => $now,
                'date_fin' => $until,
                'motif' => $validated['motif'] ?? null,
            ]);
        });

        $description = match (true) {
            $validated['etat'] === 'DISPONIBLE' => 'Terrain « '.$terrain->nom.' » rendu disponible',
            empty($validated['jusqu_au']) => 'Terrain « '.$terrain->nom.' » désactivé jusqu’à nouvel ordre',
            default => 'Terrain « '.$terrain->nom.' » fermé jusqu’au '.Carbon::parse($validated['jusqu_au'])->format('d/m/Y H:i'),
        };
        AuditLogger::log('terrain.disponibilite', $description, $terrain, array_filter([
            'etat' => $validated['etat'],
            'jusqu_au' => $validated['jusqu_au'] ?? null,
            'motif' => $validated['motif'] ?? null,
        ]));

        return new TerrainResource(
            Terrain::query()->whereKey($terrain->getKey())->withManagementDetails()->firstOrFail()
        );
    }

    public function show(Request $request, Terrain $terrain): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
        ]);

        abort_unless($terrain->ville === 'Dakar' && $terrain->statut === 'ACTIF', 404);
        abort_unless($terrain->estVisiblePour(PublicViewer::from($request)), 404);

        $date = Carbon::createFromFormat('Y-m-d', $validated['date']);
        $dayStart = $date->copy()->startOfDay();
        $dayEnd = $date->copy()->endOfDay();
        $horaire = $terrain->horaires()
            ->where('jour_semaine', $date->isoWeekday())
            ->where('actif', true)
            ->first();

        $indisponibilites = $terrain->indisponibilites()
            ->where('date_debut', '<', $dayEnd)
            ->where('date_fin', '>', $dayStart)
            ->orderBy('date_debut')
            ->get(['id', 'date_debut', 'date_fin', 'motif']);

        $reservations = $terrain->reservations()
            ->whereIn('statut', ['EN_ATTENTE', 'CONFIRMEE'])
            ->where('date_debut', '<', $dayEnd)
            ->where('date_fin', '>', $dayStart)
            ->orderBy('date_debut')
            ->get(['id', 'date_debut', 'date_fin', 'statut']);

        return response()->json([
            'terrain_id' => $terrain->id,
            'date' => $date->toDateString(),
            'ouvert' => $horaire !== null,
            'horaire' => $horaire ? [
                'heure_ouverture' => $horaire->heure_ouverture,
                'heure_fermeture' => $horaire->heure_fermeture,
            ] : null,
            'indisponibilites' => $indisponibilites,
            'reservations' => $reservations,
        ]);
    }
}