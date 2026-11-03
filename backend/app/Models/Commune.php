<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Commune extends Model
{
    protected $table = 'communes';

    public $timestamps = false;

    protected $fillable = ['nom'];

    public function terrains(): HasMany
    {
        return $this->hasMany(Terrain::class);
    }
}