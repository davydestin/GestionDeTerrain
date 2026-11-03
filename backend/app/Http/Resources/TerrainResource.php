<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TerrainResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nom' => $this->nom,
            'description' => $this->description,
            'adresse' => $this->adresse,
            'ville' => $this->ville,
            'commune_id' => $this->commune_id,
            'commune' => $this->whenLoaded('commune', fn () => [
                'id' => $this->commune->id,
                'nom' => $this->commune->nom,
            ]),
            'images' => TerrainImageResource::collection($this->whenLoaded('images')),
            'quartier' => $this->quartier,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'type' => $this->type,
            'capacite' => $this->capacite,
            'tarif_horaire' => $this->tarif_horaire,
            'statut' => $this->statut,
            'distance_m' => $this->when(isset($this->distance_m), $this->distance_m),
            'reservations_count' => $this->whenCounted('reservations'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}