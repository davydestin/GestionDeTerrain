import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contextes/useAuth.js'
import Icon from './Icon.jsx'
import NotificationBell from './NotificationBell.jsx'
import { roleLabels, roleNavigation, rolePaths } from './roles.js'

const desktopLinkClass = ({ isActive }) =>
  `rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${isActive ? 'bg-[#b6f23a]/15 text-[#b6f23a]' : 'text-[#cfd6c9] hover:text-[#b6f23a]'}`

const mobileLinkClass = ({ isActive }) =>
  `block rounded-xl px-4 py-3 text-sm font-semibold ${isActive ? 'bg-[#b6f23a] text-[#0b0f0c]' : 'text-[#f3f5ef] hover:bg-white/10'}`

/**
 * En-tête commun des espaces connectés.
 * Ordinateur / tablette : navigation, cloche, identité, déconnexion sur une ligne.
 * Téléphone : logo + cloche + bouton menu ; navigation, identité et déconnexion dans le menu.
 */
export default function WorkspaceHeader() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [logoutError, setLogoutError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const role = user.role

  async function handleLogout() {
    setLogoutError('')

    try {
      await logout()
      navigate('/connexion', { replace: true })
    } catch (requestError) {
      setLogoutError(requestError.message)
    }
  }

  return (
    <>
      <header className="relative z-[1100] border-b border-white/10 py-3">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <Link className="brand-lockup min-w-0" onClick={() => setMenuOpen(false)} to={rolePaths[role]}>
            <span className="brand-mark shrink-0" aria-hidden="true">GT</span>
            <span className="truncate">Gestion de terrain</span>
          </Link>

          <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
            {roleNavigation[role].map((item) => (
              <NavLink className={desktopLinkClass} key={item.to} to={item.to}>{item.label}</NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {role !== 'ADMINISTRATEUR' && <NotificationBell />}
            <div className="hidden items-center gap-2 lg:flex">
              <span className="max-w-40 truncate text-xs font-semibold text-[#f3f5ef]">{user.prenom} {user.nom}</span>
              <span className="role-tag">{roleLabels[role]}</span>
            </div>
            <button className="button button-quiet hidden md:inline-flex" onClick={handleLogout} type="button">
              Déconnexion
            </button>
            <button
              aria-controls="menu-espace"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              className="grid size-9 place-items-center rounded-full border border-white/10 text-[#f3f5ef] hover:bg-white/10 md:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
            >
              <Icon className="size-4" name={menuOpen ? 'close' : 'menu'} />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="anim-pop absolute inset-x-0 top-full mt-2 rounded-3xl border border-white/10 bg-[#11160f] p-2 shadow-2xl md:hidden" id="menu-espace">
            <nav aria-label="Navigation principale">
              {roleNavigation[role].map((item) => (
                <NavLink className={mobileLinkClass} key={item.to} onClick={() => setMenuOpen(false)} to={item.to}>{item.label}</NavLink>
              ))}
            </nav>
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/10 px-4 pb-2 pt-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#f3f5ef]">{user.prenom} {user.nom}</p>
                <span className="role-tag mt-1">{roleLabels[role]}</span>
              </div>
              <button className="button button-quiet" onClick={handleLogout} type="button">Déconnexion</button>
            </div>
          </div>
        )}
      </header>
      {logoutError && <p className="notice notice-error mx-auto mt-3 max-w-5xl" role="alert">{logoutError}</p>}
    </>
  )
}
