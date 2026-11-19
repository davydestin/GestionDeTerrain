<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Journal d'audit consulté par l'administrateur : qui a fait quoi, sur quoi, quand et d'où.
 *
 * Les entrées ne sont jamais modifiées. L'identité de l'auteur est recopiée (nom, e-mail, rôle)
 * pour que l'historique reste lisible même après la suppression du compte.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('journal_audit', function (Blueprint $table) {
            $table->id();
            $table->foreignId('utilisateur_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('utilisateur_nom', 210)->nullable();
            $table->string('utilisateur_email', 150)->nullable();
            $table->string('utilisateur_role', 20)->nullable();
            $table->string('action', 60);
            $table->string('cible_type', 40)->nullable();
            $table->unsignedBigInteger('cible_id')->nullable();
            $table->string('description', 500);
            $table->json('details')->nullable();
            $table->string('adresse_ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('created_at');
            $table->index(['action', 'created_at']);
            $table->index(['cible_type', 'cible_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('journal_audit');
    }
};
