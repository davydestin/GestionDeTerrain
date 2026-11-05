# Référence de l'API

Base : `http://localhost:8000/api`. Authentification par session Sanctum (cookies) ; les routes marquées 🔒 exigent d'être connecté, le rôle requis est indiqué.

## Public

| Méthode | Route | Description |
| --- | --- | --- |
| POST | `/register` | Inscription (`nom`, `prenom`, `email`, `telephone?`, `password` ≥ 8 car. + `password_confirmation`). Limité à 6 req/min |
| POST | `/login` | Connexion (`email`, `password`). Limité à 6 req/min |
| GET | `/communes` | Liste des communes |
| GET | `/terrains` | Recherche de terrains (filtres) |
| GET | `/terrains/map` | Terrains pour la carte |
| GET | `/terrains/nearby` | Terrains proches (`latitude`, `longitude`, `radius` en m, défaut 5000, `limit` défaut 50) |
| GET | `/terrains/{id}` | Détail d'un terrain |
| GET | `/terrains/{id}/disponibilites` | Disponibilités |
| GET | `/terrain-images/{id}` | Image d'un terrain |

## Utilisateur connecté 🔒

| Méthode | Route | Description |
| --- | --- | --- |
| GET / PATCH | `/user` | Profil courant / mise à jour |
| POST | `/logout` | Déconnexion |
| GET | `/notifications` | Notifications |
| PATCH | `/notifications/{id}/lu` | Marquer comme lue |

## Client 🔒 `CLIENT`

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/client/reservations` | Mes réservations |
| POST | `/client/reservations` | Créer une réservation (`terrain_id`, `date_debut`, `date_fin`, `commentaire?`) → `201`, statut `EN_ATTENTE` |
| POST | `/client/reservations/{id}/annuler` | Annuler |
| GET / POST | `/client/reservations/{id}/paiements` | Lister / enregistrer un paiement |

## Gestionnaire 🔒 `GESTIONNAIRE`

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/gestionnaire/communes` | Communes |
| GET / POST | `/gestionnaire/terrains` | Mes terrains / créer |
| PUT, PATCH, DELETE | `/gestionnaire/terrains/{id}` | Modifier / supprimer (soft delete) |
| POST | `/gestionnaire/terrains/{id}/images` | Ajouter une image |
| PATCH | `/gestionnaire/terrains/{id}/images/{image}/principal` | Définir l'image principale |
| DELETE | `/gestionnaire/terrains/{id}/images/{image}` | Supprimer une image |
| GET, POST | `/gestionnaire/terrains/{id}/horaires` | Lister / créer |
| PUT, DELETE | `/gestionnaire/terrains/{id}/horaires/{horaire}` | Modifier / supprimer |
| GET, POST | `/gestionnaire/terrains/{id}/indisponibilites` | Lister / créer |
| PUT, DELETE | `/gestionnaire/terrains/{id}/indisponibilites/{indisponibilite}` | Modifier / supprimer |
| GET | `/gestionnaire/reservations` | Réservations de mes terrains |
| POST | `/gestionnaire/reservations/{id}/confirmer` | Confirmer |
| POST | `/gestionnaire/reservations/{id}/refuser` | Refuser |
| PATCH | `/gestionnaire/paiements/{id}/statut` | Changer le statut d'un paiement |

## Administrateur 🔒 `ADMINISTRATEUR`

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/admin/users` | Lister les utilisateurs |
| PATCH | `/admin/users/{id}/role` | Modifier le rôle |

> Le détail exact des champs de recherche et de validation se trouve dans `backend/app/Http/Requests`.
