<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Motif donné par le gestionnaire quand il refuse une demande, affiché au client
 * dans « Mes réservations ». Jusqu'ici, il n'existait que dans le texte de la notification.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->string('motif_refus', 255)->nullable()->after('commentaire');
        });

        // Refus déjà prononcés : on récupère le motif depuis la notification envoyée au client.
        DB::table('notifications')
            ->where('titre', 'Réservation refusée')
            ->whereNotNull('reservation_id')
            ->where('message', 'like', '%Motif : %')
            ->orderBy('id')
            ->each(function ($notification): void {
                $motif = trim(substr($notification->message, strrpos($notification->message, 'Motif : ') + strlen('Motif : ')));

                DB::table('reservations')
                    ->where('id', $notification->reservation_id)
                    ->whereNull('motif_refus')
                    ->update(['motif_refus' => mb_substr($motif, 0, 255)]);
            });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn('motif_refus');
        });
    }
};
