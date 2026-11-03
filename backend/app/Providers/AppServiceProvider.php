<?php

namespace App\Providers;

use App\Models\Terrain;
use App\Models\Reservation;
use App\Policies\TerrainPolicy;
use App\Policies\ReservationPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::policy(Terrain::class, TerrainPolicy::class);
        Gate::policy(Reservation::class, ReservationPolicy::class);
    }
}
