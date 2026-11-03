<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('communes', function (Blueprint $table) {
            $table->id();
            $table->string('nom', 100)->unique();
        });

        Schema::table('terrains', function (Blueprint $table) {
            $table->foreignId('commune_id')
                ->nullable()
                ->after('gestionnaire_id')
                ->constrained('communes')
                ->restrictOnDelete();
            $table->string('quartier', 100)->nullable()->after('ville');
            $table->decimal('latitude', 10, 7)->nullable()->after('quartier');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->string('ville', 100)->default('Dakar')->change();
        });
    }

    public function down(): void
    {
        Schema::table('terrains', function (Blueprint $table) {
            $table->dropForeign(['commune_id']);
            $table->dropColumn(['commune_id', 'quartier', 'latitude', 'longitude']);
        });

        Schema::dropIfExists('communes');
    }
};