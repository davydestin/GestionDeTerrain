<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreReservationRequest;
use App\Models\NotificationUtilisateur;
use App\Models\Reservation;
use App\Models\Terrain;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ClientReservationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $reservations = $request->user()
            ->reservations()
            ->with(['terrain:id,nom,ville', 'paiements'])
            ->orderByDesc('date_debut')
            ->get();

        return response()->json(['reservations' => $reservations]);
    }

    public function store(StoreReservationRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $startsAt = Carbon::parse($validated['date_debut']);
        $endsAt = Carbon::parse($validated['date_fin']);

        $reservation = DB::transaction(function () use ($request, $validated, $startsAt, $endsAt): Reservation {
            $terrain = Terrain::query()->lockForUpdate()->findOrFail($validated['terrain_id']);

            abort_unless($terrain->ville === 'Dakar' && $terrain->statut === 'ACTIF', 404);

            $horaire = $terrain->horaires()
                ->where('jour_semaine', $startsAt->isoWeekday())
                ->where('actif', true)
                ->lockForUpdate()
                ->first();

            if (! $horaire) {
                throw new HttpException(409, 'Le terrain est fermé à cette date.');
            }

            if ($startsAt->format('H:i:s') < $horaire->heure_ouverture
                || $endsAt->format('H:i:s') > $horaire->heure_fermeture) {
                throw new HttpException(409, 'La réservation est en dehors des horaires du terrain.');
            }

            $blocked = $terrain->indisponibilites()
                ->where('date_debut', '<', $endsAt)
                ->where('date_fin', '>', $startsAt)
                ->lockForUpdate()
                ->first() !== null;

            if ($blocked) {
                throw new HttpException(409, 'Le terrain est indisponible sur cette période.');
            }

            $overlap = $terrain->reservations()
                ->whereIn('statut', ['EN_ATTENTE', 'CONFIRMEE'])
                ->where('date_debut', '<', $endsAt)
                ->where('date_fin', '>', $startsAt)
                ->lockForUpdate()
                ->first() !== null;

            if ($overlap) {
                throw new HttpException(409, 'Ce créneau est déjà réservé.');
            }

            $durationInMinutes = $startsAt->diffInMinutes($endsAt);
            $amount = round((float) $terrain->tarif_horaire * ($durationInMinutes / 60), 2);

            $reservation = $request->user()->reservations()->create([
                'terrain_id' => $terrain->id,
                'date_debut' => $startsAt,
                'date_fin' => $endsAt,
                'montant_total' => $amount,
                'statut' => 'EN_ATTENTE',
                'commentaire' => $validated['commentaire'] ?? null,
            ]);

            NotificationUtilisateur::create([
                'utilisateur_id' => $terrain->gestionnaire_id,
                'titre' => 'Nouvelle réservation',
                'message' => 'Une nouvelle demande de réservation a été reçue.',
                'lu' => false,
            ]);

            return $reservation->load('terrain.commune:id,nom');
        });

        return response()->json(['reservation' => $reservation], 201);
    }

    public function cancel(Request $request, Reservation $reservation): JsonResponse
    {
        Gate::authorize('cancel', $reservation);

        $reservation = DB::transaction(function () use ($reservation): Reservation {
            $locked = Reservation::query()->lockForUpdate()->findOrFail($reservation->id);

            if (! in_array($locked->statut, ['EN_ATTENTE', 'CONFIRMEE'], true)) {
                throw new HttpException(409, 'Cette réservation ne peut plus être annulée.');
            }

            $locked->update(['statut' => 'ANNULEE']);

            NotificationUtilisateur::create([
                'utilisateur_id' => $locked->terrain->gestionnaire_id,
                'titre' => 'Réservation annulée',
                'message' => 'Un client a annulé sa réservation.',
                'lu' => false,
            ]);

            return $locked->fresh()->load('terrain.commune:id,nom');
        });

        return response()->json(['reservation' => $reservation]);
    }
}