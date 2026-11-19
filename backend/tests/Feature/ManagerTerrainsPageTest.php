<?php

namespace Tests\Feature;

use App\Models\Commune;
use App\Models\Reservation;
use App\Models\Terrain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class ManagerTerrainsPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_listing_contains_counters_filters_and_global_stats(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $client = User::factory()->create();
        $football = $this->terrain($manager, ['nom' => 'Alpha Football', 'type' => 'Football']);
        $gazon = $this->terrain($manager, ['nom' => 'Beta Gazon', 'type' => 'Gazon naturel', 'statut' => 'INACTIF']);
        $this->terrain(User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]), ['nom' => 'Autre gestionnaire']);

        $football->horaires()->create(['jour_semaine' => 1, 'heure_ouverture' => '08:00', 'heure_fermeture' => '20:00', 'actif' => true]);
        $this->reservation($client, $football, now()->addDay(), 'EN_ATTENTE');
        $this->reservation($client, $football, now()->subDay(), 'CONFIRMEE');

        $response = $this->actingAs($manager, 'web')->getJson('/api/gestionnaire/terrains')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('stats.total', 2)
            ->assertJsonPath('stats.actifs', 1)
            ->assertJsonPath('stats.inactifs', 1)
            ->assertJsonPath('stats.sans_horaires', 1)
            ->assertJsonPath('stats.reservations_en_attente', 1);

        $alpha = collect($response->json('data'))->firstWhere('id', $football->id);
        $this->assertSame(2, $alpha['reservations_count']);
        $this->assertSame(1, $alpha['reservations_a_venir_count']);
        $this->assertSame(1, $alpha['reservations_en_attente_count']);
        $this->assertSame(1, $alpha['horaires_actifs_count']);
        $this->assertSame([], $alpha['images']);

        $this->getJson('/api/gestionnaire/terrains?search=gazon')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $gazon->id);

        $this->getJson('/api/gestionnaire/terrains?statut=ACTIF')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $football->id)
            ->assertJsonPath('stats.total', 2);

        $this->getJson('/api/gestionnaire/terrains?statut=AUTRE')->assertUnprocessable();
    }

    public function test_owner_can_open_the_management_sheet_of_an_inactive_terrain_others_cannot(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $terrain = $this->terrain($manager, ['statut' => 'INACTIF']);
        $terrain->horaires()->create(['jour_semaine' => 3, 'heure_ouverture' => '09:00', 'heure_fermeture' => '18:00', 'actif' => true]);

        $this->actingAs($manager, 'web')
            ->getJson('/api/gestionnaire/terrains/'.$terrain->id)
            ->assertOk()
            ->assertJsonPath('data.statut', 'INACTIF')
            ->assertJsonPath('data.commune.nom', 'Médina')
            ->assertJsonPath('data.horaires.0.jour_semaine', 3)
            ->assertJsonPath('data.horaires_actifs_count', 1);

        Auth::forgetGuards();
        $this->actingAs(User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]), 'web')
            ->getJson('/api/gestionnaire/terrains/'.$terrain->id)
            ->assertForbidden();
    }

    private function terrain(User $manager, array $overrides = []): Terrain
    {
        $commune = Commune::firstOrCreate(['nom' => 'Médina']);

        return $manager->terrains()->create($overrides + [
            'commune_id' => $commune->id,
            'nom' => 'Terrain',
            'adresse' => '1 rue Test',
            'ville' => 'Dakar',
            'quartier' => 'Médina',
            'latitude' => 14.68,
            'longitude' => -17.45,
            'type' => 'Football',
            'capacite' => 10,
            'tarif_horaire' => 10000,
            'statut' => 'ACTIF',
        ]);
    }

    private function reservation(User $client, Terrain $terrain, $start, string $statut): void
    {
        Reservation::create([
            'utilisateur_id' => $client->id,
            'terrain_id' => $terrain->id,
            'date_debut' => $start,
            'date_fin' => $start->copy()->addHour(),
            'montant_total' => 10000,
            'statut' => $statut,
        ]);
    }
}
