<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\HttpException;

class UserRoleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['sometimes', 'string', 'max:100'],
            'role' => ['sometimes', 'string', Rule::in(User::ROLES)],
            'statut' => ['sometimes', Rule::in(['actif', 'inactif'])],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        $users = User::query()
            ->select(['id', 'nom', 'prenom', 'email', 'telephone', 'role', 'statut', 'created_at'])
            ->when($filters['search'] ?? null, function ($query, string $search): void {
                $query->where(function ($query) use ($search): void {
                    $like = '%'.$search.'%';
                    $query->where('nom', 'like', $like)
                        ->orWhere('prenom', 'like', $like)
                        ->orWhere('email', 'like', $like)
                        ->orWhere('telephone', 'like', $like);
                });
            })
            ->when(isset($filters['role']), fn ($query) => $query->where('role', $filters['role']))
            ->when(isset($filters['statut']), fn ($query) => $query->where('statut', $filters['statut'] === 'actif'))
            ->orderBy('nom')
            ->orderBy('prenom')
            ->paginate(20)
            ->withQueryString();

        return response()->json(['users' => $users]);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['required', 'string', Rule::in(User::ROLES)],
        ]);

        if ($request->user()->is($user) && $validated['role'] !== User::ROLE_ADMINISTRATEUR) {
            throw new HttpException(409, 'Un administrateur ne peut pas retirer son propre rôle administrateur.');
        }

        $user->update($validated);

        return response()->json(['user' => $user->fresh()]);
    }
}