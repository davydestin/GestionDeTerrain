<?php

namespace App\Support;

class DakarBounds
{
    public static function contains(float $latitude, float $longitude): bool
    {
        $bounds = config('geography.dakar.bounds');

        return $latitude >= $bounds['south']
            && $latitude <= $bounds['north']
            && $longitude >= $bounds['west']
            && $longitude <= $bounds['east'];
    }
}