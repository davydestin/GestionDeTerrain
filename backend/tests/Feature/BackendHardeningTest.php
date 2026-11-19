<?php

namespace Tests\Feature;

use App\Models\Commune;
use App\Models\Reservation;
use App\Models\Terrain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BackendHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_deactivated_user_loses_access_even_with_an_open_session(): void
    {
        $administrator = User::factory()->create(['role' => User::ROLE_ADMINISTRATEUR]);

        $this->actingAs($administrator, 'web')->getJson('/api/admin/users')->assertOk();

        $administrator->forceFill(['statut' => false])->save();
        Auth::forgetGuards();

        $this->actingAs($administrator->fresh(), 'web')
            ->getJson('/api/admin/users')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Ce compte a été désactivé.');

        Auth::forgetGuards();
        $this->actingAs($administrator->fresh(), 'web')->getJson('/api/user')->assertUnauthorized();
    }

    public function test_admin_cannot_delete_a_user_with_history_but_can_delete_one_without(): void
    {
        $administrator = User::factory()->create(['role' => User::ROLE_ADMINISTRATEUR]);
        [$manager, $client, $terrain] = $this->createActorsAndTerrain();
        $this->createReservation($client, $terrain, now()->addDay());
        $freshUser = User::factory()->create();

        $this->actingAs($administrator, 'web')
            ->deleteJson('/api/admin/users/'.$client->id)
            ->assertConflict();
        $this->deleteJson('/api/admin/users/'.$manager->id)->assertConflict();

        $this->deleteJson('/api/admin/users/'.$freshUser->id)->assertOk();

        $this->assertDatabaseHas('users', ['id' => $client->id]);
        $this->assertDatabaseHas('users', ['id' => $manager->id]);
        $this->assertDatabaseMissing('users', ['id' => $freshUser->id]);
    }

    public function test_manager_cannot_confirm_a_past_reservation_but_can_refuse_it(): void
    {
        [$manager, $client, $terrain] = $this->createActorsAndTerrain();
        $past = $this->createReservation($client, $terrain, now()->subDay());

        $this->actingAs($manager, 'web')
            ->postJson('/api/gestionnaire/reservations/'.$past->id.'/confirmer')
            ->assertConflict();

        $this->postJson('/api/gestionnaire/reservations/'.$past->id.'/refuser')
            ->assertOk()
            ->assertJsonPath('reservation.statut', 'REFUSEE');
    }

    public function test_reservation_up_to_closing_time_is_accepted_whatever_the_stored_time_format(): void
    {
        [, $client, $terrain] = $this->createActorsAndTerrain();
        $day = now()->addDays(3);
        $terrain->horaires()->create([
            'jour_semaine' => $day->isoWeekday(),
            'heure_ouverture' => '09:00',
            'heure_fermeture' => '18:00',
            'actif' => true,
        ]);

        $this->actingAs($client, 'web')->postJson('/api/client/reservations', [
            'terrain_id' => $terrain->id,
            'date_debut' => $day->copy()->setTime(17, 0)->toDateTimeString(),
            'date_fin' => $day->copy()->setTime(18, 0)->toDateTimeString(),
            'telephone_whatsapp' => '771234567',
        ])->assertCreated();
    }

    public function test_owner_can_view_images_of_an_inactive_terrain_but_the_public_cannot(): void
    {
        Storage::fake('public');
        [$manager, , $terrain] = $this->createActorsAndTerrain();
        $terrain->update(['statut' => 'INACTIF']);
        Storage::disk('public')->put('terrains/'.$terrain->id.'/photo.jpg', 'contenu');
        $image = $terrain->images()->create([
            'chemin_image' => 'terrains/'.$terrain->id.'/photo.jpg',
            'est_principale' => true,
        ]);
        $path = '/api/terrain-images/'.$image->id;

        $this->get($path)->assertNotFound();

        $this->actingAs($manager, 'web')->get($path)->assertOk();

        Auth::forgetGuards();
        $otherManager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $this->actingAs($otherManager, 'web')->get($path)->assertNotFound();
    }

    public function test_terrain_creation_response_contains_the_default_status(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $commune = Commune::firstOrCreate(['nom' => 'Médina']);

        $this->actingAs($manager, 'web')->postJson('/api/gestionnaire/terrains', [
            'commune_id' => $commune->id,
            'nom' => 'Terrain neuf',
            'adresse' => '1 rue Test',
            'quartier' => 'Médina',
            'latitude' => 14.68,
            'longitude' => -17.45,
            'type' => 'Football',
            'capacite' => 10,
            'tarif_horaire' => 10000,
        ])->assertCreated()->assertJsonPath('terrain.statut', 'ACTIF');
    }

    public function test_geocoding_provider_refusal_is_reported_as_unavailable_not_as_bad_input(): void
    {
        Cache::flush();
        Http::fake(['https://nominatim.openstreetmap.org/*' => Http::response('Access denied.', 403)]);
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);

        $this->actingAs($manager, 'web')->postJson('/api/gestionnaire/geocode', [
            'adresse' => 'Avenue Blaise Diagne',
            'quartier' => 'Médina',
            'ville' => 'Dakar',
        ])->assertStatus(503)
            ->assertJsonPath('message', 'Le service de géocodage est temporairement indisponible.');
    }

    public function test_validation_messages_are_in_french(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);

        $this->actingAs($manager, 'web')
            ->postJson('/api/gestionnaire/terrains', ['capacite' => 0])
            ->assertUnprocessable()
            ->assertJsonPath('errors.nom.0', 'Le champ nom est obligatoire.')
            ->assertJsonPath('errors.capacite.0', 'Le champ capacité doit être au moins égal à 1.');
    }

    private function createActorsAndTerrain(): array
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $client = User::factory()->create(['role' => User::ROLE_CLIENT]);
        $commune = Commune::firstOrCreate(['nom' => 'Médina']);
        $terrain = $manager->terrains()->create([
            'commune_id' => $commune->id,
            'nom' => 'Terrain Test',
            'adresse' => '12 rue Centrale',
            'ville' => 'Dakar',
            'quartier' => 'Angle Mousse',
            'latitude' => 14.68,
            'longitude' => -17.44,
            'type' => 'Football',
            'capacite' => 22,
            'tarif_horaire' => 15000,
            'statut' => 'ACTIF',
        ]);

        return [$manager, $client, $terrain];
    }

    private function createReservation(User $client, Terrain $terrain, $start): Reservation
    {
        return Reservation::create([
            'utilisateur_id' => $client->id,
            'terrain_id' => $terrain->id,
            'date_debut' => $start,
            'date_fin' => $start->copy()->addHour(),
            'montant_total' => 15000,
            'statut' => 'EN_ATTENTE',
        ]);
    }
}
