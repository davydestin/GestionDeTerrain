<?php

namespace App\Http\Requests;

use App\Models\Terrain;
use Illuminate\Foundation\Http\FormRequest;

class StoreTerrainImagesRequest extends FormRequest
{
    public function authorize(): bool
    {
        $terrain = $this->route('terrain');

        return $terrain instanceof Terrain && ($this->user()?->can('update', $terrain) ?? false);
    }

    public function rules(): array
    {
        return [
            'images' => ['required', 'array', 'min:1', 'max:10'],
            'images.*' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'est_principale' => ['sometimes', 'boolean'],
        ];
    }
}