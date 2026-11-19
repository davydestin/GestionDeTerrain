<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MapLocationPickerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    public function test_reverse_geocoding_turns_the_pin_position_into_form_fields(): void
    {
        Http::fake([
            'https://nominatim.openstreetmap.org/reverse*' => Http::response([
                'lat' => '14.6809191',
                'lon' => '-17.4495718',
                'display_name' => 'Avenue Blaise Diagne, Commune de Médina, Dakar, Sénégal',
                'address' => [
                    'road' => 'Avenue Blaise Diagne',
                    'suburb' => 'Commune de Médina',
                    'city_district' => 'Arrondissement de Dakar-Plateau',
                    'city' => 'Dakar',
                ],
            ]),
        ]);

        $this->actingAs($this->manager(), 'web')
            ->getJson('/api/gestionnaire/geocode/reverse?latitude=14.6809&longitude=-17.4496')
            ->assertOk()
            ->assertJsonPath('result.adresse', 'Avenue Blaise Diagne')
            ->assertJsonPath('result.commune', 'Médina')
            ->assertJsonPath('result.quartier', 'Médina')
            ->assertJsonPath('result.ville', 'Dakar');

        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/reverse')
            && $request->hasHeader('Accept-Language', 'fr'));
    }

    public function test_reverse_geocoding_is_cached_for_the_same_spot(): void
    {
        Http::fake(['https://nominatim.openstreetmap.org/reverse*' => Http::response([
            'lat' => '14.7223', 'lon' => '-17.4867', 'display_name' => 'Ouakam',
            'address' => ['neighbourhood' => 'Arrondissement des Almadies'],
        ])]);
        $manager = $this->manager();

        foreach ([1, 2] as $attempt) {
            $this->actingAs($manager, 'web')
                ->getJson('/api/gestionnaire/geocode/reverse?latitude=14.72230&longitude=-17.48670')
                ->assertOk()
                ->assertJsonPath('result.quartier', 'Almadies');
        }

        Http::assertSentCount(1);
    }

    public function test_reverse_geocoding_of_an_empty_spot_still_returns_the_position(): void
    {
        Http::fake(['https://nominatim.openstreetmap.org/reverse*' => Http::response(['error' => 'Unable to geocode'])]);

        $this->actingAs($this->manager(), 'web')
            ->getJson('/api/gestionnaire/geocode/reverse?latitude=14.70&longitude=-17.50')
            ->assertOk()
            ->assertJsonPath('result.latitude', 14.7)
            ->assertJsonPath('result.adresse', null);
    }

    public function test_reverse_geocoding_rejects_positions_outside_dakar_and_non_managers(): void
    {
        Http::fake();

        $this->actingAs($this->manager(), 'web')
            ->getJson('/api/gestionnaire/geocode/reverse?latitude=14.79&longitude=-16.92')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('latitude');

        Auth::forgetGuards();
        $client = User::factory()->create(['role' => User::ROLE_CLIENT]);
        $this->actingAs($client, 'web')
            ->getJson('/api/gestionnaire/geocode/reverse?latitude=14.68&longitude=-17.45')
            ->assertForbidden();

        Http::assertNothingSent();
    }

    public function test_free_text_search_is_scoped_to_dakar(): void
    {
        Http::fake(['https://nominatim.openstreetmap.org/search*' => Http::response([[
            'lat' => '14.7461', 'lon' => '-17.5133', 'name' => 'Stade des Almadies',
            'display_name' => 'Stade des Almadies, Ngor, Dakar',
            'address' => ['road' => 'Route des Almadies', 'suburb' => 'Commune de Ngor'],
        ]])]);

        $this->actingAs($this->manager(), 'web')
            ->postJson('/api/gestionnaire/geocode', ['q' => 'stade almadies'])
            ->assertOk()
            ->assertJsonPath('results.0.adresse', 'Route des Almadies')
            ->assertJsonPath('results.0.commune', 'Ngor');

        Http::assertSent(fn (Request $request) => $request['q'] === 'stade almadies, Dakar');
    }

    public function test_search_needs_either_free_text_or_an_address(): void
    {
        Http::fake();

        $this->actingAs($this->manager(), 'web')
            ->postJson('/api/gestionnaire/geocode', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['q', 'adresse']);

        $this->postJson('/api/gestionnaire/geocode', ['adresse' => '12 rue Centrale'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('quartier');
    }

    private function manager(): User
    {
        return User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
    }
}
