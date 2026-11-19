<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class Terrain extends Model
{
    use SoftDeletes;

    protected $table = 'terrains';

    protected $fillable = [
        'gestionnaire_id',
        'commune_id',
        'nom',
        'description',
        'adresse',
        'ville',
        'quartier',
        'latitude',
        'longitude',
        'type',
        'capacite',
        'tarif_horaire',
        'statut',
    ];

    protected function casts(): array
    {
        return [
            'capacite' => 'integer',
            'tarif_horaire' => 'decimal:2',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
        ];
    }

    // Valeurs par défaut identiques à celles de la base, pour que la réponse
    // de création les contienne sans relire la ligne.
    protected $attributes = [
        'ville' => 'Dakar',
        'statut' => 'ACTIF',
    ];

    protected static function booted(): void
    {
        static::softDeleted(function (Terrain $terrain): void {
            $images = $terrain->images()->get();

            if ($images->isNotEmpty()) {
                Storage::disk('public')->delete($images->pluck('chemin_image')->all());
                $terrain->images()->delete();
            }
        });
    }

    public function gestionnaire(): BelongsTo
    {
        return $this->belongsTo(User::class, 'gestionnaire_id');
    }

    public function commune(): BelongsTo
    {
        return $this->belongsTo(Commune::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(TerrainImage::class);
    }

    public function horaires(): HasMany
    {
        return $this->hasMany(Horaire::class);
    }

    public function indisponibilites(): HasMany
    {
        return $this->hasMany(Indisponibilite::class);
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    /** Fermeture en cours à l'instant présent (celle qui se termine le plus tard s'il y en a plusieurs). */
    public function indisponibiliteEnCours(): HasOne
    {
        return $this->hasOne(Indisponibilite::class)
            ->where('date_debut', '<=', now())
            ->where('date_fin', '>', now())
            ->orderByDesc('date_fin');
    }

    /**
     * État de disponibilité affiché au gestionnaire et aux clients :
     *  - DISPONIBLE   : actif et réservable ;
     *  - INDISPONIBLE : actif mais fermé jusqu'à une date (fermeture en cours) ;
     *  - HORS_LIGNE   : désactivé jusqu'à nouvel ordre, masqué aux clients.
     */
    public function disponibilite(): array
    {
        if ($this->statut !== 'ACTIF') {
            return ['etat' => 'HORS_LIGNE', 'jusqu_au' => null, 'motif' => null];
        }

        $fermeture = $this->relationLoaded('indisponibiliteEnCours')
            ? $this->indisponibiliteEnCours
            : $this->indisponibiliteEnCours()->first();

        return $fermeture
            ? ['etat' => 'INDISPONIBLE', 'jusqu_au' => $fermeture->date_fin, 'motif' => $fermeture->motif]
            : ['etat' => 'DISPONIBLE', 'jusqu_au' => null, 'motif' => null];
    }

    /*
     * Règle de visibilité : un gestionnaire ne voit que SES terrains dans la liste, la carte,
     * la recherche « à proximité » et les fiches publiques. Seule la page d'accueil (« Terrains
     * à la une ») montre aussi ceux des autres. Visiteurs, clients et administrateurs voient tout.
     */
    public function scopeVisiblesPour(Builder $query, ?User $viewer): Builder
    {
        return $query->when(
            $viewer?->role === User::ROLE_GESTIONNAIRE,
            fn (Builder $ownQuery) => $ownQuery->where('gestionnaire_id', $viewer->id),
        );
    }

    public function estVisiblePour(?User $viewer): bool
    {
        return $viewer?->role !== User::ROLE_GESTIONNAIRE
            || (int) $this->gestionnaire_id === (int) $viewer->id;
    }

    /** Tout ce qu'affichent les pages « Mes terrains » et la fiche de gestion. */
    public function scopeWithManagementDetails(Builder $query): Builder
    {
        return $query
            ->with([
                'commune:id,nom',
                'images' => fn ($imageQuery) => $imageQuery->orderByDesc('est_principale')->orderBy('id'),
                'indisponibiliteEnCours',
            ])
            ->withCount([
                'reservations',
                'reservations as reservations_a_venir_count' => fn ($reservationQuery) => $reservationQuery
                    ->whereIn('statut', ['EN_ATTENTE', 'CONFIRMEE'])
                    ->where('date_fin', '>', now()),
                'reservations as reservations_en_attente_count' => fn ($reservationQuery) => $reservationQuery
                    ->where('statut', 'EN_ATTENTE'),
                'horaires as horaires_actifs_count' => fn ($horaireQuery) => $horaireQuery->where('actif', true),
            ]);
    }
}