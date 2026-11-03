<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Indisponibilite extends Model
{
    protected $table = 'indisponibilites';

    public $timestamps = false;

    protected $fillable = [
        'terrain_id',
        'date_debut',
        'date_fin',
        'motif',
    ];

    protected function casts(): array
    {
        return [
            'date_debut' => 'datetime',
            'date_fin' => 'datetime',
        ];
    }

    public function terrain(): BelongsTo
    {
        return $this->belongsTo(Terrain::class);
    }
}