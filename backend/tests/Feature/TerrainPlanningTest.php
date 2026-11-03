<?php

namespace Tests\Feature;

use App\Models\Commune;
use App\Models\Terrain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class TerrainPlanningTest extends TestCase
{
    use RefreshDatabase;

    public function test_manager_can_manage_consistent_opening_hours_for_owned_terrain(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $terrain = $this->createTerrain($manager);
        $basePath = '/api/gestionnaire/terrains/'.$terrain->id.'/horaires';

        $this->actingAs($manager, 'web')->postJson($basePath, [
            'jour_semaine' => 1,
            'heure_ouverture' => '08:00',
            'heure_fermeture' => '20:00',
        ])->assertCreated()
            ->assertJsonPath('horaire.actif', true);

        $horaireId = $terrain->horaires()->firstOrFail()->id;

        $this->postJson($basePath, [
            'jour_semaine' => 1,
            'heure_ouverture' => '09:00',
            'heure_fermeture' => '18:00',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('jour_semaine');

        $this->postJson($basePath, [
            'jour_semaine' => 2,
            'heure_ouverture' => '20:00',
            'heure_fermeture' => '08:00',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('heure_fermeture');

        $this->putJson($basePath.'/'.$horaireId, ['actif' => false])
            ->assertOk()
            ->assertJsonPath('horaire.actif', false);

        $this->getJson($basePath)->assertOk()->assertJsonCount(1, 'horaires');
        $this->deleteJson($basePath.'/'.$horaireId)->assertNoContent();
    }

    public function test_only_owner_can_manage_hours_and_unavailability(): void
    {
        $owner = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $otherManager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $client = User::factory()->create(['role' => User::ROLE_CLIENT]);
        $terrain = $this->createTerrain($owner);
        $horaire = $terrain->horaires()->create([
            'jour_semaine' => 1,
            'heure_ouverture' => '08:00',
            'heure_fermeture' => '20:00',
            'actif' => true,
        ]);
        $indisponibilite = $terrain->indisponibilites()->create([
            'date_debut' => now()->addDay(),
            'date_fin' => now()->addDay()->addHours(2),
            'motif' => 'Entretien',
        ]);

        $horairePath = '/api/gestionnaire/terrains/'.$terrain->id.'/horaires/'.$horaire->id;
        $indisponibilitePath = '/api/gestionnaire/terrains/'.$terrain->id.'/indisponibilites';

        $this->actingAs($otherManager, 'web')->getJson('/api/gestionnaire/terrains/'.$terrain->id.'/horaires')
            ->assertForbidden();

        Auth::forgetGuards();
        $this->actingAs($client, 'web')->deleteJson($horairePath)->assertForbidden();

        Auth::forgetGuards();
        $this->actingAs($otherManager, 'web')->putJson($indisponibilitePath.'/'.$indisponibilite->id, [
            'motif' => 'Tentative externe',
        ])->assertForbidden();

        Auth::forgetGuards();
        $this->actingAs($owner, 'web')->putJson($indisponibilitePath.'/'.$indisponibilite->id, [
            'motif' => 'Maintenance planifiée',
        ])->assertOk()->assertJsonPath('indisponibilite.motif', 'Maintenance planifiée');

        $this->deleteJson($indisponibilitePath.'/'.$indisponibilite->id)->assertNoContent();
    }

    public function test_unavailability_requires_a_valid_period_and_can_be_created(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $terrain = $this->createTerrain($manager);
        $path = '/api/gestionnaire/terrains/'.$terrain->id.'/indisponibilites';
        $start = now()->addDays(3)->startOfHour();
        $end = $start->copy()->addHours(2);

        $this->actingAs($manager, 'web')->postJson($path, [
            'date_debut' => $start->toDateTimeString(),
            'date_fin' => $start->copy()->subMinute()->toDateTimeString(),
            'motif' => 'Entretien',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('date_fin');

        $this->postJson($path, [
            'date_debut' => $start->toDateTimeString(),
            'date_fin' => $end->toDateTimeString(),
            'motif' => 'Entretien',
        ])->assertCreated()
            ->assertJsonPath('indisponibilite.motif', 'Entretien');
    }

    private function createTerrain(User $manager): Terrain
    {
        $commune = Commune::firstOrCreate(['nom' => 'Médina']);

        return $manager->terrains()->create([
            'commune_id' => $commune->id,
            'nom' => 'Terrain Test',
            'adresse' => '12 rue Centrale',
            'ville' => 'Dakar',
            'quartier' => 'Angle Mousse',
            'type' => 'Football',
            'capacite' => 22,
            'tarif_horaire' => 15000,
            'statut' => 'ACTIF',
        ]);
    }
}
