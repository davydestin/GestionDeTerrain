<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
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

    protected $attributes = [
        'ville' => 'Dakar',
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
}