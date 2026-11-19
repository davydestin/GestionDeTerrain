<?php

namespace Tests\Feature;

use App\Models\Commune;
use App\Models\JournalAudit;
use App\Models\Reservation;
use App\Models\Terrain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use LogicException;
use Tests\TestCase;

class JournalAuditTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Requêtes « stateful » Sanctum : la session n'existe que pour l'origine du frontend.
        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173']);
    }

    public function test_only_an_administrator_can_read_the_audit_log(): void
    {
        $this->getJson('/api/admin/journal')->assertUnauthorized();

        $client = User::factory()->create(['role' => User::ROLE_CLIENT]);
        $this->actingAs($client, 'web')->getJson('/api/admin/journal')->assertForbidden();

        Auth::forgetGuards();
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $this->actingAs($manager, 'web')->getJson('/api/admin/journal')->assertForbidden();

        Auth::forgetGuards();
        $admin = User::factory()->create(['role' => User::ROLE_ADMINISTRATEUR]);
        $this->actingAs($admin, 'web')
            ->getJson('/api/admin/journal')
            ->assertOk()
            ->assertJsonStructure(['entrees' => ['data', 'total'], 'actions']);
    }

    public function test_successful_and_failed_logins_and_logout_are_logged_without_password(): void
    {
        $user = User::factory()->create(['email' => 'awa@example.com', 'role' => User::ROLE_GESTIONNAIRE]);

        $this->postJson('/api/login', ['email' => 'awa@example.com', 'password' => 'mauvais-mdp'])->assertStatus(422);
        $this->postJson('/api/login', ['email' => 'awa@example.com', 'password' => 'password'])->assertOk();
        $this->postJson('/api/logout')->assertOk();

        $this->assertDatabaseHas('journal_audit', ['action' => 'auth.connexion_echouee', 'cible_id' => $user->id, 'utilisateur_id' => null]);
        $this->assertDatabaseHas('journal_audit', ['action' => 'auth.connexion', 'utilisateur_id' => $user->id]);
        $this->assertDatabaseHas('journal_audit', ['action' => 'auth.deconnexion', 'utilisateur_id' => $user->id]);

        $dump = JournalAudit::all()->toJson();
        $this->assertStringNotContainsString('mauvais-mdp', $dump);
        $this->assertStringNotContainsString('"password"', JournalAudit::query()->pluck('details')->toJson());
    }

    public function test_admin_actions_on_accounts_are_logged_with_before_and_after_values(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMINISTRATEUR]);
        $this->actingAs($admin, 'web');

        $created = $this->postJson('/api/admin/users', [
            'nom' => 'Diop',
            'prenom' => 'Moussa',
            'email' => 'moussa@example.com',
            'password' => 'secret-123',
            'role' => User::ROLE_GESTIONNAIRE,
        ])->assertCreated()->json('user');

        $this->patchJson('/api/admin/users/'.$created['id'], ['role' => User::ROLE_ADMINISTRATEUR])->assertOk();
        $this->patchJson('/api/admin/users/'.$created['id'], ['statut' => false])->assertOk();
        $this->patchJson('/api/admin/users/'.$created['id'], ['password' => 'nouveau-secret'])->assertOk();
        $this->deleteJson('/api/admin/users/'.$created['id'])->assertOk();

        $actions = JournalAudit::query()->where('utilisateur_id', $admin->id)->orderBy('id')->pluck('action')->all();
        $this->assertSame([
            'utilisateur.cree',
            'utilisateur.role_modifie',
            'utilisateur.desactive',
            'utilisateur.modifie',
            'utilisateur.supprime',
        ], $actions);

        $roleChange = JournalAudit::query()->where('action', 'utilisateur.role_modifie')->first();
        $this->assertSame(['avant' => 'GESTIONNAIRE', 'apres' => 'ADMINISTRATEUR'], $roleChange->details['changements']['role']);

        $passwordChange = JournalAudit::query()->where('action', 'utilisateur.modifie')->first();
        $this->assertStringNotContainsString('nouveau-secret', json_encode($passwordChange->details));
        $this->assertStringNotContainsString('$2y$', json_encode($passwordChange->details));
        $this->assertArrayHasKey('password', $passwordChange->details['changements']);
    }

    public function test_reservation_lifecycle_is_logged(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $client = User::factory()->create(['role' => User::ROLE_CLIENT]);
        $terrain = $this->createTerrain($manager);
        $reservation = Reservation::create([
            'utilisateur_id' => $client->id,
            'terrain_id' => $terrain->id,
            'date_debut' => now()->addDay(),
            'date_fin' => now()->addDay()->addHour(),
            'montant_total' => 15000,
            'statut' => 'EN_ATTENTE',
        ]);

        $this->actingAs($manager, 'web')
            ->postJson('/api/gestionnaire/reservations/'.$reservation->id.'/refuser', ['motif' => 'Tournoi'])
            ->assertOk();

        $entry = JournalAudit::query()->where('action', 'reservation.refusee')->firstOrFail();
        $this->assertSame($manager->id, $entry->utilisateur_id);
        $this->assertSame('reservation', $entry->cible_type);
        $this->assertSame($reservation->id, $entry->cible_id);
        $this->assertSame('Tournoi', $entry->details['motif']);
    }

    public function test_terrain_changes_are_logged(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $terrain = $this->createTerrain($manager);

        $this->actingAs($manager, 'web')
            ->patchJson('/api/gestionnaire/terrains/'.$terrain->id, ['tarif_horaire' => 20000])
            ->assertOk();
        $this->putJson('/api/gestionnaire/terrains/'.$terrain->id.'/disponibilite', ['etat' => 'INDISPONIBLE'])->assertOk();
        $this->deleteJson('/api/gestionnaire/terrains/'.$terrain->id)->assertNoContent();

        $this->assertSame(
            ['terrain.modifie', 'terrain.disponibilite', 'terrain.supprime'],
            JournalAudit::query()->orderBy('id')->pluck('action')->all(),
        );
        $this->assertEquals(20000, JournalAudit::query()->where('action', 'terrain.modifie')->first()->details['changements']['tarif_horaire']['apres']);
    }

    public function test_entries_survive_account_deletion_and_cannot_be_altered(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMINISTRATEUR]);
        $author = User::factory()->create(['prenom' => 'Fatou', 'nom' => 'Sow', 'role' => User::ROLE_GESTIONNAIRE]);
        $this->postJson('/api/login', ['email' => $author->email, 'password' => 'password'])->assertOk();
        $entry = JournalAudit::query()->where('action', 'auth.connexion')->firstOrFail();

        Auth::forgetGuards();
        $this->actingAs($admin, 'web')->deleteJson('/api/admin/users/'.$author->id)->assertOk();

        $entry->refresh();
        $this->assertNull($entry->utilisateur_id);
        $this->assertSame('Fatou Sow', $entry->utilisateur_nom);

        $this->expectException(LogicException::class);
        $entry->update(['description' => 'falsifié']);
    }

    public function test_the_log_can_be_filtered(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMINISTRATEUR]);
        $this->actingAs($admin, 'web');
        $this->postJson('/api/admin/users', [
            'nom' => 'Ndiaye', 'prenom' => 'Ali', 'email' => 'ali@example.com',
            'password' => 'secret-123', 'role' => User::ROLE_GESTIONNAIRE,
        ])->assertCreated();
        Auth::forgetGuards();
        $this->postJson('/api/login', ['email' => 'inconnu@example.com', 'password' => 'x'])->assertStatus(422);

        $this->actingAs($admin, 'web');
        $this->getJson('/api/admin/journal?categorie=utilisateur')
            ->assertOk()
            ->assertJsonPath('entrees.total', 1)
            ->assertJsonPath('entrees.data.0.action', 'utilisateur.cree');
        $this->getJson('/api/admin/journal?action=auth.connexion_echouee')->assertJsonPath('entrees.total', 1);
        $this->getJson('/api/admin/journal?search=ali@example.com')->assertJsonPath('entrees.total', 1);
        $this->getJson('/api/admin/journal?du='.now()->addDay()->format('Y-m-d'))->assertJsonPath('entrees.total', 0);
        $this->getJson('/api/admin/journal?action=inexistante')->assertUnprocessable();
    }

    public function test_planning_changes_by_a_manager_are_logged(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $terrain = $this->createTerrain($manager);
        $this->actingAs($manager, 'web');

        $horaire = $this->postJson('/api/gestionnaire/terrains/'.$terrain->id.'/horaires', [
            'jour_semaine' => 1, 'heure_ouverture' => '08:00', 'heure_fermeture' => '20:00',
        ])->assertCreated()->json('horaire');
        $this->putJson('/api/gestionnaire/terrains/'.$terrain->id.'/horaires/'.$horaire['id'], [
            'jour_semaine' => 1, 'heure_ouverture' => '09:00', 'heure_fermeture' => '20:00',
        ])->assertOk();
        $closure = $this->postJson('/api/gestionnaire/terrains/'.$terrain->id.'/indisponibilites', [
            'date_debut' => now()->addDays(2)->format('Y-m-d H:i:s'),
            'date_fin' => now()->addDays(3)->format('Y-m-d H:i:s'),
            'motif' => 'Travaux',
        ])->assertCreated()->json('indisponibilite');
        $this->deleteJson('/api/gestionnaire/terrains/'.$terrain->id.'/indisponibilites/'.$closure['id'])->assertNoContent();
        $this->deleteJson('/api/gestionnaire/terrains/'.$terrain->id.'/horaires/'.$horaire['id'])->assertNoContent();

        $this->assertSame([
            'terrain.horaire_ajoute',
            'terrain.horaire_modifie',
            'terrain.indisponibilite_ajoutee',
            'terrain.indisponibilite_supprimee',
            'terrain.horaire_supprime',
        ], JournalAudit::query()->orderBy('id')->pluck('action')->all());
        $this->assertSame([$manager->id], JournalAudit::query()->distinct()->pluck('utilisateur_id')->all());
    }

    public function test_past_actions_are_reconstituted_once_with_their_original_dates(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE, 'prenom' => 'Ibrahima', 'nom' => 'Fall']);
        $client = User::factory()->create(['role' => User::ROLE_CLIENT]);
        $this->travelTo(now()->subMonth());
        $terrain = $this->createTerrain($manager);
        $terrain->horaires()->create(['jour_semaine' => 6, 'heure_ouverture' => '08:00', 'heure_fermeture' => '22:00', 'actif' => true]);
        $reservation = Reservation::create([
            'utilisateur_id' => $client->id,
            'terrain_id' => $terrain->id,
            'date_debut' => now()->addDays(3),
            'date_fin' => now()->addDays(3)->addHour(),
            'montant_total' => 15000,
            'statut' => 'CONFIRMEE',
        ]);
        $this->travelBack();

        $this->artisan('audit:reconstituer')->assertSuccessful();
        $this->artisan('audit:reconstituer')->assertSuccessful();

        $created = JournalAudit::query()->where('action', 'terrain.cree')->sole();
        $this->assertSame($manager->id, $created->utilisateur_id);
        $this->assertSame('Ibrahima Fall', $created->utilisateur_nom);
        $this->assertTrue($created->details['reconstitue']);
        $this->assertNull($created->adresse_ip);
        $this->assertTrue($created->created_at->equalTo($terrain->created_at));

        $this->assertDatabaseHas('journal_audit', ['action' => 'terrain.horaire_ajoute', 'utilisateur_id' => $manager->id]);
        $this->assertDatabaseHas('journal_audit', ['action' => 'reservation.creee', 'utilisateur_id' => $client->id, 'cible_id' => $reservation->id]);
        $this->assertDatabaseHas('journal_audit', ['action' => 'reservation.confirmee', 'utilisateur_id' => $manager->id]);
        $this->assertSame(4, JournalAudit::query()->count(), 'relancer la commande ne doit pas créer de doublon');
    }

    private function createTerrain(User $manager): Terrain
    {
        return $manager->terrains()->create([
            'commune_id' => Commune::firstOrCreate(['nom' => 'Médina'])->id,
            'nom' => 'Terrain Audit',
            'adresse' => '12 rue Centrale',
            'ville' => 'Dakar',
            'quartier' => 'Médina',
            'latitude' => 14.68,
            'longitude' => -17.44,
            'type' => 'Football',
            'capacite' => 22,
            'tarif_horaire' => 15000,
            'statut' => 'ACTIF',
        ]);
    }
}
