<?php

namespace Tests\Feature;

use App\Models\Commune;
use App\Models\NotificationUtilisateur;
use App\Models\Reservation;
use App\Models\Terrain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class ReservationPaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_reservations_obey_hours_blocks_and_overlap_rules_and_notify_actors(): void
    {
        [$manager, $client, $terrain] = $this->createActorsAndTerrain();
        $start = now()->addDays(3)->setTime(10, 0, 0);
        $this->createHours($terrain, $start->isoWeekday());

        $this->getJson('/api/terrains/'.$terrain->id.'/disponibilites?date='.$start->toDateString())
            ->assertOk()
            ->assertJsonPath('ouvert', true)
            ->assertJsonCount(0, 'reservations');

        $managerBlockPath = '/api/gestionnaire/terrains/'.$terrain->id.'/indisponibilites';
        $this->actingAs($manager, 'web')->postJson($managerBlockPath, [
            'date_debut' => $start->copy()->addHours(4)->toDateTimeString(),
            'date_fin' => $start->copy()->addHours(5)->toDateTimeString(),
            'motif' => 'Entretien',
        ])->assertCreated();

        Auth::forgetGuards();
        $clientReservationPath = '/api/client/reservations';
        $this->actingAs($client, 'web')->postJson($clientReservationPath, [
            'terrain_id' => $terrain->id,
            'date_debut' => $start->copy()->addHours(4)->toDateTimeString(),
            'date_fin' => $start->copy()->addHours(5)->toDateTimeString(),
            'telephone_whatsapp' => '77 123 45 67',
        ])->assertStatus(409);

        $payload = [
            'terrain_id' => $terrain->id,
            'date_debut' => $start->toDateTimeString(),
            'date_fin' => $start->copy()->addHours(2)->toDateTimeString(),
            'telephone_whatsapp' => '77 123 45 67',
        ];
        $reservationResponse = $this->postJson($clientReservationPath, $payload)
            ->assertCreated()
            ->assertJsonPath('reservation.statut', 'EN_ATTENTE')
            ->assertJsonPath('reservation.montant_total', '30000.00');
        $reservationId = $reservationResponse->json('reservation.id');

        $this->postJson($clientReservationPath, array_merge($payload, [
            'date_debut' => $start->copy()->addHour()->toDateTimeString(),
            'date_fin' => $start->copy()->addHours(3)->toDateTimeString(),
        ]))->assertStatus(409);

        Auth::forgetGuards();
        $this->actingAs($manager, 'web')->postJson($managerBlockPath, [
            'date_debut' => $start->copy()->addMinutes(30)->toDateTimeString(),
            'date_fin' => $start->copy()->addHour()->toDateTimeString(),
            'motif' => 'Blocage en conflit',
        ])->assertStatus(409);

        $this->assertDatabaseHas('notifications', [
            'utilisateur_id' => $manager->id,
            'titre' => 'Nouvelle demande de réservation',
            'reservation_id' => $reservationId,
        ]);

        Auth::forgetGuards();
        $this->actingAs($manager, 'web')->postJson(
            '/api/gestionnaire/reservations/'.$reservationId.'/confirmer'
        )->assertOk()->assertJsonPath('reservation.statut', 'CONFIRMEE');

        Auth::forgetGuards();
        $this->actingAs($client, 'web')->postJson(
            '/api/client/reservations/'.$reservationId.'/annuler'
        )->assertOk()->assertJsonPath('reservation.statut', 'ANNULEE');

        $this->assertDatabaseHas('notifications', [
            'utilisateur_id' => $client->id,
            'titre' => 'Réservation confirmée',
        ]);
        $this->assertDatabaseHas('notifications', [
            'utilisateur_id' => $manager->id,
            'titre' => 'Réservation annulée',
        ]);

        $notification = NotificationUtilisateur::where('utilisateur_id', $client->id)->firstOrFail();
        $this->patchJson('/api/notifications/'.$notification->id.'/lu')
            ->assertOk()
            ->assertJsonPath('notification.lu', true);
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
            'type' => 'Football',
            'capacite' => 22,
            'tarif_horaire' => 15000,
            'statut' => 'ACTIF',
        ]);

        return [$manager, $client, $terrain];
    }

    private function createHours(Terrain $terrain, int $weekday): void
    {
        $terrain->horaires()->create([
            'jour_semaine' => $weekday,
            'heure_ouverture' => '09:00:00',
            'heure_fermeture' => '18:00:00',
            'actif' => true,
        ]);
    }
}
