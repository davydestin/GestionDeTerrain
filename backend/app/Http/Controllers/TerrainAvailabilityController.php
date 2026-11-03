<?php

namespace App\Http\Controllers;

use App\Models\Terrain;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TerrainAvailabilityController extends Controller
{
    public function show(Request $request, Terrain $terrain): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
        ]);

        abort_unless($terrain->ville === 'Dakar' && $terrain->statut === 'ACTIF', 404);

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