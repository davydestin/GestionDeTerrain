<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Deux façons de chercher :
 *  - `q` : texte libre tapé dans la barre de recherche de la carte ;
 *  - `adresse` + `quartier` (+ commune, ville, complément) : champs du formulaire.
 */
class GeocodeAddressRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === User::ROLE_GESTIONNAIRE;
    }

    public function rules(): array
    {
        return [
            'q' => ['nullable', 'required_without:adresse', 'string', 'min:3', 'max:255'],
            'adresse' => ['nullable', 'required_without:q', 'string', 'max:255'],
            'quartier' => ['nullable', 'required_with:adresse', 'string', 'max:100'],
            'commune' => ['nullable', 'string', 'max:100'],
            'ville' => ['nullable', 'string', 'max:100'],
            'complement' => ['nullable', 'string', 'max:255'],
        ];
    }
}
