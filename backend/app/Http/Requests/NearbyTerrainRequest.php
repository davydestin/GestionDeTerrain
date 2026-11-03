<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class NearbyTerrainRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'radius' => ['sometimes', 'numeric', 'gt:0', 'max:50000'],
            'limit' => ['sometimes', 'integer', 'between:1,100'],
            'commune_id' => ['sometimes', 'integer', 'exists:communes,id'],
            'commune' => ['sometimes', 'string', 'max:100'],
            'quartier' => ['sometimes', 'string', 'max:100'],
            'type' => ['sometimes', 'string', 'max:100'],
            'min_price' => ['sometimes', 'numeric', 'min:0'],
            'max_price' => ['sometimes', 'numeric', 'min:0'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($this->filled('min_price') && $this->filled('max_price')
                && (float) $this->input('max_price') < (float) $this->input('min_price')) {
                $validator->errors()->add('max_price', 'Le prix maximal doit être supérieur ou égal au prix minimal.');
            }
        }];
    }
}