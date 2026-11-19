<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Support\PhoneNumber;

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
        'motif_refus',
        'telephone_whatsapp',
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

    /** Numéro au format wa.me (ex. « 221771234567 »), ou null s'il est absent ou invalide. */
    public function whatsappNumber(): ?string
    {
        return PhoneNumber::toWhatsApp($this->telephone_whatsapp);
    }
}