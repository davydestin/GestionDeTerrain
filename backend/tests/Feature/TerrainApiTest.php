<?php

namespace Tests\Feature;

use App\Models\Commune;
use App\Models\Reservation;
use App\Models\Terrain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class TerrainApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_list_and_detail_only_expose_active_dakar_terrains(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $activeTerrain = $this->createTerrain($manager);
        $this->createTerrain($manager, ['statut' => 'INACTIF']);
        $this->createTerrain($manager, ['ville' => 'Saint-Louis']);

        $this->getJson('/api/terrains')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $activeTerrain->id)
            ->assertJsonPath('data.0.commune.nom', 'Médina');

        $this->getJson('/api/terrains/'.$activeTerrain->id)
            ->assertOk()
            ->assertJsonPath('data.id', $activeTerrain->id)
            ->assertJsonPath('data.ville', 'Dakar');

        $inactiveTerrain = Terrain::where('statut', 'INACTIF')->firstOrFail();
        $this->getJson('/api/terrains/'.$inactiveTerrain->id)->assertNotFound();
    }

    public function test_only_the_owning_manager_can_update_or_delete_a_terrain(): void
    {
        $owner = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $otherManager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $terrain = $this->createTerrain($owner);
        $path = '/api/gestionnaire/terrains/'.$terrain->id;

        $this->actingAs($otherManager, 'web')
            ->patchJson($path, ['nom' => 'Tentative externe'])
            ->assertForbidden();

        Auth::forgetGuards();
        $this->actingAs($owner, 'web')
            ->patchJson($path, ['nom' => 'Terrain rénové'])
            ->assertOk()
            ->assertJsonPath('terrain.nom', 'Terrain rénové');

        $this->patchJson($path, ['ville' => 'Saint-Louis'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('ville');

        Auth::forgetGuards();
        $this->actingAs($otherManager, 'web')->deleteJson($path)->assertForbidden();

        Auth::forgetGuards();
        $this->actingAs($owner, 'web')->deleteJson($path)->assertNoContent();
        $this->assertSoftDeleted('terrains', ['id' => $terrain->id]);
    }

    public function test_soft_deleted_terrain_remains_available_to_reservation_history(): void
    {
        $owner = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $client = User::factory()->create(['role' => User::ROLE_CLIENT]);
        $terrain = $this->createTerrain($owner);
        $reservation = Reservation::create([
            'utilisateur_id' => $client->id,
            'terrain_id' => $terrain->id,
            'date_debut' => now()->addDay(),
            'date_fin' => now()->addDay()->addHour(),
            'montant_total' => 15000,
        ]);

        $this->actingAs($owner, 'web')
            ->deleteJson('/api/gestionnaire/terrains/'.$terrain->id)
            ->assertNoContent();

        $this->assertSoftDeleted('terrains', ['id' => $terrain->id]);
        $this->assertSame($terrain->id, $reservation->fresh()->terrain->id);
        $this->getJson('/api/terrains/'.$terrain->id)->assertNotFound();
    }

    public function test_guest_cannot_create_a_terrain(): void
    {
        $this->postJson('/api/gestionnaire/terrains', [])->assertUnauthorized();
    }

    public function test_client_cannot_create_update_or_delete_terrains(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $client = User::factory()->create(['role' => User::ROLE_CLIENT]);
        $terrain = $this->createTerrain($manager);
        $path = '/api/gestionnaire/terrains/'.$terrain->id;

        $this->actingAs($client, 'web')
            ->postJson('/api/gestionnaire/terrains', [])
            ->assertForbidden();

        Auth::forgetGuards();
        $this->actingAs($client, 'web')
            ->patchJson($path, ['nom' => 'Tentative client'])
            ->assertForbidden();

        Auth::forgetGuards();
        $this->actingAs($client, 'web')
            ->deleteJson($path)
            ->assertForbidden();

        $this->assertDatabaseHas('terrains', [
            'id' => $terrain->id,
            'nom' => 'Terrain Médina',
            'deleted_at' => null,
        ]);
    }

    private function createTerrain(User $manager, array $attributes = []): Terrain
    {
        $commune = Commune::firstOrCreate(['nom' => 'Médina']);

        return $manager->terrains()->create(array_merge([
            'commune_id' => $commune->id,
            'nom' => 'Terrain Médina',
            'description' => 'Terrain de test',
            'adresse' => '12 rue Centrale',
            'ville' => 'Dakar',
            'quartier' => 'Angle Mousse',
            'type' => 'Football',
            'capacite' => 22,
            'tarif_horaire' => 15000,
            'statut' => 'ACTIF',
        ], $attributes));
    }
}
