<?php

namespace App\Http\Requests;

use App\Models\Terrain;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateTerrainRequest extends FormRequest
{
    public function authorize(): bool
    {
        $terrain = $this->route('terrain');

        return $terrain instanceof Terrain && ($this->user()?->can('update', $terrain) ?? false);
    }

    public function rules(): array
    {
        return [
            'commune_id' => ['sometimes', 'required', 'integer', 'exists:communes,id'],
            'nom' => ['sometimes', 'required', 'string', 'max:150'],
            'description' => ['sometimes', 'nullable', 'string'],
            'adresse' => ['sometimes', 'required', 'string', 'max:255'],
            'ville' => ['sometimes', 'string', Rule::in(['Dakar'])],
            'quartier' => ['sometimes', 'required', 'string', 'max:100'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'type' => ['sometimes', 'required', 'string', 'max:100'],
            'capacite' => ['sometimes', 'required', 'integer', 'min:1'],
            'tarif_horaire' => ['sometimes', 'required', 'numeric', 'min:0'],
            'statut' => ['sometimes', 'required', Rule::in(['ACTIF', 'INACTIF'])],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->has('latitude') || $validator->errors()->has('longitude')) {
                return;
            }

            if (! $this->exists('latitude') && ! $this->exists('longitude')) {
                return;
            }

            $terrain = $this->route('terrain');
            $latitude = $this->input('latitude', $terrain->latitude);
            $longitude = $this->input('longitude', $terrain->longitude);

            if (($latitude === null) !== ($longitude === null)) {
                $validator->errors()->add('latitude', 'La latitude et la longitude doivent être renseignées ensemble.');

                return;
            }

            if ($latitude !== null && ! \App\Support\DakarBounds::contains((float) $latitude, (float) $longitude)) {
                $validator->errors()->add('latitude', 'Les coordonnées sont en dehors du périmètre configuré de Dakar.');
            }
        }];
    }
}