<?php

namespace App\Http\Requests;

use App\Models\Terrain;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreHoraireRequest extends FormRequest
{
    public function authorize(): bool
    {
        $terrain = $this->route('terrain');

        return $terrain instanceof Terrain && ($this->user()?->can('update', $terrain) ?? false);
    }

    public function rules(): array
    {
        $terrain = $this->route('terrain');

        return [
            'jour_semaine' => [
                'required',
                'integer',
                'between:1,7',
                Rule::unique('horaires', 'jour_semaine')->where('terrain_id', $terrain->id),
            ],
            'heure_ouverture' => ['required', 'date_format:H:i'],
            'heure_fermeture' => ['required', 'date_format:H:i'],
            'actif' => ['sometimes', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->has('heure_ouverture') || $validator->errors()->has('heure_fermeture')) {
                return;
            }

            if ($this->input('heure_fermeture') <= $this->input('heure_ouverture')) {
                $validator->errors()->add('heure_fermeture', 'La fermeture doit être après l’ouverture.');
            }
        }];
    }
}