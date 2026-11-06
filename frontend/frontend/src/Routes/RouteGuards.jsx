import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contextes/useAuth.js'

const roleHome = {
  CLIENT: '/client/reservations',
  GESTIONNAIRE: '/gestionnaire/terrains',
  ADMINISTRATEUR: '/administrateur/utilisateurs',
}

function LoadingSession() {
  return <main className="loading-screen">Chargement de la session…</main>
}

export function RequireGuest() {
  const { user, status } = useAuth()

  if (status === 'loading') return <LoadingSession />
  if (user) return <Navigate to={roleHome[user.role] || '/'} replace />

  return <Outlet />
}

export function RequireAuth() {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <LoadingSession />
  if (!user) {
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function RequireRole({ roles }) {
  const { user } = useAuth()

  if (!roles.includes(user.role)) {
    return <Navigate to={roleHome[user.role] || '/'} replace />
  }

  return <Outlet />
}