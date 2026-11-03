<?php

namespace Database\Seeders;

use App\Models\Commune;
use Illuminate\Database\Seeder;

class CommuneSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([
            'Biscuiterie',
            'Cambérène',
            'Dakar-Plateau',
            'Dieuppeul-Derklé',
            'Fann-Point E-Amitié',
            'Gorée',
            'Grand Dakar',
            'Grand Yoff',
            'Gueule Tapée-Fass-Colobane',
            'Hann Bel-Air',
            'HLM',
            'Médina',
            'Mermoz-Sacré-Cœur',
            'Ngor',
            'Ouakam',
            'Parcelles Assainies',
            "Patte d'Oie",
            'Sicap-Liberté',
            'Yoff',
        ] as $nom) {
            Commune::firstOrCreate(['nom' => $nom]);
        }
    }
}