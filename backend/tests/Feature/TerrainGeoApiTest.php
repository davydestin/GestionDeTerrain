<?php

namespace Tests\Feature;

use App\Models\Commune;
use App\Models\Terrain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TerrainGeoApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_manager_can_create_terrain_only_with_complete_dakar_coordinates(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $commune = Commune::create(['nom' => 'Dakar-Plateau']);
        $payload = $this->terrainPayload($commune, [
            'latitude' => 14.6700000,
            'longitude' => -17.4300000,
        ]);

        $this->actingAs($manager, 'web')->postJson('/api/gestionnaire/terrains', $payload)
            ->assertCreated()
            ->assertJsonPath('terrain.latitude', '14.6700000')
            ->assertJsonPath('terrain.longitude', '-17.4300000');

        $this->postJson('/api/gestionnaire/terrains', array_merge($payload, [
            'latitude' => 15.1,
            'longitude' => -17.43,
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors('latitude');

        $this->postJson('/api/gestionnaire/terrains', array_merge($payload, [
            'longitude' => null,
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors('longitude');
    }

    public function test_manager_cannot_create_terrain_without_a_selected_position(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $commune = Commune::create(['nom' => 'Dakar-Plateau']);
        $payload = $this->terrainPayload($commune, []);
        unset($payload['latitude'], $payload['longitude']);

        $this->actingAs($manager, 'web')
            ->postJson('/api/gestionnaire/terrains', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['latitude', 'longitude']);
    }

    public function test_manager_can_search_a_dakar_address_through_nominatim(): void
    {
        Cache::forget('nominatim:'.sha1('12 rue centrale, médina, dakar'));
        Http::fake([
            'https://nominatim.openstreetmap.org/*' => Http::response([[
                'lat' => '14.6700000',
                'lon' => '-17.4300000',
                'display_name' => '12 rue Centrale, Médina, Dakar, Sénégal',
                'address' => ['city' => 'Dakar', 'suburb' => 'Médina'],
            ]], 200),
        ]);

        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);

        $this->actingAs($manager, 'web')
            ->postJson('/api/gestionnaire/geocode', [
                'adresse' => '12 rue centrale',
                'quartier' => 'Médina',
                'ville' => 'Dakar',
            ])
            ->assertOk()
            ->assertJsonPath('results.0.latitude', 14.67)
            ->assertJsonPath('results.0.longitude', -17.43);
    }

    public function test_geocoding_rejects_results_outside_dakar(): void
    {
        Cache::forget('nominatim:'.sha1('1 rue test, dakar-plateau, dakar'));
        Http::fake([
            'https://nominatim.openstreetmap.org/*' => Http::response([[
                'lat' => '14.0000000',
                'lon' => '-17.4300000',
                'display_name' => 'Résultat hors zone',
            ]], 200),
        ]);

        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);

        $this->actingAs($manager, 'web')
            ->postJson('/api/gestionnaire/geocode', [
                'adresse' => '1 rue test',
                'quartier' => 'Dakar-Plateau',
                'ville' => 'Dakar',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Adresse introuvable dans le périmètre de Dakar.');
    }

    public function test_search_filters_by_commune_neighborhood_type_and_price(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $commune = Commune::create(['nom' => 'Dakar-Plateau']);
        $otherCommune = Commune::create(['nom' => 'Médina']);
        $matching = $this->createTerrain($manager, $commune, [
            'quartier' => 'Plateau Nord',
            'type' => 'Football',
            'tarif_horaire' => 15000,
        ]);
        $this->createTerrain($manager, $otherCommune, [
            'quartier' => 'Médina',
            'tarif_horaire' => 25000,
        ]);
        $this->createTerrain($manager, $commune, [
            'quartier' => 'Yoff',
            'latitude' => null,
            'longitude' => null,
        ]);

        $this->getJson('/api/terrains?commune_id='.$commune->id.'&quartier=Plateau&type=Football&min_price=10000&max_price=20000')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $matching->id);

        $this->getJson('/api/terrains?min_price=20000')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->getJson('/api/terrains')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_map_filters_visible_bounds_and_nearby_sorts_by_distance(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $commune = Commune::create(['nom' => 'Dakar-Plateau']);
        $near = $this->createTerrain($manager, $commune, [
            'nom' => 'Terrain central',
            'latitude' => 14.6700000,
            'longitude' => -17.4300000,
        ]);
        $this->createTerrain($manager, $commune, [
            'nom' => 'Terrain voisin',
            'latitude' => 14.6800000,
            'longitude' => -17.4300000,
        ]);
        $outsideViewport = $this->createTerrain($manager, $commune, [
            'nom' => 'Terrain hors carte',
            'latitude' => 14.75,
            'longitude' => -17.43,
        ]);

        $mapPath = '/api/terrains/map?south=14.66&north=14.69&west=-17.44&east=-17.42';
        $this->getJson($mapPath)
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.latitude', '14.6700000');

        $this->getJson('/api/terrains/map?south=14.66')
            ->assertUnprocessable();

        $this->getJson('/api/terrains/nearby?latitude=14.67&longitude=-17.43&radius=3000')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $near->id)
            ->assertJsonPath('data.0.distance_m', 0);

        $this->assertNotSame($near->id, $outsideViewport->id);
    }

    public function test_public_communes_endpoint_returns_sorted_communes(): void
    {
        Commune::create(['nom' => 'Yoff']);
        Commune::create(['nom' => 'Médina']);

        $this->getJson('/api/communes')
            ->assertOk()
            ->assertJsonPath('data.0.nom', 'Médina')
            ->assertJsonPath('data.1.nom', 'Yoff');
    }

    private function createTerrain(User $manager, Commune $commune, array $overrides = []): Terrain
    {
        return $manager->terrains()->create(array_merge([
            'commune_id' => $commune->id,
            'nom' => 'Terrain Dakar',
            'description' => 'Terrain de test',
            'adresse' => 'Dakar-Plateau',
            'ville' => 'Dakar',
            'quartier' => 'Plateau',
            'type' => 'Football',
            'capacite' => 22,
            'tarif_horaire' => 15000,
            'statut' => 'ACTIF',
            'latitude' => 14.6700000,
            'longitude' => -17.4300000,
        ], $overrides));
    }

    private function terrainPayload(Commune $commune, array $coordinates): array
    {
        return array_merge([
            'commune_id' => $commune->id,
            'nom' => 'Terrain Dakar',
            'adresse' => 'Dakar-Plateau',
            'quartier' => 'Plateau',
            'type' => 'Football',
            'capacite' => 22,
            'tarif_horaire' => 15000,
        ], $coordinates);
    }
}
