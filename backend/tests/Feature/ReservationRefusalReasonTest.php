<?php

namespace Tests\Feature;

use App\Models\Commune;
use App\Models\Reservation;
use App\Models\Terrain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class ReservationRefusalReasonTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_sees_the_reason_given_by_the_manager_when_a_request_is_refused(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $client = User::factory()->create(['role' => User::ROLE_CLIENT]);
        $terrain = $this->terrain($manager);
        $withReason = $this->pending($client, $terrain, now()->addDays(2));
        $withoutReason = $this->pending($client, $terrain, now()->addDays(3));

        $this->actingAs($manager, 'web')
            ->postJson('/api/gestionnaire/reservations/'.$withReason->id.'/refuser', ['motif' => '  Terrain réservé pour un tournoi  '])
            ->assertOk()
            ->assertJsonPath('reservation.motif_refus', 'Terrain réservé pour un tournoi');
        $this->postJson('/api/gestionnaire/reservations/'.$withoutReason->id.'/refuser')
            ->assertOk()
            ->assertJsonPath('reservation.motif_refus', null);

        Auth::forgetGuards();
        $reservations = collect($this->actingAs($client, 'web')
            ->getJson('/api/client/reservations')
            ->assertOk()
            ->json('reservations'))->keyBy('id');

        $this->assertSame('REFUSEE', $reservations[$withReason->id]['statut']);
        $this->assertSame('Terrain réservé pour un tournoi', $reservations[$withReason->id]['motif_refus']);
        $this->assertNull($reservations[$withoutReason->id]['motif_refus']);
    }

    public function test_a_confirmed_request_has_no_refusal_reason(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $client = User::factory()->create(['role' => User::ROLE_CLIENT]);
        $reservation = $this->pending($client, $this->terrain($manager), now()->addDay());

        $this->actingAs($manager, 'web')
            ->postJson('/api/gestionnaire/reservations/'.$reservation->id.'/confirmer')
            ->assertOk()
            ->assertJsonPath('reservation.motif_refus', null);
    }

    private function terrain(User $manager): Terrain
    {
        return $manager->terrains()->create([
            'commune_id' => Commune::firstOrCreate(['nom' => 'Médina'])->id,
            'nom' => 'Terrain Refus',
            'adresse' => '12 rue Centrale',
            'ville' => 'Dakar',
            'latitude' => 14.68,
            'longitude' => -17.44,
            'type' => 'Gazon synthétique',
            'capacite' => 22,
            'tarif_horaire' => 15000,
            'statut' => 'ACTIF',
        ]);
    }

    private function pending(User $client, Terrain $terrain, $start): Reservation
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
