<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TerrainImage extends Model
{
    protected $table = 'terrain_images';

    public $timestamps = false;

    protected $fillable = [
        'terrain_id',
        'chemin_image',
        'est_principale',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'est_principale' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    public function terrain(): BelongsTo
    {
        return $this->belongsTo(Terrain::class);
    }
}