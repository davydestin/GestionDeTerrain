<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreReservationRequest;
use App\Models\NotificationUtilisateur;
use App\Models\Reservation;
use App\Models\Terrain;
use App\Services\AuditLogger;
use App\Support\PhoneNumber;
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
            ->with(['terrain:id,nom,ville,quartier,adresse,commune_id', 'terrain.commune:id,nom'])
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

            $opensAt = Carbon::parse($horaire->heure_ouverture)->format('H:i:s');
            $closesAt = Carbon::parse($horaire->heure_fermeture)->format('H:i:s');

            if ($startsAt->format('H:i:s') < $opensAt || $endsAt->format('H:i:s') > $closesAt) {
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

            $client = $request->user();
            $whatsapp = PhoneNumber::toWhatsApp($validated['telephone_whatsapp']);

            $reservation = $client->reservations()->create([
                'terrain_id' => $terrain->id,
                'date_debut' => $startsAt,
                'date_fin' => $endsAt,
                'montant_total' => $amount,
                'statut' => 'EN_ATTENTE',
                'commentaire' => $validated['commentaire'] ?? null,
                'telephone_whatsapp' => $whatsapp,
            ]);

            // Le numéro sert aussi de téléphone de profil s'il n'en avait pas encore.
            if (blank($client->telephone)) {
                $client->forceFill(['telephone' => '+'.$whatsapp])->save();
            }

            NotificationUtilisateur::create([
                'utilisateur_id' => $terrain->gestionnaire_id,
                'reservation_id' => $reservation->id,
                'titre' => 'Nouvelle demande de réservation',
                'message' => sprintf(
                    '%s %s souhaite réserver « %s » le %s de %s à %s.',
                    $client->prenom,
                    $client->nom,
                    $terrain->nom,
                    $startsAt->translatedFormat('l j F'),
                    $startsAt->format('H:i'),
                    $endsAt->format('H:i'),
                ),
                'lu' => false,
            ]);

            return $reservation->load('terrain.commune:id,nom');
        });

        AuditLogger::log('reservation.creee', sprintf(
            'Demande de réservation de « %s » le %s de %s à %s',
            $reservation->terrain->nom,
            $startsAt->format('d/m/Y'),
            $startsAt->format('H:i'),
            $endsAt->format('H:i'),
        ), $reservation, ['terrain_id' => $reservation->terrain_id, 'montant_total' => $reservation->montant_total]);

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

            $wasConfirmed = $locked->statut === 'CONFIRMEE';
            $locked->update(['statut' => 'ANNULEE']);

            NotificationUtilisateur::create([
                'utilisateur_id' => $locked->terrain->gestionnaire_id,
                'reservation_id' => $locked->id,
                'titre' => 'Réservation annulée',
                'message' => sprintf(
                    'Le client a annulé sa réservation de « %s » du %s.%s',
                    $locked->terrain->nom,
                    $locked->date_debut->translatedFormat('l j F à H:i'),
                    $wasConfirmed ? ' Si un paiement a déjà été versé, réglez le remboursement sur WhatsApp.' : '',
                ),
                'lu' => false,
            ]);

            return $locked->fresh()->load('terrain.commune:id,nom');
        });

        AuditLogger::log('reservation.annulee', sprintf(
            'Annulation par le client de la réservation de « %s » du %s',
            $reservation->terrain->nom,
            $reservation->date_debut->format('d/m/Y à H:i'),
        ), $reservation);

        return response()->json(['reservation' => $reservation]);
    }
}