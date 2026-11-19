<?php

namespace App\Services;

use App\Models\JournalAudit;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Écrit dans le journal d'audit.
 *
 * Usage : AuditLogger::log('terrain.modifie', 'Terrain « X » modifié', $terrain, ['changements' => ...]);
 * L'auteur, l'adresse IP et le navigateur sont lus dans la requête courante.
 * Un échec d'écriture du journal est consigné dans les logs Laravel mais n'interrompt jamais l'action.
 */
class AuditLogger
{
    /** Champs jamais recopiés dans le journal, même s'ils changent. */
    private const SECRETS = ['password', 'password_confirmation', 'remember_token'];

    public static function log(
        string $action,
        string $description,
        ?Model $cible = null,
        array $details = [],
        ?User $auteur = null,
    ): ?JournalAudit {
        try {
            $request = request();
            $auteur ??= $request?->user();

            return JournalAudit::create([
                'utilisateur_id' => $auteur?->getKey(),
                'utilisateur_nom' => $auteur ? trim($auteur->prenom.' '.$auteur->nom) : null,
                'utilisateur_email' => $auteur?->email,
                'utilisateur_role' => $auteur?->role,
                'action' => $action,
                'cible_type' => $cible ? Str::snake(class_basename($cible)) : null,
                'cible_id' => $cible?->getKey(),
                'description' => Str::limit($description, 497),
                'details' => $details === [] ? null : $details,
                'adresse_ip' => $request?->ip(),
                'user_agent' => $request ? Str::limit((string) $request->userAgent(), 252) : null,
            ]);
        } catch (Throwable $exception) {
            Log::error('Écriture du journal d’audit impossible.', ['action' => $action, 'exception' => $exception]);

            return null;
        }
    }

    /**
     * Différences « avant / après » d'un modèle qui vient d'être enregistré (à appeler après save/update).
     * Les secrets sont remplacés par un simple indicateur de modification.
     *
     * @return array<string, array{avant: mixed, apres: mixed}>
     */
    public static function changes(Model $model): array
    {
        $changes = [];
        $previous = $model->getPrevious();

        foreach ($model->getChanges() as $field => $value) {
            if (in_array($field, ['updated_at', 'created_at'], true)) {
                continue;
            }

            $changes[$field] = in_array($field, self::SECRETS, true)
                ? ['avant' => '••••', 'apres' => '•••• (modifié)']
                : ['avant' => $previous[$field] ?? null, 'apres' => $value];
        }

        return $changes;
    }

    public static function userLabel(User $user): string
    {
        return trim($user->prenom.' '.$user->nom).' ('.$user->email.')';
    }
}
