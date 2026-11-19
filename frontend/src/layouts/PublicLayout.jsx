import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contextes/useAuth.js'
import { rolePaths } from '../components/roles.js'
import Icon from '../components/Icon.jsx'

const NAV_ITEMS = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/terrains', label: 'Terrains' },
  { to: '/carte', label: 'Carte' },
]

const pillClass = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
    isActive ? 'bg-[#b6f23a] text-[#0b0f0c]' : 'bg-white/[0.07] text-white/80 hover:bg-white/15'
  }`

const menuLinkClass = ({ isActive }) =>
  `block rounded-xl px-4 py-3 text-sm font-semibold ${isActive ? 'bg-[#b6f23a] text-[#0b0f0c]' : 'text-white/85 hover:bg-white/10'}`

function MenuIcon({ open }) {
  return <Icon className="size-5" name={open ? 'close' : 'menu'} />
}

export default function PublicLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="min-h-screen bg-[#0b0f0c] text-[#f3f5ef] [color-scheme:dark]">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-[1100] px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="relative mx-auto w-full max-w-5xl">
          <div className="flex h-14 items-center justify-between gap-2 rounded-full border border-white/10 bg-[#0b0f0c]/70 py-2 pl-2.5 pr-2 backdrop-blur-xl">
            <Link className="flex min-w-0 items-center gap-2.5 font-display text-base font-semibold uppercase tracking-wide" onClick={closeMenu} to="/">
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-[#b6f23a] font-display text-sm text-[#0b0f0c]">GT</span>
              <span className="hidden truncate lg:inline">Gestion de terrain</span>
            </Link>

            {/* Tablette et ordinateur : liens visibles */}
            <nav aria-label="Navigation" className="hidden items-center gap-1.5 md:flex">
              {NAV_ITEMS.map((item) => <NavLink className={pillClass} end={item.end} key={item.to} to={item.to}>{item.label}</NavLink>)}
            </nav>

            <div className="flex shrink-0 items-center gap-1.5">
              {user ? (
                <Link className="rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[#0b0f0c] transition-colors hover:bg-[#b6f23a] sm:px-5" onClick={closeMenu} to={rolePaths[user.role] || '/'}>
                  Mon espace
                </Link>
              ) : (
                <>
                  <Link className="hidden rounded-full px-4 py-2 text-sm font-semibold text-white/80 hover:text-white sm:inline-flex" to="/connexion">
                    Connexion
                  </Link>
                  <Link className="rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[#0b0f0c] transition-colors hover:bg-[#b6f23a] sm:px-5" onClick={closeMenu} to="/inscription">
                    S’inscrire
                  </Link>
                </>
              )}
              {/* Téléphone : menu repliable */}
              <button
                aria-controls="menu-public"
                aria-expanded={menuOpen}
                aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                className="grid size-10 place-items-center rounded-full bg-white/[0.07] text-white hover:bg-white/15 md:hidden"
                onClick={() => setMenuOpen((open) => !open)}
                type="button"
              >
                <MenuIcon open={menuOpen} />
              </button>
            </div>
          </div>

          {menuOpen && (
            <nav aria-label="Navigation" className="anim-pop absolute inset-x-0 top-16 rounded-3xl border border-white/10 bg-[#11160f] p-2 shadow-2xl md:hidden" id="menu-public">
              {NAV_ITEMS.map((item) => <NavLink className={menuLinkClass} end={item.end} key={item.to} onClick={closeMenu} to={item.to}>{item.label}</NavLink>)}
              {!user && <NavLink className={menuLinkClass} onClick={closeMenu} to="/connexion">Connexion</NavLink>}
            </nav>
          )}
        </div>
      </header>
      {/* La clé change à chaque page : l'animation d'apparition rejoue. */}
      <div className="anim-page" key={location.pathname}>
        <Outlet />
      </div>
      <footer className="mt-10 border-t border-white/10 py-8 text-center text-xs text-white/40">
        Gestion de terrain · Dakar
      </footer>
    </div>
  )
}
