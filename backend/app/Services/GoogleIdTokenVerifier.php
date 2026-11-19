<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Vérifie le jeton d'identité (« credential ») renvoyé par le bouton « Se connecter avec Google ».
 *
 * Google contrôle la signature et l'expiration via son point d'accès tokeninfo ; on vérifie ensuite
 * que le jeton a bien été émis pour cette application (aud), par Google (iss), et que l'e-mail est vérifié.
 */
class GoogleIdTokenVerifier
{
    private const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

    private const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

    private const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

    /**
     * @return array{sub: string, email: string, prenom: string, nom: string}
     */
    public function verify(string $idToken): array
    {
        $clientId = $this->clientId();

        try {
            $response = Http::timeout(8)->acceptJson()->get(self::TOKENINFO_URL, ['id_token' => $idToken]);
        } catch (ConnectionException) {
            throw new HttpException(503, 'Google est injoignable pour le moment. Réessayez dans un instant.');
        }

        $claims = $response->json() ?? [];

        $valid = $response->successful()
            && ($claims['aud'] ?? null) === $clientId
            && in_array($claims['iss'] ?? null, self::ISSUERS, true)
            && in_array($claims['email_verified'] ?? null, [true, 'true'], true)
            && filled($claims['sub'] ?? null)
            && filled($claims['email'] ?? null)
            && (int) ($claims['exp'] ?? 0) > time();

        if (! $valid) {
            throw new HttpException(401, 'La connexion avec Google a échoué. Réessayez.');
        }

        return $this->profile($claims);
    }

    /**
     * Jeton d'accès obtenu par notre propre bouton « Continuer avec Google » (fenêtre de choix du compte).
     * On vérifie auprès de Google qu'il a été délivré à CETTE application (aud / azp), qu'il n'est pas
     * expiré et que l'e-mail est vérifié, puis on lit le prénom et le nom.
     *
     * @return array{sub: string, email: string, prenom: string, nom: string}
     */
    public function verifyAccessToken(string $accessToken): array
    {
        $clientId = $this->clientId();

        try {
            $response = Http::timeout(8)->acceptJson()->get(self::TOKENINFO_URL, ['access_token' => $accessToken]);
        } catch (ConnectionException) {
            throw new HttpException(503, 'Google est injoignable pour le moment. Réessayez dans un instant.');
        }

        $claims = $response->json() ?? [];

        // Sans ce contrôle, un jeton délivré à un autre site permettrait de se connecter ici.
        $valid = $response->successful()
            && (($claims['aud'] ?? null) === $clientId || ($claims['azp'] ?? null) === $clientId)
            && in_array($claims['email_verified'] ?? null, [true, 'true'], true)
            && filled($claims['sub'] ?? null)
            && filled($claims['email'] ?? null)
            && (int) ($claims['exp'] ?? 0) > time();

        if (! $valid) {
            throw new HttpException(401, 'La connexion avec Google a échoué. Réessayez.');
        }

        // Prénom / nom : facultatifs, on se rabat sur l'e-mail si Google ne répond pas.
        try {
            $info = Http::timeout(8)->acceptJson()->withToken($accessToken)->get(self::USERINFO_URL);
            if ($info->successful() && ($info->json('sub') === $claims['sub'])) {
                $claims += $info->json();
            }
        } catch (ConnectionException) {
            // Le compte reste identifié par sub + email vérifiés ci-dessus.
        }

        return $this->profile($claims);
    }

    private function clientId(): string
    {
        $clientId = config('services.google.client_id');

        if (blank($clientId)) {
            throw new HttpException(503, 'La connexion avec Google n’est pas configurée sur le serveur (GOOGLE_CLIENT_ID).');
        }

        return $clientId;
    }

    /** @return array{sub: string, email: string, prenom: string, nom: string} */
    private function profile(array $claims): array
    {
        $email = mb_strtolower($claims['email']);

        return [
            'sub' => (string) $claims['sub'],
            'email' => $email,
            'prenom' => $claims['given_name'] ?? ($claims['name'] ?? strstr($email, '@', true)),
            'nom' => $claims['family_name'] ?? '',
        ];
    }
}
