<?php

namespace App\Http\Requests;

use App\Models\User;
use App\Support\PhoneNumber;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreReservationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->statut === true
            && $this->user()?->role === User::ROLE_CLIENT;
    }

    public function rules(): array
    {
        return [
            'terrain_id' => ['required', 'integer', 'exists:terrains,id'],
            'date_debut' => ['required', 'date', 'after:now'],
            'date_fin' => ['required', 'date', 'after:date_debut'],
            'commentaire' => ['nullable', 'string', 'max:500'],
            // Le gestionnaire contacte le client sur ce numéro pour convenir du paiement.
            'telephone_whatsapp' => ['required', 'string', 'max:25', function (string $attribute, mixed $value, \Closure $fail): void {
                if (! PhoneNumber::isValid($value)) {
                    $fail('Numéro WhatsApp invalide : utilisez un numéro sénégalais (ex. 77 123 45 67) ou un numéro avec indicatif (ex. +33 6 12 34 56 78).');
                }
            }],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->has('date_debut') || $validator->errors()->has('date_fin')) {
                return;
            }

            if (! Carbon::parse($this->input('date_debut'))->isSameDay(Carbon::parse($this->input('date_fin')))) {
                $validator->errors()->add('date_fin', 'Une réservation doit rester dans la même journée.');
            }
        }];
    }
}