<?php

namespace App\Http\Requests;

use App\Models\Terrain;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreTerrainRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Terrain::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'commune_id' => ['required', 'integer', 'exists:communes,id'],
            'nom' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'adresse' => ['required', 'string', 'max:255'],
            'ville' => ['sometimes', 'string', Rule::in(['Dakar'])],
            'quartier' => ['required', 'string', 'max:100'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'type' => ['required', 'string', 'max:100'],
            'capacite' => ['required', 'integer', 'min:1'],
            'tarif_horaire' => ['required', 'numeric', 'min:0'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->has('latitude') || $validator->errors()->has('longitude')) {
                return;
            }

            $latitude = $this->input('latitude');
            $longitude = $this->input('longitude');

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