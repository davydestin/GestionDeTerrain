<?php

namespace App\Policies;

use App\Models\Reservation;
use App\Models\User;

class ReservationPolicy
{
    public function cancel(User $user, Reservation $reservation): bool
    {
        return $user->statut
            && $user->role === User::ROLE_CLIENT
            && (int) $reservation->utilisateur_id === (int) $user->id;
    }

    public function pay(User $user, Reservation $reservation): bool
    {
        return $user->statut
            && $user->role === User::ROLE_CLIENT
            && (int) $reservation->utilisateur_id === (int) $user->id;
    }

    public function manage(User $user, Reservation $reservation): bool
    {
        return $user->statut
            && $user->role === User::ROLE_GESTIONNAIRE
            && (int) $reservation->terrain()->withTrashed()->value('gestionnaire_id') === (int) $user->id;
    }
}