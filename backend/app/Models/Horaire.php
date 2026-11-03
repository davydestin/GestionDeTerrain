<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Horaire extends Model
{
    protected $table = 'horaires';

    public $timestamps = false;

    protected $fillable = [
        'terrain_id',
        'jour_semaine',
        'heure_ouverture',
        'heure_fermeture',
        'actif',
    ];

    protected function casts(): array
    {
        return [
            'jour_semaine' => 'integer',
            'actif' => 'boolean',
        ];
    }

    public function terrain(): BelongsTo
    {
        return $this->belongsTo(Terrain::class);
    }
}