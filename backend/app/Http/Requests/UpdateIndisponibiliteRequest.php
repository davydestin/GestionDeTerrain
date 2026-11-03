<?php

namespace App\Http\Requests;

use App\Models\Indisponibilite;
use App\Models\Terrain;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateIndisponibiliteRequest extends FormRequest
{
    public function authorize(): bool
    {
        $terrain = $this->route('terrain');
        $indisponibilite = $this->route('indisponibilite');

        return $terrain instanceof Terrain
            && $indisponibilite instanceof Indisponibilite
            && $indisponibilite->terrain_id === $terrain->id
            && ($this->user()?->can('update', $terrain) ?? false);
    }

    public function rules(): array
    {
        return [
            'date_debut' => ['sometimes', 'required', 'date'],
            'date_fin' => ['sometimes', 'required', 'date'],
            'motif' => ['sometimes', 'nullable', 'string'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->has('date_debut') || $validator->errors()->has('date_fin')) {
                return;
            }

            $start = $this->input('date_debut', $this->route('indisponibilite')->date_debut?->toDateTimeString());
            $end = $this->input('date_fin', $this->route('indisponibilite')->date_fin?->toDateTimeString());

            if (strtotime($end) <= strtotime($start)) {
                $validator->errors()->add('date_fin', 'La fin doit être après le début.');
            }
        }];
    }
}