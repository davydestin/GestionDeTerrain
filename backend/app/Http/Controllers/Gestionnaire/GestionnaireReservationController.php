<?php

namespace App\Http\Controllers\Gestionnaire;

use App\Http\Controllers\Controller;
use App\Http\Resources\ManagedReservationResource;
use App\Models\NotificationUtilisateur;
use App\Models\Reservation;
use App\Models\Terrain;
use App\Services\AuditLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Demandes de réservation reçues par le gestionnaire.
 * Flux : le client demande → le gestionnaire valide (ou refuse) → il ouvre WhatsApp
 * avec le client pour convenir du paiement (aucun paiement dans l'application).
 */
class GestionnaireReservationController extends Controller
{
    private const VUES = ['en_attente', 'a_venir', 'historique'];

    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'vue' => ['sometimes', Rule::in(self::VUES)],
            'terrain_id' => ['sometimes', 'integer'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        $managerId = $request->user()->id;
        $owned = fn (): Builder => Reservation::query()
            ->whereHas('terrain', fn ($query) => $query->withTrashed()->where('gestionnaire_id', $managerId));

        $query = $owned()
            ->with(['utilisateur:id,nom,prenom', 'terrain' => fn ($terrainQuery) => $terrainQuery->select('id', 'nom')])
            ->when($filters['terrain_id'] ?? null, fn (Builder $q, $terrainId) => $q->where('terrain_id', $terrainId));

        match ($filters['vue'] ?? 'en_attente') {
            'en_attente' => $query->where('statut', 'EN_ATTENTE')->orderBy('date_debut'),
            'a_venir' => $query->where('statut', 'CONFIRMEE')->where('date_fin', '>', now())->orderBy('date_debut'),
            'historique' => $query->where(fn (Builder $q) => $q
                ->whereNotIn('statut', ['EN_ATTENTE', 'CONFIRMEE'])
                ->orWhere(fn (Builder $past) => $past->where('statut', 'CONFIRMEE')->where('date_fin', '<=', now())))
                ->orderByDesc('date_debut'),
        };

        return ManagedReservationResource::collection($query->paginate(20)->withQueryString())->additional([
            'compteurs' => [
                'en_attente' => $owned()->where('statut', 'EN_ATTENTE')->count(),
                'a_venir' => $owned()->where('statut', 'CONFIRMEE')->where('date_fin', '>', now())->count(),
            ],
        ]);
    }

    public function confirm(Reservation $reservation): JsonResponse
    {
        Gate::authorize('manage', $reservation);

        $reservation = $this->transition($reservation, 'CONFIRMEE', function (Reservation $locked): string {
            if ($locked->date_debut->isPast()) {
                throw new HttpException(409, 'Ce créneau est déjà passé : la réservation ne peut plus être confirmée.');
            }

            return sprintf(
                'Votre réservation de « %s » le %s de %s à %s est confirmée. Le gestionnaire va vous écrire sur WhatsApp%s pour convenir du paiement.',
                $locked->terrain->nom,
                $locked->date_debut->translatedFormat('l j F'),
                $locked->date_debut->format('H:i'),
                $locked->date_fin->format('H:i'),
                $locked->telephone_whatsapp ? ' (+'.$locked->telephone_whatsapp.')' : '',
            );
        }, 'Réservation confirmée');

        return response()->json(['reservation' => (new ManagedReservationResource($reservation))->resolve()]);
    }

    public function refuse(Request $request, Reservation $reservation): JsonResponse
    {
        $validated = $request->validate(['motif' => ['nullable', 'string', 'max:255']]);
        Gate::authorize('manage', $reservation);

        $reservation = $this->transition($reservation, 'REFUSEE', fn (Reservation $locked): string => sprintf(
            'Votre demande pour « %s » le %s n’a pas pu être acceptée.%s',
            $locked->terrain->nom,
            $locked->date_debut->translatedFormat('l j F à H:i'),
            filled($validated['motif'] ?? null) ? ' Motif : '.trim($validated['motif']) : '',
        ), 'Réservation refusée', filled($validated['motif'] ?? null) ? trim($validated['motif']) : null);

        return response()->json(['reservation' => (new ManagedReservationResource($reservation))->resolve()]);
    }

    /**
     * Passe une demande EN_ATTENTE au statut voulu et prévient le client.
     *
     * @param  callable(Reservation): string  $buildMessage  vérifie la transition et rédige la notification
     */
    private function transition(Reservation $reservation, string $status, callable $buildMessage, string $title, ?string $motif = null): Reservation
    {
        $updated = DB::transaction(function () use ($reservation, $status, $buildMessage, $title, $motif): Reservation {
            Terrain::withTrashed()->lockForUpdate()->findOrFail($reservation->terrain_id);
            $locked = Reservation::query()->with('terrain')->lockForUpdate()->findOrFail($reservation->id);

            if ($locked->statut !== 'EN_ATTENTE') {
                throw new HttpException(409, 'Cette demande a déjà été traitée.');
            }

            $message = $buildMessage($locked);
            // Le motif d'un refus est conservé sur la réservation : le client le voit dans « Mes réservations ».
            $locked->update(['statut' => $status] + ($status === 'REFUSEE' ? ['motif_refus' => $motif] : []));

            NotificationUtilisateur::create([
                'utilisateur_id' => $locked->utilisateur_id,
                'reservation_id' => $locked->id,
                'titre' => $title,
                'message' => $message,
                'lu' => false,
            ]);

            return $locked->fresh()->load(['utilisateur:id,nom,prenom', 'terrain']);
        });

        $confirmed = $status === 'CONFIRMEE';
        AuditLogger::log($confirmed ? 'reservation.confirmee' : 'reservation.refusee', sprintf(
            '%s de la réservation de %s pour « %s » du %s',
            $confirmed ? 'Confirmation' : 'Refus',
            trim($updated->utilisateur->prenom.' '.$updated->utilisateur->nom),
            $updated->terrain->nom,
            $updated->date_debut->format('d/m/Y à H:i'),
        ), $updated, array_filter(['motif' => $motif]));

        return $updated;
    }
}
