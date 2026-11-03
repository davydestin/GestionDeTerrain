<?php

namespace App\Http\Controllers;

use App\Models\NotificationUtilisateur;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationUtilisateurController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'notifications' => $request->user()
                ->notificationsUtilisateur()
                ->orderByDesc('created_at')
                ->limit(50)
                ->get(),
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
}