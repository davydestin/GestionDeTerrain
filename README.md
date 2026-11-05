# GestionDeTerrain

Application de réservation de terrains de sport à **Dakar** : les clients consultent et réservent des terrains, les gestionnaires publient et administrent leurs terrains, les administrateurs gèrent les comptes.

| Couche | Technologies |
| --- | --- |
| Backend (`backend/`) | PHP 8.3, Laravel 13, Laravel Sanctum (session SPA), MySQL |
| Frontend (`frontend/`) | React 19, Vite, React Router 7, Tailwind CSS 4, Leaflet |

## Documentation

- [Installation et démarrage](docs/installation.md)
- [Architecture](docs/architecture.md)
- [Référence de l'API](docs/api.md)
- [Frontend](docs/frontend.md)

## Démarrage rapide

```bash
# Backend
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve            # http://localhost:8000

# Frontend (autre terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                  # http://localhost:5173
```

## Rôles

| Rôle | Capacités |
| --- | --- |
| `CLIENT` | Parcourir les terrains, réserver, annuler, payer, gérer son profil |
| `GESTIONNAIRE` | CRUD de ses terrains, images, horaires, indisponibilités, confirmer/refuser les réservations, valider les paiements |
| `ADMINISTRATEUR` | Lister les utilisateurs et modifier leur rôle |
