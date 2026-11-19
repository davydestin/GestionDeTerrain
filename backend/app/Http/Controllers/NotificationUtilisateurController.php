<?php

namespace App\Http\Controllers;

use App\Models\NotificationUtilisateur;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationUtilisateurController extends Controller
{
    /** Dernières notifications + nombre de non lues (interrogé régulièrement par la cloche de l'en-tête). */
    public function index(Request $request): JsonResponse
    {
        $notifications = $request->user()->notificationsUtilisateur();

        return response()->json([
            'notifications' => (clone $notifications)
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->limit(30)
                ->get(),
            'non_lues' => (clone $notifications)->where('lu', false)->count(),
        ]);
    }

    public function markAsRead(Request $request, NotificationUtilisateur $notification): JsonResponse
    {
        $notification = $request->user()
            ->notificationsUtilisateur()
            ->findOrFail($notification->id);
        $notification->update(['lu' => true]);

        return response()->json(['notification' => $notification->fresh()]);
    }

    public function markAllAsRead(Request $request): JsonResponse
    {
        $updated = $request->user()->notificationsUtilisateur()->where('lu', false)->update(['lu' => true]);

        return response()->json(['marquees' => $updated, 'non_lues' => 0]);
    }
}
