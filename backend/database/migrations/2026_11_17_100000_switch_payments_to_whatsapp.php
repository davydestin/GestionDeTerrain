<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Le paiement ne se fait plus dans l'application : après validation d'une demande,
 * le gestionnaire contacte le client sur WhatsApp pour convenir des modalités.
 *
 *  - reservations.telephone_whatsapp : numéro donné par le client au moment de réserver ;
 *  - notifications.reservation_id    : lien vers la réservation concernée ;
 *  - suppression de la table paiements (vide au moment de ce changement).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->string('telephone_whatsapp', 20)->nullable()->after('commentaire');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignId('reservation_id')
                ->nullable()
                ->after('utilisateur_id')
                ->constrained('reservations')
                ->nullOnDelete();
        });

        Schema::dropIfExists('paiements');
    }

    public function down(): void
    {
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

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropForeign(['reservation_id']);
            $table->dropColumn('reservation_id');
        });

        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn('telephone_whatsapp');
        });
    }
};
