<?php

namespace App\Http\Controllers\Gestionnaire;

use App\Http\Controllers\Controller;
use App\Models\Commune;
use Illuminate\Http\JsonResponse;

class GestionnaireTerrainController extends Controller
{
    public function communes(): JsonResponse
    {
        return response()->json([
            'communes' => Commune::query()->orderBy('nom')->get(['id', 'nom']),
        ]);
    }
}