<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class MapTerrainRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'commune_id' => ['sometimes', 'integer', 'exists:communes,id'],
            'commune' => ['sometimes', 'string', 'max:100'],
            'quartier' => ['sometimes', 'string', 'max:100'],
            'type' => ['sometimes', 'string', 'max:100'],
            'min_price' => ['sometimes', 'numeric', 'min:0'],
            'max_price' => ['sometimes', 'numeric', 'min:0'],
            'south' => ['sometimes', 'numeric', 'between:-90,90'],
            'north' => ['sometimes', 'numeric', 'between:-90,90'],
            'west' => ['sometimes', 'numeric', 'between:-180,180'],
            'east' => ['sometimes', 'numeric', 'between:-180,180'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            if ($this->filled('min_price') && $this->filled('max_price')
                && (float) $this->input('max_price') < (float) $this->input('min_price')) {
                $validator->errors()->add('max_price', 'Le prix maximal doit être supérieur ou égal au prix minimal.');
            }

            $providedBounds = collect(['south', 'north', 'west', 'east'])
                ->filter(fn (string $bound) => $this->filled($bound));

            if ($providedBounds->isNotEmpty() && $providedBounds->count() !== 4) {
                foreach (['south', 'north', 'west', 'east'] as $bound) {
                    if (! $this->filled($bound)) {
                        $validator->errors()->add($bound, 'Les quatre limites de la zone visible sont requises.');
                    }
                }

                return;
            }

            if ($this->filled('south') && (float) $this->input('south') >= (float) $this->input('north')) {
                $validator->errors()->add('north', 'La latitude nord doit dépasser la latitude sud.');
            }

            if ($this->filled('west') && (float) $this->input('west') >= (float) $this->input('east')) {
                $validator->errors()->add('east', 'La longitude est doit dépasser la longitude ouest.');
            }
        }];
    }
}