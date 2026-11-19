<?php

namespace Tests\Feature;

use App\Models\JournalAudit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GoogleLoginTest extends TestCase
{
    use RefreshDatabase;

    private const CLIENT_ID = 'test-client.apps.googleusercontent.com';

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.google.client_id' => self::CLIENT_ID]);
        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173']);
    }

    public function test_first_google_login_creates_a_client_account_and_opens_a_session(): void
    {
        $this->fakeGoogle(['sub' => 'google-123', 'email' => 'Awa.Diop@gmail.com', 'given_name' => 'Awa', 'family_name' => 'Diop']);

        $this->postJson('/api/auth/google', ['credential' => 'jeton'])
            ->assertCreated()
            ->assertJsonPath('user.role', User::ROLE_CLIENT)
            ->assertJsonPath('user.email', 'awa.diop@gmail.com')
            ->assertJsonPath('user.prenom', 'Awa')
            ->assertJsonMissingPath('user.google_id');

        $user = User::query()->where('email', 'awa.diop@gmail.com')->sole();
        $this->assertSame('google-123', $user->google_id);
        $this->assertNull($user->password);
        $this->assertAuthenticatedAs($user, 'web');
        $this->getJson('/api/user')->assertOk()->assertJsonPath('user.id', $user->id);
        $this->assertDatabaseHas('journal_audit', ['action' => 'auth.inscription', 'utilisateur_id' => $user->id]);

        // Seconde connexion : même compte, pas de doublon.
        $this->postJson('/api/logout')->assertOk();
        $this->postJson('/api/auth/google', ['credential' => 'jeton'])->assertOk()->assertJsonPath('user.id', $user->id);
        $this->assertSame(1, User::query()->count());
    }

    public function test_an_existing_client_is_linked_to_google_by_email(): void
    {
        $client = User::factory()->create(['email' => 'fatou@gmail.com', 'role' => User::ROLE_CLIENT]);
        $this->fakeGoogle(['sub' => 'google-456', 'email' => 'fatou@gmail.com']);

        $this->postJson('/api/auth/google', ['credential' => 'jeton'])->assertOk()->assertJsonPath('user.id', $client->id);

        $this->assertSame('google-456', $client->fresh()->google_id);
    }

    public function test_a_client_who_signed_up_with_google_is_pointed_to_google_on_the_password_form(): void
    {
        $this->fakeGoogle(['sub' => 'google-321', 'email' => 'moussa@gmail.com']);
        $this->postJson('/api/auth/google', ['credential' => 'jeton'])->assertCreated();
        $this->postJson('/api/logout')->assertOk();

        $this->postJson('/api/login', ['email' => 'moussa@gmail.com', 'password' => 'nimporte'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Ce compte a été créé avec Google : utilisez « Continuer avec Google ».');

        $this->assertGuest('web');
    }

    public function test_a_client_registered_with_a_password_can_also_use_google(): void
    {
        $client = User::factory()->create(['email' => 'ancien@gmail.com', 'password' => 'Password123!', 'role' => User::ROLE_CLIENT]);

        $this->postJson('/api/login', ['email' => 'ancien@gmail.com', 'password' => 'Password123!'])->assertOk();
        $this->postJson('/api/logout')->assertOk();

        $this->fakeGoogle(['sub' => 'google-654', 'email' => 'ancien@gmail.com']);
        $this->postJson('/api/auth/google', ['credential' => 'jeton'])->assertOk()->assertJsonPath('user.id', $client->id);

        // Le mot de passe reste valable après la liaison à Google.
        $this->postJson('/api/logout')->assertOk();
        $this->postJson('/api/login', ['email' => 'ancien@gmail.com', 'password' => 'Password123!'])->assertOk();
    }

    public function test_managers_and_administrators_cannot_use_google(): void
    {
        foreach ([User::ROLE_GESTIONNAIRE, User::ROLE_ADMINISTRATEUR] as $index => $role) {
            $staff = User::factory()->create(['email' => "staff{$index}@gmail.com", 'role' => $role]);
            $this->fakeGoogle(['sub' => "google-staff-{$index}", 'email' => $staff->email]);

            $this->postJson('/api/auth/google', ['credential' => 'jeton'])->assertForbidden();

            $this->assertGuest('web');
            $this->assertNull($staff->fresh()->google_id);
        }

        $this->assertSame(2, JournalAudit::query()->where('action', 'auth.connexion_echouee')->count());
    }

    public function test_disabled_client_and_invalid_tokens_are_rejected(): void
    {
        User::factory()->create(['email' => 'bloque@gmail.com', 'role' => User::ROLE_CLIENT, 'statut' => false]);
        $this->fakeGoogle(['sub' => 'google-789', 'email' => 'bloque@gmail.com']);
        $this->postJson('/api/auth/google', ['credential' => 'jeton'])->assertForbidden();

        // Jeton émis pour une autre application.
        $this->fakeGoogle(['sub' => 'g-1', 'email' => 'autre@gmail.com', 'aud' => 'autre-application']);
        $this->postJson('/api/auth/google', ['credential' => 'jeton'])->assertUnauthorized();

        // E-mail Google non vérifié.
        $this->fakeGoogle(['sub' => 'g-2', 'email' => 'nonverifie@gmail.com', 'email_verified' => 'false']);
        $this->postJson('/api/auth/google', ['credential' => 'jeton'])->assertUnauthorized();

        // Jeton refusé par Google.
        Http::swap(new Factory);
        Http::fake(['oauth2.googleapis.com/*' => Http::response(['error' => 'invalid_token'], 400)]);
        $this->postJson('/api/auth/google', ['credential' => 'faux'])->assertUnauthorized();

        $this->assertGuest('web');
        $this->assertDatabaseMissing('users', ['email' => 'autre@gmail.com']);
        $this->assertDatabaseMissing('users', ['email' => 'nonverifie@gmail.com']);
    }

    public function test_custom_google_button_access_token_creates_and_logs_in_the_client(): void
    {
        $this->fakeAccessToken(['sub' => 'google-999', 'email' => 'aminata@gmail.com']);

        $this->postJson('/api/auth/google', ['access_token' => 'ya29.jeton'])
            ->assertCreated()
            ->assertJsonPath('user.role', User::ROLE_CLIENT)
            ->assertJsonPath('user.prenom', 'Aminata')
            ->assertJsonPath('user.nom', 'Sarr');

        $this->assertAuthenticatedAs(User::query()->where('google_id', 'google-999')->sole(), 'web');
    }

    public function test_an_access_token_issued_to_another_application_is_rejected(): void
    {
        $this->fakeAccessToken(['sub' => 'google-111', 'email' => 'pirate@gmail.com', 'aud' => 'autre-site', 'azp' => 'autre-site']);

        $this->postJson('/api/auth/google', ['access_token' => 'ya29.jeton'])->assertUnauthorized();

        $this->assertGuest('web');
        $this->assertDatabaseMissing('users', ['email' => 'pirate@gmail.com']);
    }

    public function test_google_login_is_unavailable_without_configuration(): void
    {
        config(['services.google.client_id' => null]);

        $this->postJson('/api/auth/google', ['credential' => 'jeton'])->assertStatus(503);
    }

    public function test_a_manager_created_by_the_administrator_logs_in_on_the_same_page(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMINISTRATEUR]);
        $details = ['nom' => 'Ba', 'prenom' => 'Omar', 'email' => 'omar@example.com', 'password' => 'secret-123'];

        $this->actingAs($admin, 'web')
            ->postJson('/api/admin/users', $details + ['role' => User::ROLE_GESTIONNAIRE])
            ->assertCreated();
        $this->app['auth']->forgetGuards();

        // Le gestionnaire se connecte ensuite avec les identifiants donnés par l'administrateur.
        $this->postJson('/api/login', ['email' => 'omar@example.com', 'password' => 'secret-123'])
            ->assertOk()
            ->assertJsonPath('user.role', User::ROLE_GESTIONNAIRE);
    }

    private function fakeAccessToken(array $claims): void
    {
        Http::swap(new Factory);
        Http::fake([
            'oauth2.googleapis.com/*' => Http::response($claims + [
                'aud' => self::CLIENT_ID,
                'azp' => self::CLIENT_ID,
                'email_verified' => 'true',
                'exp' => (string) (time() + 3600),
                'scope' => 'openid email profile',
            ]),
            'openidconnect.googleapis.com/*' => Http::response([
                'sub' => $claims['sub'],
                'email' => $claims['email'],
                'given_name' => 'Aminata',
                'family_name' => 'Sarr',
            ]),
        ]);
    }

    private function fakeGoogle(array $claims): void
    {
        // Repart d'un client HTTP neuf : un second Http::fake() s'ajouterait au premier au lieu de le remplacer.
        Http::swap(new Factory);
        Http::fake(['oauth2.googleapis.com/*' => Http::response($claims + [
            'aud' => self::CLIENT_ID,
            'iss' => 'https://accounts.google.com',
            'email_verified' => 'true',
            'exp' => (string) (time() + 3600),
        ])]);
    }
}
