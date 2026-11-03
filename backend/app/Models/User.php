<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    public const ROLE_CLIENT = 'CLIENT';

    public const ROLE_GESTIONNAIRE = 'GESTIONNAIRE';

    public const ROLE_ADMINISTRATEUR = 'ADMINISTRATEUR';

    public const ROLES = [
        self::ROLE_CLIENT,
        self::ROLE_GESTIONNAIRE,
        self::ROLE_ADMINISTRATEUR,
    ];

    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'nom',
        'prenom',
        'email',
        'telephone',
        'password',
        'role',
        'statut',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'statut' => 'boolean',
        ];
    }

    public function terrains(): HasMany
    {
        return $this->hasMany(Terrain::class, 'gestionnaire_id');
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class, 'utilisateur_id');
    }

    public function notificationsUtilisateur(): HasMany
    {
        return $this->hasMany(NotificationUtilisateur::class, 'utilisateur_id');
    }
}
