import { Navigate, Route, Routes } from 'react-router-dom'
import AuthProvider from './contextes/AuthProvider.jsx'
import { useAuth } from './contextes/useAuth.js'
import AuthenticationPage from './pages/auth/AuthenticationPage.jsx'
import CarteTerrainsPage from './pages/public/CarteTerrainsPage.jsx'
import HomePage from './pages/public/HomePage.jsx'
import TerrainDetailPage from './pages/public/TerrainDetailPage.jsx'
import TerrainsPage from './pages/public/TerrainsPage.jsx'
import ClientProfilePage from './pages/client/ClientProfilePage.jsx'
import RoleDashboard from './pages/shared/RoleDashboard.jsx'
import { RequireAuth, RequireGuest, RequireRole } from './Routes/RouteGuards.jsx'

function AuthStatusBar() {
  const { status, error } = useAuth()
  const unavailable = status === 'error'

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
        <Route path="/" element={<HomePage />} />
        <Route path="/terrains" element={<TerrainsPage />} />
        <Route path="/terrains/:terrainId" element={<TerrainDetailPage />} />
        <Route path="/carte" element={<CarteTerrainsPage />} />

        <Route element={<RequireGuest />}>
          <Route path="/connexion" element={<AuthenticationPage mode="login" />} />
          <Route path="/inscription" element={<AuthenticationPage mode="register" />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<RequireRole roles={['CLIENT']} />}>
            <Route path="/client/reservations" element={<RoleDashboard />} />
            <Route path="/client/profil" element={<ClientProfilePage />} />
          </Route>
          <Route element={<RequireRole roles={['GESTIONNAIRE']} />}>
            <Route path="/gestionnaire/terrains" element={<RoleDashboard />} />
          </Route>
          <Route element={<RequireRole roles={['ADMINISTRATEUR']} />}>
            <Route path="/administrateur/utilisateurs" element={<RoleDashboard />} />
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
