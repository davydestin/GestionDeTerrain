<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TerrainImageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'url' => $request->getSchemeAndHttpHost().route(
                'terrain-images.show',
                ['terrainImage' => $this->id],
                false
            ),
            'est_principale' => $this->est_principale,
            'created_at' => $this->created_at,
        ];
    }
}