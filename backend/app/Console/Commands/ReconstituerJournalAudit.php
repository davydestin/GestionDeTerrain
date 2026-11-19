<?php

namespace App\Console\Commands;

use App\Http\Controllers\Gestionnaire\TerrainPlanningController;
use App\Models\JournalAudit;
use App\Models\NotificationUtilisateur;
use App\Models\Reservation;
use App\Models\Terrain;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Reconstitue le journal d'audit des actions passées (antérieures à son installation)
 * à partir des données déjà en base : terrains, photos, horaires, fermetures et réservations.
 *
 * Chaque entrée reconstituée porte `details.reconstitue = true`, sans adresse IP ni navigateur.
 * Les horaires et les fermetures n'ont pas de date de création en base : leur date est approchée
 * (`details.date_approximative = true`).
 *
 * Relancer la commande ne crée pas de doublon : une action déjà présente pour la même cible est ignorée.
 */
class ReconstituerJournalAudit extends Command
{
    protected $signature = 'audit:reconstituer';

    protected $description = 'Ajoute au journal d’audit les actions passées des gestionnaires et des clients (terrains, photos, horaires, fermetures, réservations).';

    private int $created = 0;

    private int $skipped = 0;

    /** @var array<int, User|null> */
    private array $users = [];

    /** Début du suivi en direct : seules les actions antérieures sont reconstituées. */
    private CarbonInterface $cutoff;

    public function handle(): int
    {
        // Les entrées écrites en direct ont toujours une adresse IP ; les reconstituées n'en ont pas.
        $firstLive = JournalAudit::query()->whereNotNull('adresse_ip')->min('created_at');
        $this->cutoff = $firstLive ? \Illuminate\Support\Carbon::parse($firstLive) : now();

        DB::transaction(function (): void {
            Terrain::withTrashed()->with(['images', 'horaires', 'indisponibilites'])->orderBy('id')->each(function (Terrain $terrain): void {
                $this->terrain($terrain);
            });

            Reservation::query()->with('terrain')->orderBy('id')->each(function (Reservation $reservation): void {
                $this->reservation($reservation);
            });
        });

        $this->info(sprintf('%d entrée(s) ajoutée(s), %d déjà présente(s).', $this->created, $this->skipped));

        return self::SUCCESS;
    }

    private function terrain(Terrain $terrain): void
    {
        $manager = $this->user($terrain->gestionnaire_id);
        $created = $terrain->created_at ?? now();

        $this->record('terrain.cree', 'Création du terrain « '.$terrain->nom.' »', $terrain, $manager, $created, [
            'tarif_horaire' => $terrain->tarif_horaire,
            'statut' => $terrain->statut,
        ]);

        if ($terrain->images->isNotEmpty()) {
            $count = $terrain->images->count();
            $this->record('terrain.photo_ajoutee', sprintf(
                '%d photo%s ajoutée%s au terrain « %s »',
                $count,
                $count > 1 ? 's' : '',
                $count > 1 ? 's' : '',
                $terrain->nom,
            ), $terrain, $manager, $terrain->images->min('created_at') ?? $created, [
                'photos' => $terrain->images->pluck('id')->all(),
            ]);
        }

        if ($terrain->horaires->isNotEmpty()) {
            $days = $terrain->horaires->sortBy('jour_semaine')
                ->map(fn ($horaire) => sprintf(
                    '%s %s–%s',
                    TerrainPlanningController::JOURS[$horaire->jour_semaine] ?? $horaire->jour_semaine,
                    substr((string) $horaire->heure_ouverture, 0, 5),
                    substr((string) $horaire->heure_fermeture, 0, 5),
                ));
            // Pas de date en base : on retient la création du terrain, moment où les horaires sont d'ordinaire saisis.
            $this->record('terrain.horaire_ajoute', sprintf(
                'Horaires définis pour le terrain « %s » (%d jour%s)',
                $terrain->nom,
                $days->count(),
                $days->count() > 1 ? 's' : '',
            ), $terrain, $manager, $created, ['horaires' => $days->values()->implode(', '), 'date_approximative' => true]);
        }

        foreach ($terrain->indisponibilites as $closure) {
            // Pas de date en base : début de la fermeture (si passé), sinon dernière modification du terrain.
            $start = $closure->date_debut;
            $at = $start->isPast() ? $start : ($terrain->updated_at ?? $created);
            $this->record('terrain.indisponibilite_ajoutee', sprintf(
                'Fermeture du terrain « %s » du %s au %s',
                $terrain->nom,
                $start->format('d/m/Y H:i'),
                $closure->date_fin->format('d/m/Y H:i'),
            ), $closure, $manager, $at, array_filter(['terrain_id' => $terrain->id, 'motif' => $closure->motif]) + ['date_approximative' => true]);
        }

        if ($terrain->trashed()) {
            $this->record('terrain.supprime', 'Suppression du terrain « '.$terrain->nom.' »', $terrain, $manager, $terrain->deleted_at);
        }
    }

    private function reservation(Reservation $reservation): void
    {
        $client = $this->user($reservation->utilisateur_id);
        $manager = $this->user($reservation->terrain?->gestionnaire_id);
        $terrainName = $reservation->terrain?->nom ?? 'terrain supprimé';
        $slot = $reservation->date_debut->format('d/m/Y à H:i');

        $this->record('reservation.creee', sprintf(
            'Demande de réservation de « %s » le %s de %s à %s',
            $terrainName,
            $reservation->date_debut->format('d/m/Y'),
            $reservation->date_debut->format('H:i'),
            $reservation->date_fin->format('H:i'),
        ), $reservation, $client, $reservation->created_at ?? now(), [
            'terrain_id' => $reservation->terrain_id,
            'montant_total' => $reservation->montant_total,
        ]);

        // Les notifications envoyées à chaque étape donnent la date exacte des décisions.
        $notifications = NotificationUtilisateur::query()
            ->where('reservation_id', $reservation->id)
            ->orderBy('created_at')
            ->get()
            ->keyBy('titre');

        $clientName = $client ? trim($client->prenom.' '.$client->nom) : 'un client';
        $confirmed = $notifications->get('Réservation confirmée')?->created_at
            ?? ($reservation->statut === 'CONFIRMEE' ? $reservation->updated_at : null);
        $refused = $notifications->get('Réservation refusée')?->created_at
            ?? ($reservation->statut === 'REFUSEE' ? $reservation->updated_at : null);
        $cancelled = $notifications->get('Réservation annulée')?->created_at
            ?? ($reservation->statut === 'ANNULEE' ? $reservation->updated_at : null);

        if ($confirmed) {
            $this->record('reservation.confirmee', sprintf(
                'Confirmation de la réservation de %s pour « %s » du %s',
                $clientName,
                $terrainName,
                $slot,
            ), $reservation, $manager, $confirmed);
        }

        if ($refused) {
            $this->record('reservation.refusee', sprintf(
                'Refus de la réservation de %s pour « %s » du %s',
                $clientName,
                $terrainName,
                $slot,
            ), $reservation, $manager, $refused);
        }

        if ($cancelled) {
            $this->record('reservation.annulee', sprintf(
                'Annulation par le client de la réservation de « %s » du %s',
                $terrainName,
                $slot,
            ), $reservation, $client, $cancelled);
        }
    }

    private function record(
        string $action,
        string $description,
        \Illuminate\Database\Eloquent\Model $cible,
        ?User $auteur,
        CarbonInterface $at,
        array $details = [],
    ): void {
        $cibleType = \Illuminate\Support\Str::snake(class_basename($cible));

        if ($at->greaterThanOrEqualTo($this->cutoff)) {
            return; // déjà couvert par le suivi en direct
        }

        $exists = JournalAudit::query()
            ->where('action', $action)
            ->where('cible_type', $cibleType)
            ->where('cible_id', $cible->getKey())
            ->exists();

        if ($exists) {
            $this->skipped++;

            return;
        }

        (new JournalAudit)->forceFill([
            'utilisateur_id' => $auteur?->id,
            'utilisateur_nom' => $auteur ? trim($auteur->prenom.' '.$auteur->nom) : null,
            'utilisateur_email' => $auteur?->email,
            'utilisateur_role' => $auteur?->role,
            'action' => $action,
            'cible_type' => $cibleType,
            'cible_id' => $cible->getKey(),
            'description' => $description,
            'details' => ['reconstitue' => true] + $details,
            'adresse_ip' => null,
            'user_agent' => null,
            'created_at' => $at,
        ])->save();

        $this->created++;
    }

    private function user(?int $id): ?User
    {
        if ($id === null) {
            return null;
        }

        return $this->users[$id] ??= User::query()->find($id);
    }
}
