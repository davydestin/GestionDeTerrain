<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePaiementRequest;
use App\Models\NotificationUtilisateur;
use App\Models\Paiement;
use App\Models\Reservation;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\HttpException;

class PaiementController extends Controller
{
    public function index(Reservation $reservation): JsonResponse
    {
        Gate::authorize('pay', $reservation);

        return response()->json([
            'paiements' => $reservation->paiements()->orderByDesc('created_at')->get(),
        ]);
    }

    public function store(StorePaiementRequest $request, Reservation $reservation): JsonResponse
    {
        $validated = $request->validated();

        try {
            $paiement = DB::transaction(function () use ($validated, $reservation): Paiement {
                $lockedReservation = Reservation::query()->lockForUpdate()->findOrFail($reservation->id);

                if (! in_array($lockedReservation->statut, ['EN_ATTENTE', 'CONFIRMEE'], true)) {
                    throw new HttpException(409, 'Cette réservation ne peut plus être payée.');
                }

                if ($lockedReservation->paiements()->where('statut', 'PAYE')->lockForUpdate()->first() !== null) {
                    throw new HttpException(409, 'Cette réservation est déjà payée.');
                }

                return $lockedReservation->paiements()->create([
                    'montant' => $lockedReservation->montant_total,
                    'methode' => $validated['methode'],
                    'reference_transaction' => $validated['reference_transaction'] ?? null,
                    'statut' => 'EN_ATTENTE',
                ]);
            });
        } catch (QueryException $exception) {
            if (($exception->errorInfo[0] ?? null) === '23000') {
                return response()->json(['message' => 'Cette référence de transaction a déjà été utilisée.'], 409);
            }

            throw $exception;
        }

        return response()->json(['paiement' => $paiement], 201);
    }

    public function updateStatus(Request $request, Paiement $paiement): JsonResponse
    {
        $validated = $request->validate([
            'statut' => ['required', 'string', Rule::in(['PAYE', 'ECHOUE', 'REMBOURSE'])],
        ]);

        Gate::authorize('manage', $paiement->reservation);

        $paiement = DB::transaction(function () use ($paiement, $validated): Paiement {
            $reservation = Reservation::query()->lockForUpdate()->findOrFail($paiement->reservation_id);
            $lockedPaiement = $reservation->paiements()->lockForUpdate()->findOrFail($paiement->id);
            $nextStatus = $validated['statut'];

            if ($lockedPaiement->statut === $nextStatus) {
                return $lockedPaiement;
            }

            $transitionAllowed = ($lockedPaiement->statut === 'EN_ATTENTE'
                    && in_array($nextStatus, ['PAYE', 'ECHOUE'], true))
                || ($lockedPaiement->statut === 'PAYE' && $nextStatus === 'REMBOURSE');

            if (! $transitionAllowed) {
                throw new HttpException(409, 'Cette transition de paiement n’est pas autorisée.');
            }

            if ($nextStatus === 'PAYE'
                && $reservation->paiements()->where('statut', 'PAYE')
                    ->where('id', '<>', $lockedPaiement->id)
                    ->lockForUpdate()
                    ->first() !== null) {
                throw new HttpException(409, 'Un autre paiement est déjà comptabilisé pour cette réservation.');
            }

            $lockedPaiement->update([
                'statut' => $nextStatus,
                'date_paiement' => $nextStatus === 'PAYE' ? now() : $lockedPaiement->date_paiement,
            ]);

            $messages = [
                'PAYE' => ['Paiement confirmé', 'Le paiement de votre réservation a été confirmé.'],
                'ECHOUE' => ['Paiement échoué', 'Le paiement de votre réservation a échoué.'],
                'REMBOURSE' => ['Paiement remboursé', 'Le paiement de votre réservation a été remboursé.'],
            ];
            [$title, $message] = $messages[$nextStatus];

            NotificationUtilisateur::create([
                'utilisateur_id' => $reservation->utilisateur_id,
                'titre' => $title,
                'message' => $message,
                'lu' => false,
            ]);

            return $lockedPaiement->fresh();
        });

        return response()->json(['paiement' => $paiement]);
    }
}