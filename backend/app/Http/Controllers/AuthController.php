<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Http\Requests\UpdateProfileRequest;
use App\Services\AuditLogger;
use App\Services\GoogleIdTokenVerifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Une seule page de connexion pour tous :
 *  - e-mail + mot de passe : clients (inscrits par le formulaire), gestionnaires et administrateurs
 *    (identifiants créés par l'administrateur) ;
 *  - Google : option réservée aux clients, pour s'inscrire ou se connecter sans mot de passe.
 */
class AuthController
{
    public const STAFF_PASSWORD_ONLY = 'Ce compte gestionnaire ou administrateur se connecte avec l’e-mail et le mot de passe fournis par l’administrateur.';

    public const GOOGLE_ACCOUNT_HINT = 'Ce compte a été créé avec Google : utilisez « Continuer avec Google ».';

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nom' => ['required', 'string', 'max:100'],
            'prenom' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'telephone' => ['nullable', 'string', 'max:20'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::create($validated + [
            'role' => User::ROLE_CLIENT,
            'statut' => true,
        ]);

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        AuditLogger::log('auth.inscription', 'Inscription de '.AuditLogger::userLabel($user), $user, ['methode' => 'formulaire'], $user);

        return response()->json(['user' => $user], 201);
    }

    /** Connexion e-mail + mot de passe : ouverte à tous les rôles. */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $guard = Auth::guard('web');
        $target = User::query()->where('email', $credentials['email'])->first();
        $validPassword = $guard->validate($credentials);

        if (! $validPassword || ! $target?->statut) {
            // Le mot de passe saisi n'est jamais conservé.
            $this->logFailedLogin(
                $credentials['email'],
                $target,
                $validPassword ? 'compte désactivé' : 'identifiants invalides',
            );

            // Compte client créé avec Google, sans mot de passe : on l'oriente vers le bouton Google.
            $googleOnly = $target && filled($target->google_id) && blank($target->getAuthPassword());

            return response()->json(['message' => $googleOnly ? self::GOOGLE_ACCOUNT_HINT : 'Identifiants invalides.'], 422);
        }

        $guard->login($target);
        $request->session()->regenerate();
        AuditLogger::log('auth.connexion', 'Connexion de '.AuditLogger::userLabel($target), $target, ['methode' => 'mot de passe']);

        return response()->json(['user' => $target]);
    }

    /**
     * Connexion client avec Google : reçoit soit le jeton d'accès de notre bouton « Continuer avec Google »
     * (`access_token`), soit un jeton d'identité Google (`credential`), puis retrouve le client
     * (identifiant Google, sinon e-mail) ou crée son compte.
     */
    public function google(Request $request, GoogleIdTokenVerifier $verifier): JsonResponse
    {
        $validated = $request->validate([
            'access_token' => ['required_without:credential', 'string', 'max:4096'],
            'credential' => ['required_without:access_token', 'string', 'max:4096'],
        ]);

        $profile = isset($validated['access_token'])
            ? $verifier->verifyAccessToken($validated['access_token'])
            : $verifier->verify($validated['credential']);

        $user = User::query()->where('google_id', $profile['sub'])->first()
            ?? User::query()->where('email', $profile['email'])->first();

        if ($user && $user->role !== User::ROLE_CLIENT) {
            $this->logFailedLogin($profile['email'], $user, 'gestionnaire / administrateur : mot de passe obligatoire', 'Google');

            return response()->json(['message' => self::STAFF_PASSWORD_ONLY], 403);
        }

        if ($user && ! $user->statut) {
            $this->logFailedLogin($profile['email'], $user, 'compte désactivé', 'Google');

            return response()->json(['message' => 'Ce compte a été désactivé.'], 403);
        }

        if ($user && filled($user->google_id) && $user->google_id !== $profile['sub']) {
            $this->logFailedLogin($profile['email'], $user, 'compte déjà lié à un autre compte Google', 'Google');

            return response()->json(['message' => 'Cette adresse e-mail est déjà liée à un autre compte Google.'], 409);
        }

        $created = $user === null;

        $user = DB::transaction(function () use ($user, $profile): User {
            if ($user === null) {
                return User::create([
                    'nom' => $profile['nom'],
                    'prenom' => $profile['prenom'],
                    'email' => $profile['email'],
                    'google_id' => $profile['sub'],
                    'password' => null,
                    'role' => User::ROLE_CLIENT,
                    'statut' => true,
                ]);
            }

            // Client existant (inscrit avant Google) : on lie son compte Google à la première connexion.
            if (blank($user->google_id)) {
                $user->forceFill(['google_id' => $profile['sub']])->save();
            }

            return $user;
        });

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        $created
            ? AuditLogger::log('auth.inscription', 'Inscription avec Google de '.AuditLogger::userLabel($user), $user, ['methode' => 'Google'], $user)
            : AuditLogger::log('auth.connexion', 'Connexion avec Google de '.AuditLogger::userLabel($user), $user, ['methode' => 'Google'], $user);

        return response()->json(['user' => $user->fresh()], $created ? 201 : 200);
    }

    private function logFailedLogin(string $email, ?User $target, string $motif, string $methode = 'mot de passe'): void
    {
        AuditLogger::log('auth.connexion_echouee', 'Échec de connexion pour '.$email, $target, [
            'motif' => $motif,
            'methode' => $methode,
        ]);
    }

    public function user(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->user()]);
    }

    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->update($request->validated());

        if ($changes = AuditLogger::changes($user)) {
            AuditLogger::log('profil.modifie', 'Profil modifié par '.AuditLogger::userLabel($user), $user, ['changements' => $changes]);
        }

        return response()->json(['user' => $request->user()->fresh()]);
    }

    public function logout(Request $request): JsonResponse
    {
        if ($user = $request->user()) {
            AuditLogger::log('auth.deconnexion', 'Déconnexion de '.AuditLogger::userLabel($user), $user);
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Déconnexion réussie.']);
    }
}