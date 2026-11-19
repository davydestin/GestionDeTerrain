<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(CommuneSeeder::class);

        // En production (seeder relancé à chaque démarrage) : pas de comptes de démonstration ni de mot de passe
        // par défaut. L'administrateur est créé une seule fois, avec ADMIN_EMAIL / ADMIN_PASSWORD fournis par
        // l'hébergeur, puis son mot de passe n'est plus écrasé.
        if (app()->environment('production')) {
            if (filled(env('ADMIN_EMAIL')) && filled(env('ADMIN_PASSWORD'))) {
                User::firstOrCreate(['email' => env('ADMIN_EMAIL')], [
                    'nom' => 'Admin',
                    'prenom' => 'Gestion',
                    'password' => Hash::make(env('ADMIN_PASSWORD')),
                    'role' => User::ROLE_ADMINISTRATEUR,
                    'statut' => true,
                ]);
            }

            return;
        }

        User::updateOrCreate(['email' => env('ADMIN_EMAIL', 'admin@example.com')], [
            'nom' => 'Admin',
            'prenom' => 'Gestion',
            'telephone' => null,
            'password' => Hash::make(env('ADMIN_PASSWORD', 'Admin1234!')),
            'role' => User::ROLE_ADMINISTRATEUR,
            'statut' => true,
        ]);

        User::firstOrCreate(['email' => 'test@example.com'], [
            'nom' => 'Test',
            'prenom' => 'Utilisateur',
            'telephone' => null,
            'password' => Hash::make('password'),
            'role' => User::ROLE_CLIENT,
            'statut' => true,
        ]);

        // Compte de démonstration gestionnaire : identifiants créés comme le ferait l'administrateur.
        User::firstOrCreate(['email' => 'gestionnaire@example.com'], [
            'nom' => 'Test',
            'prenom' => 'Gestionnaire',
            'telephone' => null,
            'password' => Hash::make('password'),
            'role' => User::ROLE_GESTIONNAIRE,
            'statut' => true,
        ]);
    }
}
