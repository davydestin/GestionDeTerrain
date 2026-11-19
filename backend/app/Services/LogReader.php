<?php

namespace App\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

/**
 * Lecture des logs techniques de Laravel (storage/logs) pour l'espace administrateur.
 *
 * Format lu : « [2026-11-19 13:20:52] local.ERROR: message {contexte} » suivi éventuellement
 * d'une trace d'appels sur plusieurs lignes. Seuls les fichiers laravel*.log du dossier sont
 * accessibles (aucun chemin fourni par le client n'est utilisé tel quel).
 */
class LogReader
{
    public const LEVELS = ['EMERGENCY', 'ALERT', 'CRITICAL', 'ERROR', 'WARNING', 'NOTICE', 'INFO', 'DEBUG'];

    /** On ne lit que la fin d'un fichier volumineux : les entrées récentes sont celles qui comptent. */
    private const MAX_BYTES = 3 * 1024 * 1024;

    private const MAX_DETAILS = 12000;

    private const ENTRY_START = '/^\[(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:?\d{2})?)\] (\w+)\.(\w+): /m';

    public function __construct(private ?string $directory = null)
    {
        $this->directory ??= storage_path('logs');
    }

    /**
     * Fichiers de log disponibles, du plus récent au plus ancien.
     *
     * @return list<array{nom: string, taille: int, modifie_le: string}>
     */
    public function files(): array
    {
        if (! File::isDirectory($this->directory)) {
            return [];
        }

        return collect(File::files($this->directory))
            ->filter(fn ($file) => preg_match('/^laravel(-\d{4}-\d{2}-\d{2})?\.log$/', $file->getFilename()) === 1)
            ->sortByDesc(fn ($file) => $file->getMTime())
            ->map(fn ($file) => [
                'nom' => $file->getFilename(),
                'taille' => $file->getSize(),
                'modifie_le' => Carbon::createFromTimestamp($file->getMTime())->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    /** Vérifie que le nom demandé fait partie des fichiers listés (protection contre « ../ »). */
    public function resolve(?string $name): ?string
    {
        $names = array_column($this->files(), 'nom');
        $name ??= $names[0] ?? null;

        return $name !== null && in_array($name, $names, true) ? $name : null;
    }

    /**
     * Entrées d'un fichier, de la plus récente à la plus ancienne.
     *
     * @return array{entrees: list<array<string, mixed>>, tronque: bool}
     */
    public function entries(string $name): array
    {
        $path = $this->directory.DIRECTORY_SEPARATOR.$name;
        $size = filesize($path) ?: 0;
        $truncated = $size > self::MAX_BYTES;

        $handle = fopen($path, 'rb');
        if ($truncated) {
            fseek($handle, -self::MAX_BYTES, SEEK_END);
        }
        $content = stream_get_contents($handle) ?: '';
        fclose($handle);

        if ($truncated) {
            // On repart au début de la première entrée complète.
            preg_match(self::ENTRY_START, $content, $first, PREG_OFFSET_CAPTURE);
            $content = isset($first[0]) ? substr($content, $first[0][1]) : '';
        }

        $content = mb_convert_encoding($content, 'UTF-8', 'UTF-8');
        preg_match_all(self::ENTRY_START, $content, $matches, PREG_OFFSET_CAPTURE | PREG_SET_ORDER);

        $entries = [];
        foreach ($matches as $index => $match) {
            $start = $match[0][1];
            $end = $matches[$index + 1][0][1] ?? strlen($content);
            $body = rtrim(substr($content, $start + strlen($match[0][0]), $end - $start - strlen($match[0][0])));

            [$message, $details] = $this->split($body);

            $entries[] = [
                'id' => $name.':'.$start,
                'date' => $this->date($match[1][0]),
                'environnement' => $match[2][0],
                'niveau' => strtoupper($match[3][0]),
                'message' => Str::limit($message, 500),
                'details' => $details === '' ? null : Str::limit($details, self::MAX_DETAILS),
            ];
        }

        return ['entrees' => array_reverse($entries), 'tronque' => $truncated];
    }

    /** Première ligne = message lisible ; le reste (contexte JSON, trace) = détails. */
    private function split(string $body): array
    {
        $firstLine = strtok($body, "\n") ?: '';
        $rest = ltrim(substr($body, strlen($firstLine)), "\n");

        // Le contexte JSON en fin de première ligne (« {"exception":"…"} ») part dans les détails.
        if (preg_match('/^(.*?)\s(\{".*)$/s', $firstLine, $parts)) {
            return [trim($parts[1]), trim($parts[2]."\n".$rest)];
        }

        return [trim($firstLine), trim($rest)];
    }

    private function date(string $raw): string
    {
        try {
            return Carbon::parse($raw)->toIso8601String();
        } catch (\Throwable) {
            return $raw;
        }
    }
}
