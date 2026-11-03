<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\Admin\UserRoleController;
use App\Http\Controllers\Client\ClientReservationController;
use App\Http\Controllers\Gestionnaire\GestionnaireTerrainController;
use App\Http\Controllers\Gestionnaire\GestionnaireReservationController;
use App\Http\Controllers\Gestionnaire\TerrainPlanningController;
use App\Http\Controllers\TerrainController;
use App\Http\Controllers\TerrainAvailabilityController;
use App\Http\Controllers\CommuneController;
use App\Http\Controllers\PaiementController;
use App\Http\Controllers\NotificationUtilisateurController;
use App\Http\Controllers\TerrainImageController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:6,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1');
Route::get('/communes', [CommuneController::class, 'index']);
Route::get('/terrains/map', [TerrainController::class, 'map']);
Route::get('/terrains/nearby', [TerrainController::class, 'nearby']);
Route::get('/terrains', [TerrainController::class, 'index']);
Route::get('/terrains/{terrain}/disponibilites', [TerrainAvailabilityController::class, 'show'])->whereNumber('terrain');
Route::get('/terrains/{terrain}', [TerrainController::class, 'show'])->whereNumber('terrain');
Route::get('/terrain-images/{terrainImage}', [TerrainImageController::class, 'show'])
	->whereNumber('terrainImage')
	->name('terrain-images.show');

Route::middleware('auth:sanctum')->group(function () {
	Route::get('/user', [AuthController::class, 'user']);
	Route::patch('/user', [AuthController::class, 'updateProfile']);
	Route::post('/logout', [AuthController::class, 'logout']);
	Route::get('/notifications', [NotificationUtilisateurController::class, 'index']);
	Route::patch('/notifications/{notification}/lu', [NotificationUtilisateurController::class, 'markAsRead'])
		->whereNumber('notification');

	Route::middleware('role:CLIENT')->get('/client/reservations', [ClientReservationController::class, 'index']);
	Route::middleware('role:CLIENT')->group(function () {
		Route::post('/client/reservations', [ClientReservationController::class, 'store']);
		Route::post('/client/reservations/{reservation}/annuler', [ClientReservationController::class, 'cancel'])
			->whereNumber('reservation');
		Route::get('/client/reservations/{reservation}/paiements', [PaiementController::class, 'index'])
			->whereNumber('reservation');
		Route::post('/client/reservations/{reservation}/paiements', [PaiementController::class, 'store'])
			->whereNumber('reservation');
	});
	Route::middleware('role:GESTIONNAIRE')->group(function () {
		Route::get('/gestionnaire/communes', [GestionnaireTerrainController::class, 'communes']);
		Route::get('/gestionnaire/terrains', [TerrainController::class, 'managedIndex']);
		Route::post('/gestionnaire/terrains', [TerrainController::class, 'store']);
		Route::match(['put', 'patch'], '/gestionnaire/terrains/{terrain}', [TerrainController::class, 'update'])
			->whereNumber('terrain');
		Route::delete('/gestionnaire/terrains/{terrain}', [TerrainController::class, 'destroy'])
			->whereNumber('terrain');
		Route::post('/gestionnaire/terrains/{terrain}/images', [TerrainImageController::class, 'store'])
			->whereNumber('terrain');
		Route::patch('/gestionnaire/terrains/{terrain}/images/{image}/principal', [TerrainImageController::class, 'setPrimary'])
			->whereNumber('terrain')
			->whereNumber('image');
		Route::delete('/gestionnaire/terrains/{terrain}/images/{image}', [TerrainImageController::class, 'destroy'])
			->whereNumber('terrain')
			->whereNumber('image');
		Route::get('/gestionnaire/terrains/{terrain}/horaires', [TerrainPlanningController::class, 'horaires'])
			->whereNumber('terrain');
		Route::post('/gestionnaire/terrains/{terrain}/horaires', [TerrainPlanningController::class, 'storeHoraire'])
			->whereNumber('terrain');
		Route::put('/gestionnaire/terrains/{terrain}/horaires/{horaire}', [TerrainPlanningController::class, 'updateHoraire'])
			->whereNumber('terrain')
			->whereNumber('horaire');
		Route::delete('/gestionnaire/terrains/{terrain}/horaires/{horaire}', [TerrainPlanningController::class, 'destroyHoraire'])
			->whereNumber('terrain')
			->whereNumber('horaire');
		Route::get('/gestionnaire/terrains/{terrain}/indisponibilites', [TerrainPlanningController::class, 'indisponibilites'])
			->whereNumber('terrain');
		Route::post('/gestionnaire/terrains/{terrain}/indisponibilites', [TerrainPlanningController::class, 'storeIndisponibilite'])
			->whereNumber('terrain');
		Route::put('/gestionnaire/terrains/{terrain}/indisponibilites/{indisponibilite}', [TerrainPlanningController::class, 'updateIndisponibilite'])
			->whereNumber('terrain')
			->whereNumber('indisponibilite');
		Route::delete('/gestionnaire/terrains/{terrain}/indisponibilites/{indisponibilite}', [TerrainPlanningController::class, 'destroyIndisponibilite'])
			->whereNumber('terrain')
			->whereNumber('indisponibilite');
		Route::get('/gestionnaire/reservations', [GestionnaireReservationController::class, 'index']);
		Route::post('/gestionnaire/reservations/{reservation}/confirmer', [GestionnaireReservationController::class, 'confirm'])
			->whereNumber('reservation');
		Route::post('/gestionnaire/reservations/{reservation}/refuser', [GestionnaireReservationController::class, 'refuse'])
			->whereNumber('reservation');
		Route::patch('/gestionnaire/paiements/{paiement}/statut', [PaiementController::class, 'updateStatus'])
			->whereNumber('paiement');
	});

	Route::middleware('role:ADMINISTRATEUR')->group(function () {
		Route::get('/admin/users', [UserRoleController::class, 'index']);
		Route::patch('/admin/users/{user}/role', [UserRoleController::class, 'update']);
	});
});
