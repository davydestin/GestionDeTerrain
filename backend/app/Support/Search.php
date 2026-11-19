<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Recherche textuelle insensible à la casse, quelle que soit la base :
 * MySQL l'est déjà avec « like », PostgreSQL a besoin de « ilike ».
 */
class Search
{
    public static function like(): string
    {
        return DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
    }
}
