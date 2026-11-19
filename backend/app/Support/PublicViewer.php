<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;

/**
 * Personne qui consulte une page publique (liste, carte, fiche d'un terrain).
 * Ces routes ne demandent pas de connexion : on lit la session si elle existe,
 * et un compte désactivé est traité comme un visiteur anonyme.
 */
class PublicViewer
{
    public static function from(Request $request): ?User
    {
        $user = $request->user('sanctum');

        return $user instanceof User && $user->statut ? $user : null;
    }
}
