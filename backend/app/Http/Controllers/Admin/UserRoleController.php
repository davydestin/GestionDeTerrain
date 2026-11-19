<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditLogger;
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

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nom' => ['required', 'string', 'max:100'],
            'prenom' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'telephone' => ['nullable', 'string', 'max:20'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', 'string', Rule::in(User::ROLES)],
            'statut' => ['sometimes', 'boolean'],
        ]);

        $user = User::create($validated + ['statut' => $validated['statut'] ?? true]);

        AuditLogger::log('utilisateur.cree', 'Création du compte '.AuditLogger::userLabel($user), $user, [
            'role' => $user->role,
            'statut' => $user->statut ? 'actif' : 'désactivé',
        ]);

        return response()->json(['user' => $user], 201);
    }

    public function edit(Request $request, User $user): JsonResponse
    {
        $this->ensureNotClient($user);

        $validated = $request->validate([
            'nom' => ['sometimes', 'required', 'string', 'max:100'],
            'prenom' => ['sometimes', 'required', 'string', 'max:100'],
            'email' => ['sometimes', 'required', 'email', 'max:150', Rule::unique('users', 'email')->ignore($user->id)],
            'telephone' => ['nullable', 'string', 'max:20'],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['sometimes', 'required', 'string', Rule::in(User::ROLES)],
            'statut' => ['sometimes', 'boolean'],
        ]);

        if ($request->user()->is($user)) {
            if (($validated['role'] ?? $user->role) !== User::ROLE_ADMINISTRATEUR) {
                throw new HttpException(409, 'Un administrateur ne peut pas retirer son propre rôle administrateur.');
            }

            if (array_key_exists('statut', $validated) && ! $validated['statut']) {
                throw new HttpException(409, 'Un administrateur ne peut pas désactiver son propre compte.');
            }
        }

        if (array_key_exists('password', $validated) && $validated['password'] === null) {
            unset($validated['password']);
        }

        $user->update($validated);
        $this->logUserChanges($user);

        return response()->json(['user' => $user->fresh()]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()->is($user)) {
            throw new HttpException(409, 'Un administrateur ne peut pas supprimer son propre compte.');
        }

        $hasHistory = $user->reservations()->exists()
            || $user->terrains()->withTrashed()->exists();

        if ($hasHistory) {
            throw new HttpException(
                409,
                'Ce compte possède des terrains ou des réservations : désactivez-le plutôt que de le supprimer.'
            );
        }

        $label = AuditLogger::userLabel($user);
        $role = $user->role;
        $user->delete();

        AuditLogger::log('utilisateur.supprime', 'Suppression du compte '.$label, $user, ['role' => $role]);

        return response()->json(['message' => 'Utilisateur supprimé.']);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->ensureNotClient($user);

        $validated = $request->validate([
            'role' => ['required', 'string', Rule::in(User::ROLES)],
        ]);

        if ($request->user()->is($user) && $validated['role'] !== User::ROLE_ADMINISTRATEUR) {
            throw new HttpException(409, 'Un administrateur ne peut pas retirer son propre rôle administrateur.');
        }

        $user->update($validated);
        $this->logUserChanges($user);

        return response()->json(['user' => $user->fresh()]);
    }

    /**
     * Une seule entrée par requête, nommée d'après le changement le plus significatif
     * (activation / désactivation, puis rôle, sinon modification générale).
     */
    private function logUserChanges(User $user): void
    {
        $changes = AuditLogger::changes($user);

        if ($changes === []) {
            return;
        }

        $label = AuditLogger::userLabel($user);
        [$action, $description] = match (true) {
            isset($changes['statut']) && $user->statut => ['utilisateur.active', 'Réactivation du compte '.$label],
            isset($changes['statut']) => ['utilisateur.desactive', 'Désactivation du compte '.$label],
            isset($changes['role']) => ['utilisateur.role_modifie', sprintf(
                'Rôle de %s : %s → %s',
                $label,
                $changes['role']['avant'],
                $changes['role']['apres'],
            )],
            default => ['utilisateur.modifie', 'Modification du compte '.$label],
        };

        AuditLogger::log($action, $description, $user, ['changements' => $changes]);
    }

    /**
     * Un compte client n'est modifiable que par le client lui-même (son profil) :
     * l'administrateur peut le consulter ou le supprimer, mais ni le modifier ni changer son rôle.
     */
    private function ensureNotClient(User $user): void
    {
        if ($user->role === User::ROLE_CLIENT) {
            throw new HttpException(403, 'Un administrateur ne peut pas modifier un compte client : seul le client peut modifier son profil.');
        }
    }
}
