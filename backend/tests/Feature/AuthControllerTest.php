<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Commune;
use App\Models\Reservation;
use App\Models\Terrain;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class AuthControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_can_register_and_authenticate_with_the_spa_session(): void
    {
        $response = $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173',
        ])->postJson('/api/register', [
            'nom' => 'Diallo',
            'prenom' => 'Awa',
            'email' => 'awa@example.com',
            'telephone' => '7700000000',
            'role' => User::ROLE_ADMINISTRATEUR,
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('user.role', User::ROLE_CLIENT);

        $user = User::where('email', 'awa@example.com')->firstOrFail();
        $this->assertAuthenticatedAs($user, 'web');

        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173',
        ])->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.email', 'awa@example.com');

        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173',
        ])->postJson('/api/logout')->assertOk();

        $this->assertGuest('web');
    }

    public function test_registration_rejects_an_existing_email(): void
    {
        User::factory()->create(['email' => 'awa@example.com']);

        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173',
        ])->postJson('/api/register', [
            'nom' => 'Diallo',
            'prenom' => 'Awa',
            'email' => 'awa@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_active_client_can_log_in_but_disabled_client_cannot(): void
    {
        User::factory()->create([
            'email' => 'active@example.com',
            'password' => 'Password123!',
        ]);

        $headers = [
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173',
        ];

        $this->withHeaders($headers)->postJson('/api/login', [
            'email' => 'active@example.com',
            'password' => 'Password123!',
        ])->assertOk()->assertJsonPath('user.email', 'active@example.com');

        $this->assertAuthenticatedAs(User::where('email', 'active@example.com')->firstOrFail(), 'web');
        $this->postJson('/api/logout')->assertOk();

        User::factory()->create([
            'email' => 'disabled@example.com',
            'password' => 'Password123!',
            'statut' => false,
        ]);

        $this->withHeaders($headers)->postJson('/api/login', [
            'email' => 'disabled@example.com',
            'password' => 'Password123!',
        ])->assertUnprocessable();

        $this->assertGuest('web');
    }

    public function test_session_routes_reject_unauthenticated_requests(): void
    {
        $headers = [
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173',
        ];

        $this->withHeaders($headers)->getJson('/api/user')->assertUnauthorized();
        $this->withHeaders($headers)->postJson('/api/logout')->assertUnauthorized();
    }

    public function test_only_administrators_can_assign_supported_roles(): void
    {
        $client = User::factory()->create(['role' => User::ROLE_CLIENT]);
        $target = User::factory()->create();
        $path = '/api/admin/users/'.$target->id.'/role';

        $this->actingAs($client, 'web')->patchJson($path, [
            'role' => User::ROLE_ADMINISTRATEUR,
        ])->assertForbidden();

        Auth::forgetGuards();
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $this->actingAs($manager, 'web')->patchJson($path, [
            'role' => User::ROLE_ADMINISTRATEUR,
        ])->assertForbidden();

        Auth::forgetGuards();
        $administrator = User::factory()->create(['role' => User::ROLE_ADMINISTRATEUR]);

        foreach (User::ROLES as $role) {
            $this->actingAs($administrator, 'web')->patchJson($path, [
                'role' => $role,
            ])->assertOk()->assertJsonPath('user.role', $role);
        }

        $this->actingAs($administrator, 'web')->patchJson($path, [
            'role' => 'SUPER_ADMIN',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('role');

        $this->patchJson('/api/admin/users/'.$administrator->id.'/role', [
            'role' => User::ROLE_CLIENT,
        ])->assertStatus(409);
    }

    public function test_administrator_can_filter_users_by_search_role_and_status(): void
    {
        User::factory()->create([
            'nom' => 'Diallo',
            'prenom' => 'Fatou',
            'email' => 'fatou@example.com',
            'role' => User::ROLE_CLIENT,
            'statut' => true,
        ]);
        User::factory()->create([
            'nom' => 'Diallo',
            'prenom' => 'Moussa',
            'email' => 'moussa@example.com',
            'role' => User::ROLE_CLIENT,
            'statut' => false,
        ]);
        $administrator = User::factory()->create(['role' => User::ROLE_ADMINISTRATEUR]);

        $this->actingAs($administrator, 'web')
            ->getJson('/api/admin/users?search=Fatou&role=CLIENT&statut=actif')
            ->assertOk()
            ->assertJsonPath('users.total', 1)
            ->assertJsonPath('users.data.0.email', 'fatou@example.com');
    }

    public function test_role_workspaces_are_scoped_to_the_authenticated_actor(): void
    {
        $client = User::factory()->create(['role' => User::ROLE_CLIENT]);
        $otherClient = User::factory()->create(['role' => User::ROLE_CLIENT]);
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $otherManager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $administrator = User::factory()->create(['role' => User::ROLE_ADMINISTRATEUR]);

        $terrain = Terrain::create([
            'gestionnaire_id' => $manager->id,
            'nom' => 'Terrain Centre',
            'adresse' => '12 rue Centrale',
            'ville' => 'Dakar',
            'type' => 'Football',
            'capacite' => 22,
            'tarif_horaire' => 15000,
        ]);

        Terrain::create([
            'gestionnaire_id' => $otherManager->id,
            'nom' => 'Terrain Nord',
            'adresse' => '8 rue du Nord',
            'ville' => 'Dakar',
            'type' => 'Football',
            'capacite' => 22,
            'tarif_horaire' => 12000,
        ]);

        $startsAt = now()->addDay();
        $reservation = Reservation::create([
            'utilisateur_id' => $client->id,
            'terrain_id' => $terrain->id,
            'date_debut' => $startsAt,
            'date_fin' => $startsAt->copy()->addHour(),
            'montant_total' => 15000,
        ]);

        Reservation::create([
            'utilisateur_id' => $otherClient->id,
            'terrain_id' => $terrain->id,
            'date_debut' => $startsAt->copy()->addDays(2),
            'date_fin' => $startsAt->copy()->addDays(2)->addHour(),
            'montant_total' => 15000,
        ]);

        $this->actingAs($client, 'web')
            ->getJson('/api/client/reservations')
            ->assertOk()
            ->assertJsonCount(1, 'reservations')
            ->assertJsonPath('reservations.0.id', $reservation->id);

        $this->getJson('/api/gestionnaire/terrains')->assertForbidden();


        Auth::forgetGuards();
        $this->actingAs($manager, 'web')
            ->getJson('/api/gestionnaire/terrains')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $terrain->id);

        $this->getJson('/api/client/reservations')->assertForbidden();
        $this->getJson('/api/admin/users')->assertForbidden();

        Auth::forgetGuards();
        $this->actingAs($administrator, 'web')
            ->getJson('/api/admin/users')
            ->assertOk()
            ->assertJsonPath('users.total', 5);

        $this->getJson('/api/client/reservations')->assertForbidden();
        $this->getJson('/api/gestionnaire/terrains')->assertForbidden();
    }

    public function test_only_managers_can_create_terrain_with_dakar_location(): void
    {
        $client = User::factory()->create(['role' => User::ROLE_CLIENT]);
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $commune = Commune::create(['nom' => 'Médina']);
        $terrain = [
            'commune_id' => $commune->id,
            'nom' => 'Terrain Médina',
            'quartier' => 'Angle Mousse',
            'adresse' => '12 rue Centrale',
            'type' => 'Football',
            'capacite' => 22,
            'tarif_horaire' => 15000,
            'latitude' => 14.6781234,
            'longitude' => -17.4456789,
        ];

        $this->actingAs($client, 'web')
            ->postJson('/api/gestionnaire/terrains', $terrain)
            ->assertForbidden();

        Auth::forgetGuards();
        $this->actingAs($manager, 'web')
            ->getJson('/api/gestionnaire/communes')
            ->assertOk()
            ->assertJsonPath('communes.0.nom', 'Médina');

        $response = $this->postJson('/api/gestionnaire/terrains', $terrain)
            ->assertCreated()
            ->assertJsonPath('terrain.ville', 'Dakar')
            ->assertJsonPath('terrain.commune.nom', 'Médina')
            ->assertJsonPath('terrain.quartier', 'Angle Mousse');

        $this->assertDatabaseHas('terrains', [
            'id' => $response->json('terrain.id'),
            'gestionnaire_id' => $manager->id,
            'commune_id' => $commune->id,
            'ville' => 'Dakar',
            'latitude' => '14.6781234',
            'longitude' => '-17.4456789',
        ]);

        $this->postJson('/api/gestionnaire/terrains', array_merge($terrain, ['ville' => 'Saint-Louis']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('ville');

        $this->postJson('/api/gestionnaire/terrains', array_merge($terrain, ['longitude' => 181]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('longitude');
    }

}
