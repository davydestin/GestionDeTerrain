# Référence de l'API

Base : `http://localhost:8000/api`. Authentification par session Sanctum (cookies) ; les routes marquées 🔒 exigent d'être connecté, le rôle requis est indiqué.

## Public

| Méthode | Route | Description |
| --- | --- | --- |
| POST | `/register` | Inscription client (`nom`, `prenom`, `email`, `telephone?`, `password` ≥ 8 car. + `password_confirmation`). Limité à 6 req/min |
| POST | `/login` | Connexion de tous les rôles (`email`, `password`). Les gestionnaires et administrateurs utilisent les identifiants créés par l'administrateur. Pour un client inscrit avec Google (sans mot de passe), le message invite à utiliser Google. Limité à 6 req/min |
| POST | `/auth/google` | **Option client** : inscription ou connexion avec Google (`credential` = jeton d'identité du bouton Google Identity Services). Crée le compte client à la première connexion (`201`), sinon `200` ; un client existant de même e-mail est lié à Google et garde son mot de passe. `403` pour un gestionnaire/administrateur ou un compte désactivé, `401` jeton invalide, `503` si `GOOGLE_CLIENT_ID` n'est pas configuré. Limité à 10 req/min |
| GET | `/communes` | Liste des communes |
| GET | `/terrains/a-la-une` | Terrains de la page d'accueil (6 max., ceux avec photos d'abord) ; `est_a_moi` indique les terrains du gestionnaire connecté |
| GET | `/terrains` | Recherche de terrains (filtres : `commune_id`, `quartier`, `type`, `min_price`, `max_price`), 15 par page, photos incluses |
| GET | `/terrains/map` | Terrains dans la zone visible (`south`, `north`, `west`, `east`) |
| GET | `/terrains/nearby` | Terrains proches (`latitude`, `longitude`, `radius` en m, défaut 5000, `limit` défaut 50) |
| GET | `/terrains/{id}` | Détail d'un terrain (avec `disponibilite` : `DISPONIBLE`, `INDISPONIBLE` + `jusqu_au`/`motif`, `HORS_LIGNE`) |
| GET | `/terrains/{id}/disponibilites?date=AAAA-MM-JJ` | Horaires, fermetures et réservations du jour |
| GET | `/terrain-images/{id}` | Photo d'un terrain |

> **Visibilité des gestionnaires.** Un gestionnaire connecté ne voit que **ses** terrains dans `/terrains`, `/terrains/map`, `/terrains/nearby`, `/terrains/{id}` et `/terrains/{id}/disponibilites` (les autres renvoient `404`). Seule `/terrains/a-la-une` (page d'accueil) montre aussi les terrains des autres gestionnaires. Visiteurs, clients et administrateurs voient tout.

## Utilisateur connecté 🔒

| Méthode | Route | Description |
| --- | --- | --- |
| GET / PATCH | `/user` | Profil courant / mise à jour |
| POST | `/logout` | Déconnexion |
| GET | `/notifications` | 30 dernières notifications + `non_lues` (chaque notification porte `reservation_id`) |
| PATCH | `/notifications/{id}/lu` | Marquer comme lue |
| PATCH | `/notifications/lu` | Tout marquer comme lu |

## Client 🔒 `CLIENT`

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/client/reservations` | Mes réservations |
| POST | `/client/reservations` | Créer une demande (`terrain_id`, `date_debut`, `date_fin`, `telephone_whatsapp`, `commentaire?`) → `201`, statut `EN_ATTENTE` |
| POST | `/client/reservations/{id}/annuler` | Annuler |

`telephone_whatsapp` accepte un numéro sénégalais (`77 123 45 67`) ou un numéro avec indicatif (`+33 6…`) ; il est stocké au format wa.me (`221771234567`).

## Gestionnaire 🔒 `GESTIONNAIRE`

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/gestionnaire/communes` | Communes |
| POST | `/gestionnaire/geocode` | Recherche d'adresse dans Dakar : texte libre `q`, ou `adresse` + `quartier` (+ `commune`, `ville`, `complement`). 12 req/min |
| GET | `/gestionnaire/geocode/reverse?latitude=&longitude=` | Adresse (rue, quartier, commune) d'une position dans Dakar. 40 req/min |
| GET / POST | `/gestionnaire/terrains` | Mes terrains (filtres `search`, `statut` ; 12 par page ; `stats` globales) / créer |
| GET | `/gestionnaire/terrains/{id}` | Fiche de gestion d'un de mes terrains (photos, horaires, compteurs, disponibilité) |
| PUT, PATCH, DELETE | `/gestionnaire/terrains/{id}` | Modifier / supprimer (soft delete) |
| POST | `/gestionnaire/terrains/{id}/images` | Ajouter une image |
| PATCH | `/gestionnaire/terrains/{id}/images/{image}/principal` | Définir l'image principale |
| DELETE | `/gestionnaire/terrains/{id}/images/{image}` | Supprimer une image |
| GET, POST | `/gestionnaire/terrains/{id}/horaires` | Lister / créer |
| PUT, DELETE | `/gestionnaire/terrains/{id}/horaires/{horaire}` | Modifier / supprimer |
| GET, POST | `/gestionnaire/terrains/{id}/indisponibilites` | Lister / créer |
| PUT, DELETE | `/gestionnaire/terrains/{id}/indisponibilites/{indisponibilite}` | Modifier / supprimer |
| PUT | `/gestionnaire/terrains/{id}/disponibilite` | `etat` : `DISPONIBLE` ou `INDISPONIBLE` (+ `jusqu_au?`, `motif?`) — sans `jusqu_au`, le terrain est masqué jusqu'à nouvel ordre ; `409` si une réservation active tombe dans la période |
| GET | `/gestionnaire/reservations?vue=en_attente\|a_venir\|historique` | Demandes de mes terrains + `compteurs` ; chaque demande contient `telephone_whatsapp` et `whatsapp_url` (message pré-rédigé) |
| POST | `/gestionnaire/reservations/{id}/confirmer` | Confirmer (créneau futur uniquement) → renvoie `whatsapp_url` |
| POST | `/gestionnaire/reservations/{id}/refuser` | Refuser (`motif?` transmis au client) |

## Administrateur 🔒 `ADMINISTRATEUR`

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/admin/users` | Lister les utilisateurs (filtres `search`, `role`, `statut` = `actif`/`inactif`) |
| POST | `/admin/users` | Créer un compte (`nom`, `prenom`, `email`, `telephone?`, `password`, `role`, `statut?`). Le gestionnaire se connecte ensuite avec ces identifiants sur la page de connexion |
| PUT, PATCH | `/admin/users/{id}` | Modifier un compte gestionnaire ou administrateur (mot de passe facultatif). `403` sur un compte client : seul le client modifie son profil |
| DELETE | `/admin/users/{id}` | Supprimer un compte sans historique (`409` s'il a des terrains ou des réservations : le désactiver) |
| PATCH | `/admin/users/{id}/role` | Modifier le rôle d'un gestionnaire ou d'un administrateur (`403` sur un compte client) |
| GET | `/admin/journal` | Journal d'audit, du plus récent au plus ancien, 25 par page. Filtres : `search` (auteur, e-mail, IP, description), `categorie` (`auth`, `utilisateur`, `profil`, `terrain`, `reservation`), `action`, `role` (rôle de l'auteur), `utilisateur_id`, `du` / `au` (`AAAA-MM-JJ`), `page`. Réponse : `{ entrees: <pagination>, actions: { code: libellé } }` |

> Un administrateur ne peut ni retirer son propre rôle, ni se désactiver, ni supprimer son propre compte (`409`). Un compte désactivé est déconnecté à sa requête suivante (`401`).

#### Logs techniques

`GET /admin/logs` (administrateur) : lit les fichiers `storage/logs/laravel*.log`. Paramètres : `fichier` (nom tel que listé dans `fichiers`, sinon le plus récent ; tout autre nom → `404`), `niveau` (`ERROR`, `WARNING`, `INFO`…), `environnement`, `search` (message et trace), `page` (30 par page). Réponse : `fichiers` (nom, taille, date), `fichier`, `compteurs` par niveau, `entrees` paginées (plus récentes d'abord ; `message` + `details` = contexte JSON et trace), `tronque` si seuls les 3 derniers Mo d'un gros fichier sont lus. Lecture seule.

Configuration (`.env`) : `LOG_STACK=daily` (un fichier par jour), `LOG_DAILY_DAYS=14` (durée de conservation), `LOG_LEVEL` (`debug` en local, `warning` conseillé en production). Les tests n'écrivent pas dans ces fichiers (`LOG_CHANNEL=null` dans `phpunit.xml`).

#### Journal d'audit

Table `journal_audit`, alimentée par `App\Services\AuditLogger::log()`. Chaque entrée garde l'auteur (id + nom, e-mail et rôle recopiés, pour rester lisible après la suppression du compte), l'action, la cible (`cible_type`, `cible_id`), une description, des `details` JSON (valeurs avant / après pour les modifications), l'adresse IP et le navigateur.

Actions enregistrées : connexion, connexion échouée, déconnexion, inscription, modification de profil ; création, modification, changement de rôle, activation, désactivation et suppression de compte ; création, modification, suppression et changement de disponibilité de terrain ; ajout, choix de la photo principale et suppression de photos ; ajout, modification et suppression d'horaires et de fermetures ; demande, confirmation, refus et annulation de réservation.

**Historique antérieur au journal :** `php artisan audit:reconstituer` recrée les actions passées à partir des données en base (terrains, photos, horaires, fermetures, réservations et décisions des gestionnaires, datées par les notifications). Ces entrées portent `details.reconstitue = true` et n'ont pas d'adresse IP. Les horaires et fermetures n'ayant pas de date de création, leur date est approchée (`details.date_approximative = true`). La commande peut être relancée sans créer de doublon.

Les mots de passe ne sont jamais enregistrés (un changement apparaît masqué). Les entrées sont en lecture seule : aucune route ne les modifie, et le modèle refuse toute mise à jour ou suppression.

> Le détail exact des champs de recherche et de validation se trouve dans `backend/app/Http/Requests`.
