<?php

namespace App\Http\Requests;

use App\Models\Terrain;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreIndisponibiliteRequest extends FormRequest
{
    public function authorize(): bool
    {
        $terrain = $this->route('terrain');

        return $terrain instanceof Terrain && ($this->user()?->can('update', $terrain) ?? false);
    }

    public function rules(): array
    {
        return [
            'date_debut' => ['required', 'date'],
            'date_fin' => ['required', 'date', 'after:date_debut'],
            'motif' => ['nullable', 'string'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->has('date_debut') || $validator->errors()->has('date_fin')) {
                return;
            }

            if (strtotime($this->input('date_fin')) <= strtotime($this->input('date_debut'))) {
                $validator->errors()->add('date_fin', 'La fin doit être après le début.');
            }
        }];
    }
}