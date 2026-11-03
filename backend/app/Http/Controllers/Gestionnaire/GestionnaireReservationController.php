<?php

namespace App\Http\Controllers\Gestionnaire;

use App\Http\Controllers\Controller;
use App\Models\NotificationUtilisateur;
use App\Models\Reservation;
use App\Models\Terrain;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpKernel\Exception\HttpException;

class GestionnaireReservationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $reservations = Reservation::query()
            ->whereHas('terrain', fn ($query) => $query->where('gestionnaire_id', $request->user()->id))
            ->with(['utilisateur:id,nom,prenom', 'terrain:id,nom,ville', 'paiements'])
            ->orderByDesc('date_debut')
            ->paginate(20);

        return response()->json(['reservations' => $reservations]);
    }

    public function confirm(Reservation $reservation): JsonResponse
    {
        return $this->changeStatus($reservation, 'CONFIRMEE', 'Réservation confirmée', 'Votre réservation a été confirmée.');
    }

    public function refuse(Reservation $reservation): JsonResponse
    {
        return $this->changeStatus($reservation, 'REFUSEE', 'Réservation refusée', 'Votre réservation a été refusée.');
    }

    private function changeStatus(
        Reservation $reservation,
        string $status,
        string $notificationTitle,
        string $notificationMessage
    ): JsonResponse {
        Gate::authorize('manage', $reservation);

        $reservation = DB::transaction(function () use ($reservation, $status, $notificationTitle, $notificationMessage) {
            Terrain::withTrashed()->lockForUpdate()->findOrFail($reservation->terrain_id);
            $lockedReservation = Reservation::query()->lockForUpdate()->findOrFail($reservation->id);

            if ($lockedReservation->statut !== 'EN_ATTENTE') {
                throw new HttpException(409, 'Seules les réservations en attente peuvent être traitées.');
            }

            $lockedReservation->update(['statut' => $status]);

            NotificationUtilisateur::create([
                'utilisateur_id' => $lockedReservation->utilisateur_id,
                'titre' => $notificationTitle,
                'message' => $notificationMessage,
                'lu' => false,
            ]);

            return $lockedReservation->fresh()->load(['utilisateur:id,nom,prenom', 'terrain']);
        });

        return response()->json(['reservation' => $reservation]);
    }
}