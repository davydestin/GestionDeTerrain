# Architecture

## Vue d'ensemble

SPA React (`frontend/`) qui consomme l'API REST Laravel (`backend/routes/api.php`). L'authentification utilise **Laravel Sanctum en mode session (cookies)** : le frontend et l'API doivent être sur des domaines déclarés dans `SANCTUM_STATEFUL_DOMAINS`.

## Backend (`backend/app`)

- `Http/Controllers` : `AuthController`, `TerrainController` (public + gestionnaire), `TerrainAvailabilityController`, `TerrainImageController`, `CommuneController`, `PaiementController`, `NotificationUtilisateurController`, et par rôle `Client/`, `Gestionnaire/`, `Admin/`.
- `Http/Middleware/EnsureUserHasRole` : alias `role:CLIENT|GESTIONNAIRE|ADMINISTRATEUR` appliqué aux groupes de routes.
- `policies/` : `TerrainPolicy` (seul le gestionnaire propriétaire modifie/supprime) et `ReservationPolicy` (annulation/paiement par le client propriétaire, gestion par le gestionnaire du terrain). Un compte avec `statut = false` est refusé.
- `Support/DakarBounds` + `config/geography.php` : validation des coordonnées dans l'emprise de Dakar.
- Les réservations sont créées dans une transaction avec `lockForUpdate()` sur le terrain pour éviter les doubles réservations ; chaque événement notifie l'autre partie (`notifications`).

## Modèle de données

| Table | Contenu clé |
| --- | --- |
| `users` | `nom`, `prenom`, `email`, `telephone`, `role`, `statut` |
| `communes` | `nom` (unique) |
| `terrains` | `gestionnaire_id`, `commune_id`, `nom`, `adresse`, `ville` (Dakar), `quartier`, `latitude`/`longitude`, `type`, `capacite`, `tarif_horaire`, `statut` (`ACTIF`/`INACTIF`), soft delete |
| `terrain_images` | `terrain_id`, `chemin_image`, `est_principale` |
| `horaires` | un créneau d'ouverture par jour (`jour_semaine`) et terrain, `actif` |
| `indisponibilites` | période de fermeture (`date_debut`, `date_fin`, `motif`) |
| `reservations` | `utilisateur_id`, `terrain_id`, période, `montant_total`, `statut` : `EN_ATTENTE`, `CONFIRMEE`, `ANNULEE`, `REFUSEE`, `TERMINEE` |
| `paiements` | `reservation_id`, `montant`, `methode` : `WAVE`, `ORANGE_MONEY`, `FREE_MONEY`, `ESPECES`, `CARTE`, `statut` : `EN_ATTENTE`, `PAYE`, `ECHOUE`, `REMBOURSE` ; unique (`methode`, `reference_transaction`) |
| `notifications` | `utilisateur_id`, `titre`, `message`, `lu` |

## Flux de réservation

1. Le client consulte `GET /api/terrains/{id}/disponibilites` puis `POST /api/client/reservations` → statut `EN_ATTENTE`, le gestionnaire est notifié.
2. Le gestionnaire `confirmer` ou `refuser` la réservation.
3. Le client peut `annuler` ; il enregistre un paiement, que le gestionnaire valide via `PATCH /api/gestionnaire/paiements/{id}/statut`.
