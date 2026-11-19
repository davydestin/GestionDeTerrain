<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\LogReader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Validation\Rule;

/**
 * Logs techniques (erreurs, avertissements…) consultables par l'administrateur.
 * Lecture seule : aucune route ne modifie ni ne supprime les fichiers.
 */
class LogController extends Controller
{
    public function index(Request $request, LogReader $reader): JsonResponse
    {
        $filters = $request->validate([
            'fichier' => ['sometimes', 'string', 'max:100'],
            'niveau' => ['sometimes', 'string', Rule::in(LogReader::LEVELS)],
            'environnement' => ['sometimes', 'string', 'max:30'],
            'search' => ['sometimes', 'string', 'max:200'],
            'inclure_tests' => ['sometimes', 'boolean'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        $files = $reader->files();
        $file = $reader->resolve($filters['fichier'] ?? null);

        if (isset($filters['fichier']) && $file === null) {
            abort(404, 'Fichier de log introuvable.');
        }

        ['entrees' => $all, 'tronque' => $truncated] = $file ? $reader->entries($file) : ['entrees' => [], 'tronque' => false];

        // Les erreurs simulées par les tests automatiques (environnement « testing ») ne sont pas de vrais
        // incidents : masquées par défaut. (Depuis phpunit.xml LOG_CHANNEL=null, les tests n'en écrivent plus.)
        $testEntries = count(array_filter($all, fn (array $entry): bool => $entry['environnement'] === 'testing'));
        if (! $request->boolean('inclure_tests')) {
            $all = array_values(array_filter($all, fn (array $entry): bool => $entry['environnement'] !== 'testing'));
        }

        // Compteurs par niveau sur tout le fichier (avant filtre de niveau), pour les pastilles de l'interface.
        $counts = array_count_values(array_column($all, 'niveau'));
        $environments = array_values(array_unique(array_column($all, 'environnement')));

        $search = mb_strtolower($filters['search'] ?? '');
        $filtered = array_values(array_filter($all, fn (array $entry): bool => (! isset($filters['niveau']) || $entry['niveau'] === $filters['niveau'])
            && (! isset($filters['environnement']) || $entry['environnement'] === $filters['environnement'])
            && ($search === '' || str_contains(mb_strtolower($entry['message'].' '.$entry['details']), $search))));

        $page = (int) ($filters['page'] ?? 1);
        $perPage = 30;
        $paginator = new LengthAwarePaginator(
            array_slice($filtered, ($page - 1) * $perPage, $perPage),
            count($filtered),
            $perPage,
            $page,
        );

        return response()->json([
            'fichiers' => $files,
            'fichier' => $file,
            'tronque' => $truncated,
            'compteurs' => $counts,
            'environnements' => $environments,
            'entrees_tests' => $testEntries,
            'entrees' => [
                'data' => $paginator->items(),
                'total' => $paginator->total(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }
}
