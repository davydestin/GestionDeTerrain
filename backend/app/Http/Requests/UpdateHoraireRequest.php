<?php

namespace App\Http\Requests;

use App\Models\Horaire;
use App\Models\Terrain;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateHoraireRequest extends FormRequest
{
    public function authorize(): bool
    {
        $terrain = $this->route('terrain');
        $horaire = $this->route('horaire');

        return $terrain instanceof Terrain
            && $horaire instanceof Horaire
            && $horaire->terrain_id === $terrain->id
            && ($this->user()?->can('update', $terrain) ?? false);
    }

    public function rules(): array
    {
        $terrain = $this->route('terrain');
        $horaire = $this->route('horaire');

        return [
            'jour_semaine' => [
                'sometimes', 'required', 'integer', 'between:1,7',
                Rule::unique('horaires', 'jour_semaine')
                    ->where('terrain_id', $terrain->id)
                    ->ignore($horaire->id),
            ],
            'heure_ouverture' => ['sometimes', 'required', 'date_format:H:i'],
            'heure_fermeture' => ['sometimes', 'required', 'date_format:H:i'],
            'actif' => ['sometimes', 'required', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->has('heure_ouverture') || $validator->errors()->has('heure_fermeture')) {
                return;
            }

            $opening = $this->input('heure_ouverture', $this->route('horaire')->heure_ouverture);
            $closing = $this->input('heure_fermeture', $this->route('horaire')->heure_fermeture);

            if ($closing <= $opening) {
                $validator->errors()->add('heure_fermeture', 'La fermeture doit être après l’ouverture.');
            }
        }];
    }
}