<?php

namespace App\Policies;

use App\Models\Terrain;
use App\Models\User;

class TerrainPolicy
{
    public function create(User $user): bool
    {
        return $user->statut && $user->role === User::ROLE_GESTIONNAIRE;
    }

    public function update(User $user, Terrain $terrain): bool
    {
        return $user->statut
            && $user->role === User::ROLE_GESTIONNAIRE
            && $terrain->gestionnaire_id === $user->id;
    }

    public function delete(User $user, Terrain $terrain): bool
    {
        return $this->update($user, $terrain);
    }
}