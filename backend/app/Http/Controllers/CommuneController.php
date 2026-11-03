<?php

namespace App\Http\Controllers;

use App\Models\Commune;
use Illuminate\Http\JsonResponse;

class CommuneController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Commune::query()->orderBy('nom')->get(['id', 'nom']),
        ]);
    }
}