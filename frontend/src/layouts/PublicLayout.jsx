import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contextes/useAuth.js'

const homeByRole = {
  CLIENT: '/client/reservations',
  GESTIONNAIRE: '/gestionnaire/terrains',
  ADMINISTRATEUR: '/administrateur/utilisateurs',
}

const linkClass = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
    isActive ? 'bg-[#b6f23a] text-[#0b0f0c]' : 'bg-white/[0.07] text-white/80 hover:bg-white/15'
  }`

export default function PublicLayout() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-[#0b0f0c] text-[#f3f5ef] [color-scheme:dark]">
      <header className="sticky top-0 z-30 px-4 pt-4">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between rounded-full border border-white/10 bg-[#0b0f0c]/60 py-2 pl-3 pr-2 backdrop-blur-xl">
          <Link className="flex items-center gap-2.5 font-display text-base font-semibold uppercase tracking-wide" to="/">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-[#b6f23a] font-display text-sm text-[#0b0f0c]">GT</span>
            <span className="hidden sm:inline">Gestion de terrain</span>
          </Link>
          <nav aria-label="Navigation" className="flex items-center gap-1.5">
            <NavLink className={linkClass} end to="/">Accueil</NavLink>
            <NavLink className={linkClass} to="/terrains">Terrains</NavLink>
            <NavLink className={linkClass} to="/carte">Carte</NavLink>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#0b0f0c] transition-colors hover:bg-[#b6f23a]" to={homeByRole[user.role] || '/'}>
                Mon espace
              </Link>
            ) : (
              <>
                <Link className="hidden rounded-full px-4 py-2 text-sm font-semibold text-white/80 hover:text-white sm:inline-flex" to="/connexion">
                  Connexion
                </Link>
                <Link className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#0b0f0c] transition-colors hover:bg-[#b6f23a]" to="/inscription">
                  S’inscrire
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <Outlet />
      <footer className="mt-10 border-t border-white/10 py-8 text-center text-xs text-white/40">
        Gestion de terrain · Dakar
      </footer>
    </div>
  )
}
