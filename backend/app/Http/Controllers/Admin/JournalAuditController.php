<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\Search;
use App\Models\JournalAudit;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Consultation du journal d'audit par l'administrateur (lecture seule : aucune route
 * ne permet de modifier ou d'effacer une entrée).
 */
class JournalAuditController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['sometimes', 'string', 'max:100'],
            'action' => ['sometimes', 'string', Rule::in(array_keys(JournalAudit::ACTIONS))],
            'categorie' => ['sometimes', 'string', Rule::in(['auth', 'profil', 'utilisateur', 'terrain', 'reservation'])],
            'role' => ['sometimes', 'string', Rule::in(User::ROLES)],
            'utilisateur_id' => ['sometimes', 'integer'],
            'du' => ['sometimes', 'date_format:Y-m-d'],
            'au' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:du'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        $entries = JournalAudit::query()
            ->when($filters['search'] ?? null, function ($query, string $search): void {
                $like = '%'.$search.'%';
                $query->where(fn ($query) => $query
                    ->where('description', Search::like(), $like)
                    ->orWhere('utilisateur_nom', Search::like(), $like)
                    ->orWhere('utilisateur_email', Search::like(), $like)
                    ->orWhere('adresse_ip', Search::like(), $like));
            })
            ->when($filters['action'] ?? null, fn ($query, $action) => $query->where('action', $action))
            ->when($filters['categorie'] ?? null, fn ($query, $categorie) => $query->where('action', Search::like(), $categorie.'.%'))
            ->when($filters['role'] ?? null, fn ($query, $role) => $query->where('utilisateur_role', $role))
            ->when($filters['utilisateur_id'] ?? null, fn ($query, $id) => $query->where('utilisateur_id', $id))
            ->when($filters['du'] ?? null, fn ($query, $date) => $query->where('created_at', '>=', $date.' 00:00:00'))
            ->when($filters['au'] ?? null, fn ($query, $date) => $query->where('created_at', '<=', $date.' 23:59:59'))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString();

        return response()->json([
            'entrees' => $entries,
            'actions' => JournalAudit::ACTIONS,
        ]);
    }
}
