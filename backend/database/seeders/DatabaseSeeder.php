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

        // User::factory(10)->create();

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
