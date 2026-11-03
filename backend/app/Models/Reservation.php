<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Reservation extends Model
{
    protected $table = 'reservations';

    protected $fillable = [
        'utilisateur_id',
        'terrain_id',
        'date_debut',
        'date_fin',
        'montant_total',
        'statut',
        'commentaire',
    ];

    protected function casts(): array
    {
        return [
            'date_debut' => 'datetime',
            'date_fin' => 'datetime',
            'montant_total' => 'decimal:2',
        ];
    }

    public function utilisateur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'utilisateur_id');
    }

    public function terrain(): BelongsTo
    {
        return $this->belongsTo(Terrain::class)->withTrashed();
    }

    public function paiements(): HasMany
    {
        return $this->hasMany(Paiement::class);
    }
}