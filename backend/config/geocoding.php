<?php

$defaultCaBundle = PHP_OS_FAMILY === 'Windows'
    && is_file('C:/Program Files/Git/mingw64/etc/ssl/certs/ca-bundle.crt')
    ? 'C:/Program Files/Git/mingw64/etc/ssl/certs/ca-bundle.crt'
    : null;

return [
    'nominatim_url' => env('NOMINATIM_URL') ?: 'https://nominatim.openstreetmap.org/search',
    // Nominatim bloque (403) les User-Agent contenant un contact fictif comme example.com.
    // En production, mettre un contact réel : "GestionDeTerrain/1.0 (vous@domaine.sn)".
    'user_agent' => env('NOMINATIM_USER_AGENT') ?: 'GestionDeTerrain/1.0',
    'email' => env('NOMINATIM_EMAIL') ?: null,
    'cache_minutes' => (int) (env('NOMINATIM_CACHE_MINUTES') ?: 1440),
    'ca_bundle' => env('NOMINATIM_CA_BUNDLE', $defaultCaBundle),
];
