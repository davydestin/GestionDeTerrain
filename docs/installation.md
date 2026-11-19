# Installation et démarrage

## Prérequis

- PHP ≥ 8.3 et Composer (extensions `pdo_mysql`, `mbstring`, `openssl`, `fileinfo`, et `gd` pour les tests d'images)
- MySQL (base `gestiondeterrain` par défaut)
- Node.js 20+ et npm

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

Le seeder charge les 19 communes de Dakar (`CommuneSeeder`) et crée deux comptes :

| Rôle | E-mail | Mot de passe |
| --- | --- | --- |
| Administrateur | `ADMIN_EMAIL` (défaut `admin@example.com`) | `ADMIN_PASSWORD` (défaut `Admin1234!`) |
| Client | `test@example.com` | `password` |

Un compte gestionnaire se crée depuis l'espace administrateur (« Utilisateurs »).

Variables utiles pour le géocodage (placement des terrains) : `NOMINATIM_USER_AGENT` (mettre un vrai contact en production, les adresses `example.com` sont refusées), `NOMINATIM_CA_BUNDLE` (certificats CA sous Windows).

Tests : `php artisan test` (SQLite en mémoire, n'affecte pas la base MySQL).

## Frontend

```bash
cd frontend
cp .env.example .env         # VITE_API_URL=http://localhost:8000
npm install
npm run dev                  # http://localhost:5173
npm run build                # build de production
npm run lint
```
