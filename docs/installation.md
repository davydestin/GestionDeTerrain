# Installation et démarrage

## Prérequis

- PHP ≥ 8.3 et Composer
- MySQL (base `gestiondeterrain` par défaut)
- Node.js et npm

## Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Adapter dans `backend/.env` : `DB_*`, `APP_URL`, et pour le SPA :

| Variable | Valeur par défaut | Rôle |
| --- | --- | --- |
| `SANCTUM_STATEFUL_DOMAINS` | `localhost:5173,127.0.0.1:5173` | Domaines du frontend autorisés pour l'auth par session |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Origines CORS autorisées |
| `DAKAR_SOUTH_BOUND` / `NORTH` / `WEST` / `EAST` | `14.55` / `14.85` / `-17.55` / `-17.10` | Emprise géographique acceptée pour les coordonnées des terrains (`config/geography.php`) |

```bash
php artisan migrate --seed   # crée les tables, les communes et un utilisateur de test
php artisan serve            # http://localhost:8000
```

Le seeder crée `test@example.com` (voir `UserFactory` pour le mot de passe) et charge les communes via `CommuneSeeder`.

Tests : `php artisan test`.

## Frontend

```bash
cd frontend
cp .env.example .env         # VITE_API_URL=http://localhost:8000
npm install
npm run dev                  # http://localhost:5173
npm run build                # build de production
npm run lint
```
