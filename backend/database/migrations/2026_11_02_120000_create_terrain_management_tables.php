<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('terrains', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gestionnaire_id')->constrained('users')->restrictOnDelete();
            $table->string('nom', 150);
            $table->text('description')->nullable();
            $table->string('adresse', 255);
            $table->string('ville', 100);
            $table->string('type', 100);
            $table->unsignedInteger('capacite');
            $table->decimal('tarif_horaire', 10, 2);
            $table->enum('statut', ['ACTIF', 'INACTIF'])->default('ACTIF');
            $table->timestamps();
        });

        Schema::create('terrain_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('terrain_id')->constrained('terrains')->cascadeOnDelete();
            $table->string('chemin_image', 255);
            $table->boolean('est_principale')->default(false);
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('horaires', function (Blueprint $table) {
            $table->id();
            $table->foreignId('terrain_id')->constrained('terrains')->cascadeOnDelete();
            $table->unsignedTinyInteger('jour_semaine');
            $table->time('heure_ouverture');
            $table->time('heure_fermeture');
            $table->boolean('actif')->default(true);
            $table->unique(['terrain_id', 'jour_semaine']);
        });

        Schema::create('indisponibilites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('terrain_id')->constrained('terrains')->cascadeOnDelete();
            $table->dateTime('date_debut');
            $table->dateTime('date_fin');
            $table->text('motif')->nullable();
            $table->index(['terrain_id', 'date_debut', 'date_fin']);
        });

        Schema::create('reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('utilisateur_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('terrain_id')->constrained('terrains')->restrictOnDelete();
            $table->dateTime('date_debut');
            $table->dateTime('date_fin');
            $table->decimal('montant_total', 10, 2);
            $table->enum('statut', ['EN_ATTENTE', 'CONFIRMEE', 'ANNULEE', 'REFUSEE', 'TERMINEE'])->default('EN_ATTENTE');
            $table->text('commentaire')->nullable();
            $table->timestamps();
            $table->index(['terrain_id', 'statut', 'date_debut', 'date_fin']);
        });

        Schema::create('paiements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reservation_id')->constrained('reservations')->restrictOnDelete();
            $table->decimal('montant', 10, 2);
            $table->enum('methode', ['WAVE', 'ORANGE_MONEY', 'FREE_MONEY', 'ESPECES', 'CARTE']);
            $table->string('reference_transaction', 255)->nullable();
            $table->enum('statut', ['EN_ATTENTE', 'PAYE', 'ECHOUE', 'REMBOURSE'])->default('EN_ATTENTE');
            $table->dateTime('date_paiement')->nullable();
            $table->timestamps();
            $table->unique(['methode', 'reference_transaction']);
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('utilisateur_id')->constrained('users')->cascadeOnDelete();
            $table->string('titre', 150);
            $table->text('message');
            $table->boolean('lu')->default(false);
            $table->timestamp('created_at')->useCurrent();
            $table->index(['utilisateur_id', 'lu']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('paiements');
        Schema::dropIfExists('reservations');
        Schema::dropIfExists('indisponibilites');
        Schema::dropIfExists('horaires');
        Schema::dropIfExists('terrain_images');
        Schema::dropIfExists('terrains');
    }
};