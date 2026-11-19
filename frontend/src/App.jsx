import { Navigate, Route, Routes } from 'react-router-dom'
import AuthProvider from './contextes/AuthProvider.jsx'
import { useAuth } from './contextes/useAuth.js'
import AuthenticationPage from './pages/auth/AuthenticationPage.jsx'
import CarteTerrainsPage from './pages/public/CarteTerrainsPage.jsx'
import HomePage from './pages/public/HomePage.jsx'
import TerrainDetailPage from './pages/public/TerrainDetailPage.jsx'
import TerrainsPage from './pages/public/TerrainsPage.jsx'
import ClientProfilePage from './pages/client/ClientProfilePage.jsx'
import ClientReservationsPage from './pages/client/ClientReservationsPage.jsx'
import RoleDashboard from './pages/shared/RoleDashboard.jsx'
import JournalAuditPage from './pages/administrateur/JournalAuditPage.jsx'
import LogsPage from './pages/administrateur/LogsPage.jsx'
import WorkspaceLayout from './components/WorkspaceLayout.jsx'
import MesTerrainsPage from './pages/gestionnaire/MesTerrainsPage.jsx'
import ReservationsPage from './pages/gestionnaire/ReservationsPage.jsx'
import NouveauTerrainPage from './pages/gestionnaire/NouveauTerrainPage.jsx'
import TerrainGestionPage from './pages/gestionnaire/TerrainGestionPage.jsx'
import PublicLayout from './layouts/PublicLayout.jsx'
import { RequireAuth, RequireGuest, RequireRole } from './Routes/RouteGuards.jsx'

function AuthStatusBar() {
  const { status, error } = useAuth()
  const unavailable = status === 'error'
  if (!unavailable) return null

  return (
    <div className="connection-bar" title={unavailable ? error : 'Session Laravel Sanctum'}>
      <span className={unavailable ? 'connection-dot offline' : 'connection-dot'} />
      {unavailable ? 'API indisponible' : 'Session sécurisée'}
    </div>
  )
}

function RoutedApp() {
  return (
    <div className="app-shell">
      <AuthStatusBar />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/terrains" element={<TerrainsPage />} />
          <Route path="/terrains/:terrainId" element={<TerrainDetailPage />} />
          <Route path="/carte" element={<CarteTerrainsPage />} />
        </Route>

        <Route element={<RequireGuest />}>
          <Route path="/connexion" element={<AuthenticationPage mode="login" />} />
          <Route path="/inscription" element={<AuthenticationPage mode="register" />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<RequireRole roles={['CLIENT']} />}>
            <Route element={<WorkspaceLayout />}>
              <Route path="/client/terrains" element={<TerrainsPage basePath="/client/terrains" embedded mapPath="/client/carte" />} />
              <Route path="/client/terrains/:terrainId" element={<TerrainDetailPage basePath="/client/terrains" embedded mapPath="/client/carte" />} />
              <Route path="/client/carte" element={<CarteTerrainsPage basePath="/client/terrains" embedded />} />
              <Route path="/client/reservations" element={<ClientReservationsPage />} />
              <Route path="/client/profil" element={<ClientProfilePage />} />
            </Route>
          </Route>
          <Route element={<RequireRole roles={['GESTIONNAIRE']} />}>
            <Route element={<WorkspaceLayout />}>
              <Route path="/gestionnaire/reservations" element={<ReservationsPage />} />
              <Route path="/gestionnaire/terrains" element={<MesTerrainsPage />} />
              <Route path="/gestionnaire/terrains/nouveau" element={<NouveauTerrainPage />} />
              <Route path="/gestionnaire/terrains/:terrainId" element={<TerrainGestionPage />} />
            </Route>
          </Route>
          <Route element={<RequireRole roles={['ADMINISTRATEUR']} />}>
            <Route element={<WorkspaceLayout />}>
              <Route path="/administrateur/utilisateurs" element={<RoleDashboard />} />
              <Route path="/administrateur/journal" element={<JournalAuditPage />} />
              <Route path="/administrateur/logs" element={<LogsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <RoutedApp />
    </AuthProvider>
  )
}
