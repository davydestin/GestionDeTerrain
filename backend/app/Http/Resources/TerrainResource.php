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
            'reservations_a_venir_count' => $this->whenCounted('reservations_a_venir'),
            'reservations_en_attente_count' => $this->whenCounted('reservations_en_attente'),
            'horaires_actifs_count' => $this->whenCounted('horaires_actifs'),
            'horaires' => $this->whenLoaded('horaires'),
            // Renseigné uniquement par l'accueil (« à la une ») : le terrain appartient-il au gestionnaire connecté ?
            'est_a_moi' => $this->when(
                array_key_exists('est_a_moi', $this->resource->getAttributes()),
                fn () => (bool) $this->resource->getAttribute('est_a_moi'),
            ),
            'disponibilite' => $this->when(
                $this->relationLoaded('indisponibiliteEnCours'),
                fn () => $this->resource->disponibilite(),
            ),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}