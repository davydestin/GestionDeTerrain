<?php

namespace App\Http\Requests;

use App\Models\User;
use App\Support\DakarBounds;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ReverseGeocodeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === User::ROLE_GESTIONNAIRE;
    }

    public function rules(): array
    {
        return [
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            if (! DakarBounds::contains((float) $this->input('latitude'), (float) $this->input('longitude'))) {
                $validator->errors()->add('latitude', 'Cette position est en dehors du périmètre de Dakar.');
            }
        }];
    }
}
