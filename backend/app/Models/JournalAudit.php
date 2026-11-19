<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * Entrée du journal d'audit. Écriture seule : une entrée ne peut être ni modifiée ni supprimée
 * depuis l'application (seule la suppression d'un compte détache l'auteur, via la clé étrangère).
 */
class JournalAudit extends Model
{
    public const UPDATED_AT = null;

    /** Libellés des actions, affichés par l'interface et utilisés pour valider le filtre. */
    public const ACTIONS = [
        'auth.connexion' => 'Connexion',
        'auth.connexion_echouee' => 'Connexion échouée',
        'auth.deconnexion' => 'Déconnexion',
        'auth.inscription' => 'Inscription',
        'profil.modifie' => 'Profil modifié',
        'utilisateur.cree' => 'Compte créé',
        'utilisateur.modifie' => 'Compte modifié',
        'utilisateur.role_modifie' => 'Rôle modifié',
        'utilisateur.active' => 'Compte réactivé',
        'utilisateur.desactive' => 'Compte désactivé',
        'utilisateur.supprime' => 'Compte supprimé',
        'terrain.cree' => 'Terrain créé',
        'terrain.modifie' => 'Terrain modifié',
        'terrain.supprime' => 'Terrain supprimé',
        'terrain.disponibilite' => 'Disponibilité du terrain',
        'terrain.photo_ajoutee' => 'Photo ajoutée',
        'terrain.photo_principale' => 'Photo principale changée',
        'terrain.photo_supprimee' => 'Photo supprimée',
        'terrain.horaire_ajoute' => 'Horaire ajouté',
        'terrain.horaire_modifie' => 'Horaire modifié',
        'terrain.horaire_supprime' => 'Horaire supprimé',
        'terrain.indisponibilite_ajoutee' => 'Fermeture programmée',
        'terrain.indisponibilite_modifiee' => 'Fermeture modifiée',
        'terrain.indisponibilite_supprimee' => 'Fermeture supprimée',
        'reservation.creee' => 'Réservation demandée',
        'reservation.confirmee' => 'Réservation confirmée',
        'reservation.refusee' => 'Réservation refusée',
        'reservation.annulee' => 'Réservation annulée',
    ];

    protected $table = 'journal_audit';

    protected $fillable = [
        'utilisateur_id',
        'utilisateur_nom',
        'utilisateur_email',
        'utilisateur_role',
        'action',
        'cible_type',
        'cible_id',
        'description',
        'details',
        'adresse_ip',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'details' => 'array',
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Une entrée du journal d’audit ne peut pas être modifiée.'));
        static::deleting(fn () => throw new LogicException('Une entrée du journal d’audit ne peut pas être supprimée.'));
    }

    public function utilisateur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'utilisateur_id');
    }
}
