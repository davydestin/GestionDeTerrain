# Frontend

Code dans `frontend/src` (React 19, Vite, React Router 7, Tailwind CSS 4, Leaflet / react-leaflet). L'URL de l'API est lue depuis `VITE_API_URL` (`frontend/.env`).

## Routes

| Chemin | Accès | Page |
| --- | --- | --- |
| `/` | public | `HomePage` — accueil, « Terrains à la une », étapes |
| `/terrains`, `/terrains/:terrainId` | public | liste filtrée, fiche (galerie, réservation) |
| `/carte` | public | carte Leaflet, « à proximité », itinéraire guidé (`?terrain=ID&itineraire=1`) |
| `/connexion`, `/inscription` | invités uniquement | `AuthenticationPage` : connexion / inscription par e-mail + mot de passe pour tous, plus le bouton « Continuer avec Google » pour les clients (`components/GoogleSignInButton.jsx`, affiché si `VITE_GOOGLE_CLIENT_ID` est renseigné) |
| `/client/reservations`, `/client/profil` | `CLIENT` | mes réservations (annulation), profil |
| `/gestionnaire/reservations` | `GESTIONNAIRE` | demandes : valider (→ WhatsApp), refuser, historique |
| `/gestionnaire/terrains` | `GESTIONNAIRE` | mes terrains (stats, recherche, disponibilité) |
| `/gestionnaire/terrains/nouveau` | `GESTIONNAIRE` | ajout d'un terrain (placement sur la carte) |
| `/gestionnaire/terrains/:terrainId` | `GESTIONNAIRE` | fiche de gestion : informations, photos, horaires, fermetures |
| `/administrateur/utilisateurs` | `ADMINISTRATEUR` | gestion des comptes (l'admin crée les identifiants des gestionnaires) |
| `/administrateur/journal` | `ADMINISTRATEUR` | journal d'audit |

## Structure

- `contextes/` : `AuthProvider`, `useAuth` (session Sanctum).
- `Routes/RouteGuards.jsx` : `RequireAuth`, `RequireGuest`, `RequireRole`.
- `layouts/PublicLayout.jsx` : en-tête public (menu repliable sur téléphone).
- `services/`
  - `api.js` : client HTTP (cookies + jeton XSRF) et toutes les fonctions d'appel ; `readJson` centralise la lecture des erreurs Laravel.
  - `authService.js` : connexion, inscription, connexion Google (clients), profil.
  - `routingService.js` : itinéraires OSRM (voiture / à pied, serveur de secours), lien Google Maps.
  - `geo.js` : distances, projection sur le tracé, formatage.
- `components/`
  - `WorkspaceLayout`, `WorkspaceHeader`, `NotificationBell` : cadre des espaces connectés, cloche (interrogée toutes les 20 s).
  - `DakarMap` (carte publique), `LocationPicker` (repère fixe façon VTC pour placer un terrain), `MapTiles` (fond OSM avec bascule CARTO), `LockViewToBounds` (vue limitée à Dakar).
  - `NavigationPanel` : panneau de l'itinéraire guidé.
  - `TerrainCard`, `PitchArt` (illustration SVG), `Icon` (icônes SVG), `Reveal` (apparition au défilement), `ManagerScopeNotice`.
- `pages/` : par rôle (`public`, `client`, `gestionnaire`, `administrateur`, `auth`, `shared`).
  - `public/useRouteNavigation.js` : localisation, suivi de position, recalcul d'itinéraire, arrivée.
  - `gestionnaire/sections/` : onglets Photos, Horaires, Fermetures de la fiche de gestion.

## Styles et animations

`src/app.css` contient le thème sombre, les styles Leaflet et un petit système d'animations (`anim-page`, `anim-fade-up`, `anim-pop`, `lift`, `skeleton`…), désactivées si le système demande de réduire les animations.
