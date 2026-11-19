<?php

namespace Tests\Feature;

use App\Models\Commune;
use App\Models\Reservation;
use App\Models\Terrain;
use App\Models\User;
use App\Support\PhoneNumber;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class WhatsappBookingFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_phone_numbers_are_normalised_for_whatsapp(): void
    {
        $this->assertSame('221771234567', PhoneNumber::toWhatsApp('77 123 45 67'));
        $this->assertSame('221771234567', PhoneNumber::toWhatsApp('+221 77-123-45-67'));
        $this->assertSame('221771234567', PhoneNumber::toWhatsApp('00221771234567'));
        $this->assertSame('33612345678', PhoneNumber::toWhatsApp('+33 6 12 34 56 78'));
        $this->assertNull(PhoneNumber::toWhatsApp('12345'));
        $this->assertNull(PhoneNumber::toWhatsApp('612345678'));
        $this->assertNull(PhoneNumber::toWhatsApp('+221 12 345'));
    }

    public function test_request_notifies_the_manager_who_confirms_and_gets_a_whatsapp_link(): void
    {
        [$manager, $client, $terrain] = $this->actors();
        $start = now()->addDays(2)->setTime(18, 0);
        $terrain->horaires()->create(['jour_semaine' => $start->isoWeekday(), 'heure_ouverture' => '08:00', 'heure_fermeture' => '23:00', 'actif' => true]);

        // 1. Le client réserve en donnant son numéro WhatsApp.
        $this->actingAs($client, 'web')->postJson('/api/client/reservations', [
            'terrain_id' => $terrain->id,
            'date_debut' => $start->toDateTimeString(),
            'date_fin' => $start->copy()->addHours(2)->toDateTimeString(),
            'telephone_whatsapp' => '77 123 45 67',
        ])->assertCreated();

        $reservation = Reservation::firstOrFail();
        $this->assertSame('221771234567', $reservation->telephone_whatsapp);
        $this->assertSame('+221771234567', $client->fresh()->telephone, 'Le numéro complète le profil vide.');

        // 2. Le gestionnaire voit la notification (non lue, liée à la réservation).
        Auth::forgetGuards();
        $this->actingAs($manager, 'web')->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('non_lues', 1)
            ->assertJsonPath('notifications.0.titre', 'Nouvelle demande de réservation')
            ->assertJsonPath('notifications.0.reservation_id', $reservation->id);

        $pending = $this->getJson('/api/gestionnaire/reservations?vue=en_attente')
            ->assertOk()
            ->assertJsonPath('compteurs.en_attente', 1)
            ->assertJsonPath('data.0.client.prenom', $client->prenom)
            ->assertJsonPath('data.0.telephone_whatsapp', '+221771234567');
        $this->assertStringStartsWith('https://wa.me/221771234567?text=', $pending->json('data.0.whatsapp_url'));

        // 3. Il valide : la réponse contient le lien WhatsApp avec un message de confirmation.
        $confirmed = $this->postJson('/api/gestionnaire/reservations/'.$reservation->id.'/confirmer')
            ->assertOk()
            ->assertJsonPath('reservation.statut', 'CONFIRMEE');
        $message = rawurldecode(explode('?text=', $confirmed->json('reservation.whatsapp_url'))[1]);
        $this->assertStringContainsString('est confirmée', $message);
        $this->assertStringContainsString('30 000 FCFA', $message);
        $this->assertStringContainsString('18:00', $message);

        $this->getJson('/api/gestionnaire/reservations?vue=a_venir')->assertJsonPath('compteurs.a_venir', 1)->assertJsonCount(1, 'data');
        $this->postJson('/api/gestionnaire/reservations/'.$reservation->id.'/confirmer')->assertConflict();

        $this->patchJson('/api/notifications/lu')->assertOk();
        $this->getJson('/api/notifications')->assertJsonPath('non_lues', 0);

        // 4. Le client est prévenu que le gestionnaire va le contacter sur WhatsApp.
        $this->assertDatabaseHas('notifications', [
            'utilisateur_id' => $client->id,
            'reservation_id' => $reservation->id,
            'titre' => 'Réservation confirmée',
        ]);
        $this->assertStringContainsString('WhatsApp', $client->notificationsUtilisateur()->latest('id')->value('message'));
    }

    public function test_whatsapp_number_is_required_and_validated(): void
    {
        [, $client, $terrain] = $this->actors();
        $start = now()->addDays(2)->setTime(10, 0);

        $this->actingAs($client, 'web')->postJson('/api/client/reservations', [
            'terrain_id' => $terrain->id,
            'date_debut' => $start->toDateTimeString(),
            'date_fin' => $start->copy()->addHour()->toDateTimeString(),
        ])->assertUnprocessable()->assertJsonValidationErrors('telephone_whatsapp');

        $this->postJson('/api/client/reservations', [
            'terrain_id' => $terrain->id,
            'date_debut' => $start->toDateTimeString(),
            'date_fin' => $start->copy()->addHour()->toDateTimeString(),
            'telephone_whatsapp' => '1234',
        ])->assertUnprocessable()->assertJsonValidationErrors('telephone_whatsapp');
    }

    public function test_refusal_can_carry_a_reason_for_the_client(): void
    {
        [$manager, $client, $terrain] = $this->actors();
        $reservation = $this->pending($client, $terrain, now()->addDay());

        $this->actingAs($manager, 'web')
            ->postJson('/api/gestionnaire/reservations/'.$reservation->id.'/refuser', ['motif' => 'Tournoi privé ce soir-là'])
            ->assertOk()
            ->assertJsonPath('reservation.statut', 'REFUSEE');

        $this->assertStringContainsString('Motif : Tournoi privé ce soir-là', $client->notificationsUtilisateur()->value('message'));
    }

    public function test_payment_endpoints_no_longer_exist(): void
    {
        [$manager, $client, $terrain] = $this->actors();
        $reservation = $this->pending($client, $terrain, now()->addDay());

        $this->actingAs($client, 'web')
            ->postJson('/api/client/reservations/'.$reservation->id.'/paiements', ['methode' => 'WAVE'])
            ->assertNotFound();
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasTable('paiements'));
    }

    public function test_manager_controls_availability_of_a_terrain(): void
    {
        [$manager, $client, $terrain] = $this->actors();
        $path = '/api/gestionnaire/terrains/'.$terrain->id.'/disponibilite';
        $this->actingAs($manager, 'web');

        $this->getJson('/api/gestionnaire/terrains/'.$terrain->id)->assertJsonPath('data.disponibilite.etat', 'DISPONIBLE');

        // Indisponible jusqu'à une date : reste visible, mais fermé et annoncé aux clients.
        $until = now()->addDays(3)->setTime(12, 0);
        $this->putJson($path, ['etat' => 'INDISPONIBLE', 'jusqu_au' => $until->toDateTimeString(), 'motif' => 'Travaux'])
            ->assertOk()
            ->assertJsonPath('data.statut', 'ACTIF')
            ->assertJsonPath('data.disponibilite.etat', 'INDISPONIBLE')
            ->assertJsonPath('data.disponibilite.motif', 'Travaux');
        $this->getJson('/api/terrains/'.$terrain->id)->assertOk()->assertJsonPath('data.disponibilite.etat', 'INDISPONIBLE');

        // De nouveau disponible : la fermeture en cours se termine maintenant.
        $this->putJson($path, ['etat' => 'DISPONIBLE'])->assertOk()->assertJsonPath('data.disponibilite.etat', 'DISPONIBLE');
        $this->assertDatabaseCount('indisponibilites', 1);
        $this->assertTrue($terrain->indisponibilites()->first()->date_fin->lessThanOrEqualTo(now()));

        // Jusqu'à nouvel ordre : terrain masqué.
        $this->putJson($path, ['etat' => 'INDISPONIBLE'])->assertOk()
            ->assertJsonPath('data.statut', 'INACTIF')
            ->assertJsonPath('data.disponibilite.etat', 'HORS_LIGNE');
        $this->getJson('/api/terrains/'.$terrain->id)->assertNotFound();
        $this->putJson($path, ['etat' => 'DISPONIBLE'])->assertOk()->assertJsonPath('data.statut', 'ACTIF');

        // Une fermeture qui couvrirait une réservation active est refusée.
        $this->pending($client, $terrain, now()->addDay());
        $this->putJson($path, ['etat' => 'INDISPONIBLE', 'jusqu_au' => now()->addDays(2)->toDateTimeString()])
            ->assertConflict()
            ->assertJsonPath('message', '1 réservation en attente ou confirmée sur cette période : refusez-les ou choisissez une date plus proche.');

        $this->putJson($path, ['etat' => 'INDISPONIBLE', 'jusqu_au' => now()->subDay()->toDateTimeString()])->assertUnprocessable();

        Auth::forgetGuards();
        $this->actingAs(User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]), 'web')
            ->putJson($path, ['etat' => 'INDISPONIBLE'])
            ->assertForbidden();
    }

    private function actors(): array
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $client = User::factory()->create(['role' => User::ROLE_CLIENT, 'telephone' => null]);
        $terrain = $manager->terrains()->create([
            'commune_id' => Commune::firstOrCreate(['nom' => 'Médina'])->id,
            'nom' => 'Terrain Test',
            'adresse' => '1 rue Test',
            'ville' => 'Dakar',
            'quartier' => 'Médina',
            'latitude' => 14.68,
            'longitude' => -17.45,
            'type' => 'Football',
            'capacite' => 10,
            'tarif_horaire' => 15000,
            'statut' => 'ACTIF',
        ]);

        return [$manager, $client, $terrain];
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
            'telephone_whatsapp' => '221771234567',
        ]);
    }
}
