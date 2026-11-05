# Frontend

Code dans `frontend/src`. L'URL de l'API est lue depuis `VITE_API_URL`.

## Routes

| Chemin | Accès | Page |
| --- | --- | --- |
| `/` | public | `HomePage` |
| `/terrains`, `/terrains/:terrainId` | public | liste et détail |
| `/carte` | public | carte Leaflet (`DakarMap`) |
| `/connexion`, `/inscription` | invités uniquement | `AuthenticationPage` |
| `/client/reservations`, `/client/profil` | `CLIENT` | réservations, profil |
| `/gestionnaire/terrains` | `GESTIONNAIRE` | gestion des terrains |
| `/administrateur/utilisateurs` | `ADMINISTRATEUR` | gestion des utilisateurs |

## Structure

- `contextes/` : `AuthProvider`, `useAuth` (état de session Sanctum).
- `Routes/RouteGuards.jsx` : `RequireAuth`, `RequireGuest`, `RequireRole`.
- `services/` : `api.js` (client HTTP), `authService.js`.
- `components/` : `TerrainCard`, `DakarMap`.
- `pages/` : regroupées par rôle (`public`, `client`, `gestionnaire`, `administrateur`, `auth`, `shared`).
