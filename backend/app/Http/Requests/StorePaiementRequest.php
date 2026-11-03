<?php

namespace App\Http\Requests;

use App\Models\Reservation;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePaiementRequest extends FormRequest
{
    public function authorize(): bool
    {
        $reservation = $this->route('reservation');

        return $reservation instanceof Reservation && ($this->user()?->can('pay', $reservation) ?? false);
    }

    public function rules(): array
    {
        return [
            'methode' => ['required', 'string', Rule::in([
                'WAVE',
                'ORANGE_MONEY',
                'FREE_MONEY',
                'ESPECES',
                'CARTE',
            ])],
            'reference_transaction' => ['nullable', 'required_unless:methode,ESPECES', 'string', 'max:255'],
        ];
    }
}