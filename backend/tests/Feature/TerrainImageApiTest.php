<?php

namespace Tests\Feature;

use App\Models\Commune;
use App\Models\Terrain;
use App\Models\TerrainImage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TerrainImageApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_manager_can_upload_multiple_images_change_primary_delete_and_view_them(): void
    {
        Storage::fake('public');
        [$manager, $terrain] = $this->createManagerTerrain();

        $upload = $this->actingAs($manager, 'web')->post(
            '/api/gestionnaire/terrains/'.$terrain->id.'/images',
            [
                'images' => [
                    UploadedFile::fake()->image('terrain-a.jpg'),
                    UploadedFile::fake()->image('terrain-b.png'),
                ],
            ],
            ['Accept' => 'application/json']
        );

        $upload->assertCreated()->assertJsonCount(2, 'data');

        $images = TerrainImage::where('terrain_id', $terrain->id)->orderBy('id')->get();
        $this->assertCount(2, $images);
        $this->assertTrue($images[0]->est_principale);
        $this->assertFalse($images[1]->est_principale);
        Storage::disk('public')->assertExists($images[0]->chemin_image);
        Storage::disk('public')->assertExists($images[1]->chemin_image);

        $this->getJson('/api/terrains/'.$terrain->id)
            ->assertOk()
            ->assertJsonCount(2, 'data.images')
            ->assertJsonPath('data.images.0.est_principale', true);

        $this->get('/api/terrain-images/'.$images[0]->id)->assertOk();

        $this->patchJson(
            '/api/gestionnaire/terrains/'.$terrain->id.'/images/'.$images[1]->id.'/principal'
        )->assertOk()->assertJsonPath('data.est_principale', true);

        $secondImagePath = $images[1]->chemin_image;
        $this->deleteJson(
            '/api/gestionnaire/terrains/'.$terrain->id.'/images/'.$images[1]->id
        )->assertNoContent();

        Storage::disk('public')->assertMissing($secondImagePath);
        $this->assertDatabaseMissing('terrain_images', ['id' => $images[1]->id]);
        $this->assertTrue($terrain->images()->firstOrFail()->est_principale);
    }

    public function test_only_owner_can_manage_photos_and_uploads_are_validated(): void
    {
        Storage::fake('public');
        [$owner, $terrain] = $this->createManagerTerrain();
        $otherManager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $client = User::factory()->create(['role' => User::ROLE_CLIENT]);

        $response = $this->actingAs($owner, 'web')->post(
            '/api/gestionnaire/terrains/'.$terrain->id.'/images',
            ['images' => [UploadedFile::fake()->image('owner.jpg')]],
            ['Accept' => 'application/json']
        )->assertCreated();

        $image = TerrainImage::firstOrFail();
        $imagePath = $image->chemin_image;
        $imageId = $image->id;

        Auth::forgetGuards();
        $this->actingAs($otherManager, 'web')->deleteJson(
            '/api/gestionnaire/terrains/'.$terrain->id.'/images/'.$imageId
        )->assertForbidden();

        Auth::forgetGuards();
        $this->actingAs($client, 'web')->patchJson(
            '/api/gestionnaire/terrains/'.$terrain->id.'/images/'.$imageId.'/principal'
        )->assertForbidden();

        Auth::forgetGuards();
        $this->actingAs($owner, 'web')->post(
            '/api/gestionnaire/terrains/'.$terrain->id.'/images',
            ['images' => [UploadedFile::fake()->create('not-an-image.txt', 10, 'text/plain')]],
            ['Accept' => 'application/json']
        )->assertUnprocessable()
            ->assertJsonValidationErrors('images.0');

        Storage::disk('public')->assertExists($imagePath);
        $this->assertDatabaseHas('terrain_images', ['id' => $imageId]);
    }

    public function test_soft_deleting_a_terrain_removes_its_photo_files_and_records(): void
    {
        Storage::fake('public');
        [$manager, $terrain] = $this->createManagerTerrain();

        $this->actingAs($manager, 'web')->post(
            '/api/gestionnaire/terrains/'.$terrain->id.'/images',
            ['images' => [UploadedFile::fake()->image('remove-on-delete.jpg')]],
            ['Accept' => 'application/json']
        )->assertCreated();

        $image = TerrainImage::firstOrFail();
        $imagePath = $image->chemin_image;

        $this->deleteJson('/api/gestionnaire/terrains/'.$terrain->id)->assertNoContent();

        Storage::disk('public')->assertMissing($imagePath);
        $this->assertDatabaseMissing('terrain_images', ['id' => $image->id]);
        $this->assertSoftDeleted('terrains', ['id' => $terrain->id]);
    }

    private function createManagerTerrain(): array
    {
        $manager = User::factory()->create(['role' => User::ROLE_GESTIONNAIRE]);
        $commune = Commune::firstOrCreate(['nom' => 'Médina']);
        $terrain = $manager->terrains()->create([
            'commune_id' => $commune->id,
            'nom' => 'Terrain Médina',
            'adresse' => '12 rue Centrale',
            'ville' => 'Dakar',
            'quartier' => 'Angle Mousse',
            'type' => 'Football',
            'capacite' => 22,
            'tarif_horaire' => 15000,
            'statut' => 'ACTIF',
        ]);

        return [$manager, $terrain];
    }
}