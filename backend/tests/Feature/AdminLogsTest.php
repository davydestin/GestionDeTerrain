<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\LogReader;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class AdminLogsTest extends TestCase
{
    use RefreshDatabase;

    private string $directory;

    protected function setUp(): void
    {
        parent::setUp();

        // Dossier de logs isolé : le test ne lit ni ne modifie les vrais fichiers.
        $this->directory = storage_path('framework/testing/logs-'.uniqid());
        File::ensureDirectoryExists($this->directory);
        File::put($this->directory.'/laravel-2026-11-18.log', "[2026-11-18 08:00:00] local.INFO: Ancien fichier\n");
        File::put($this->directory.'/laravel-2026-11-19.log', implode("\n", [
            '[2026-11-19 09:00:00] testing.WARNING: Nominatim a refusé la requête de géocodage. {"status":403}',
            '[2026-11-19 10:00:00] local.INFO: Démarrage',
            '[2026-11-19 11:00:00] local.WARNING: Google lent {"duree":9}',
            '[2026-11-19 12:00:00] local.ERROR: SQLSTATE[42S02]: Table introuvable {"exception":"[object] (QueryException)"}',
            '[stacktrace]',
            '#0 vendor/laravel/framework/src/Illuminate/Database/Connection.php(442)',
            '',
        ]));
        File::put($this->directory.'/secret.txt', 'ne doit jamais être lu');
        touch($this->directory.'/laravel-2026-11-18.log', strtotime('2026-11-18 08:00:00'));

        $this->app->instance(LogReader::class, new LogReader($this->directory));
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->directory);

        parent::tearDown();
    }

    public function test_only_administrators_can_read_the_logs(): void
    {
        $this->getJson('/api/admin/logs')->assertUnauthorized();

        foreach ([User::ROLE_CLIENT, User::ROLE_GESTIONNAIRE] as $role) {
            Auth::forgetGuards();
            $this->actingAs(User::factory()->create(['role' => $role]), 'web')->getJson('/api/admin/logs')->assertForbidden();
        }
    }

    public function test_latest_file_is_parsed_newest_first_with_details(): void
    {
        $response = $this->actingAs($this->admin(), 'web')->getJson('/api/admin/logs')->assertOk();

        $response->assertJsonPath('fichier', 'laravel-2026-11-19.log')
            ->assertJsonCount(2, 'fichiers')
            ->assertJsonPath('entrees.total', 3)
            ->assertJsonPath('compteurs.ERROR', 1)
            ->assertJsonPath('entrees.data.0.niveau', 'ERROR')
            ->assertJsonPath('entrees.data.0.message', 'SQLSTATE[42S02]: Table introuvable')
            ->assertJsonPath('entrees.data.2.message', 'Démarrage');

        $this->assertStringContainsString('[stacktrace]', $response->json('entrees.data.0.details'));
        $this->assertStringContainsString('"duree":9', $response->json('entrees.data.1.details'));
        $this->assertNotContains('secret.txt', array_column($response->json('fichiers'), 'nom'));
    }

    public function test_logs_can_be_filtered_and_other_files_selected(): void
    {
        $this->actingAs($this->admin(), 'web');

        $this->getJson('/api/admin/logs?niveau=WARNING')->assertJsonPath('entrees.total', 1)->assertJsonPath('entrees.data.0.message', 'Google lent');
        $this->getJson('/api/admin/logs?search=connection.php')->assertJsonPath('entrees.total', 1);
        $this->getJson('/api/admin/logs?fichier=laravel-2026-11-18.log')->assertJsonPath('entrees.data.0.message', 'Ancien fichier');
    }

    public function test_entries_written_by_automated_tests_are_hidden_by_default(): void
    {
        $this->actingAs($this->admin(), 'web');

        $this->getJson('/api/admin/logs')
            ->assertJsonPath('entrees.total', 3)
            ->assertJsonPath('entrees_tests', 1)
            ->assertJsonPath('compteurs.WARNING', 1);

        $this->getJson('/api/admin/logs?inclure_tests=1')
            ->assertJsonPath('entrees.total', 4)
            ->assertJsonPath('compteurs.WARNING', 2)
            ->assertJsonPath('entrees.data.3.environnement', 'testing');
    }

    public function test_files_outside_the_log_list_cannot_be_read(): void
    {
        $this->actingAs($this->admin(), 'web');

        foreach (['secret.txt', '../.env', '..\\..\\.env', 'laravel-2026-11-19.log/../secret.txt'] as $name) {
            $this->getJson('/api/admin/logs?fichier='.urlencode($name))->assertNotFound();
        }
    }

    private function admin(): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMINISTRATEUR]);
    }
}
