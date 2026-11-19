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
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
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

            // latitude et longitude sont obligatoires (cf. rules), il reste à vérifier le périmètre.
            if (! \App\Support\DakarBounds::contains((float) $this->input('latitude'), (float) $this->input('longitude'))) {
                $validator->errors()->add('latitude', 'Les coordonnées sont en dehors du périmètre configuré de Dakar.');
            }
        }];
    }
}
