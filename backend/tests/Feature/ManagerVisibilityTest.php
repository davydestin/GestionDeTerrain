<?php

namespace Tests\Feature;

use App\Models\Commune;
use App\Models\Terrain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

/**
 * Règle : un gestionnaire ne voit que ses propres terrains (liste, carte, à proximité, fiche,
 * disponibilités, espace de gestion), sauf sur la page d'accueil (« Terrains à la une »).
 */
class ManagerVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private User $alice;

    private User $bruno;

    private Terrain $terrainAlice;

    private Terrain $terrainBruno;

    protected function setUp(): void
    {
        parent::setUp();

        $this->alice = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $this->bruno = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $this->terrainAlice = $this->terrain($this->alice, 'Terrain Alice', 14.680, -17.450);
        $this->terrainBruno = $this->terrain($this->bruno, 'Terrain Bruno', 14.682, -17.452);
    }

    public function test_manager_only_sees_own_terrains_in_public_list_map_and_nearby(): void
    {
        $this->actingAs($this->alice, 'web');

        $this->getJson('/api/terrains')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nom', 'Terrain Alice');

        $this->getJson('/api/terrains/map')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nom', 'Terrain Alice');

        $this->getJson('/api/terrains/nearby?latitude=14.681&longitude=-17.451&radius=2000')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nom', 'Terrain Alice');
    }

    public function test_manager_cannot_open_another_managers_terrain(): void
    {
        $this->actingAs($this->alice, 'web');
        $date = now()->addDay()->toDateString();

        // Pages publiques : le terrain de Bruno est « introuvable » pour Alice.
        $this->getJson('/api/terrains/'.$this->terrainBruno->id)->assertNotFound();
        $this->getJson('/api/terrains/'.$this->terrainBruno->id.'/disponibilites?date='.$date)->assertNotFound();
        $this->getJson('/api/terrains/'.$this->terrainAlice->id)->assertOk();
        $this->getJson('/api/terrains/'.$this->terrainAlice->id.'/disponibilites?date='.$date)->assertOk();

        // Espace de gestion : déjà réservé au propriétaire.
        $this->getJson('/api/gestionnaire/terrains')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/gestionnaire/terrains/'.$this->terrainBruno->id)->assertForbidden();
        $this->patchJson('/api/gestionnaire/terrains/'.$this->terrainBruno->id, ['nom' => 'Piraté'])->assertForbidden();
        $this->getJson('/api/gestionnaire/terrains/'.$this->terrainBruno->id.'/horaires')->assertForbidden();
        $this->getJson('/api/gestionnaire/terrains/'.$this->terrainBruno->id.'/indisponibilites')->assertForbidden();
        $this->putJson('/api/gestionnaire/terrains/'.$this->terrainBruno->id.'/disponibilite', ['etat' => 'INDISPONIBLE'])->assertForbidden();
        $this->assertDatabaseHas('terrains', ['id' => $this->terrainBruno->id, 'nom' => 'Terrain Bruno', 'statut' => 'ACTIF']);
    }

    public function test_home_page_shows_all_terrains_and_flags_the_managers_own(): void
    {
        $this->actingAs($this->alice, 'web');

        $response = $this->getJson('/api/terrains/a-la-une')->assertOk()->assertJsonCount(2, 'data');
        $flags = collect($response->json('data'))->pluck('est_a_moi', 'nom');

        $this->assertTrue($flags['Terrain Alice']);
        $this->assertFalse($flags['Terrain Bruno']);
    }

    public function test_visitors_clients_and_admins_still_see_every_terrain(): void
    {
        $this->getJson('/api/terrains')->assertJsonCount(2, 'data');
        $this->getJson('/api/terrains/'.$this->terrainBruno->id)->assertOk();
        $this->getJson('/api/terrains/a-la-une')->assertJsonCount(2, 'data')->assertJsonPath('data.0.est_a_moi', false);

        foreach ([User::ROLE_CLIENT, User::ROLE_ADMINISTRATEUR] as $role) {
            Auth::forgetGuards();
            $this->actingAs(User::factory()->create(['role' => $role]), 'web');
            $this->getJson('/api/terrains')->assertJsonCount(2, 'data');
            $this->getJson('/api/terrains/map')->assertJsonCount(2, 'data');
            $this->getJson('/api/terrains/'.$this->terrainBruno->id)->assertOk();
        }
    }

    private function terrain(User $manager, string $nom, float $latitude, float $longitude): Terrain
    {
        return $manager->terrains()->create([
            'commune_id' => Commune::firstOrCreate(['nom' => 'Médina'])->id,
            'nom' => $nom,
            'adresse' => '1 rue Test',
            'ville' => 'Dakar',
            'quartier' => 'Médina',
            'latitude' => $latitude,
            'longitude' => $longitude,
            'type' => 'Football',
            'capacite' => 10,
            'tarif_horaire' => 10000,
            'statut' => 'ACTIF',
        ]);
    }
}
