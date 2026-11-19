import { Link } from 'react-router-dom'
import { useAuth } from '../contextes/useAuth.js'
import Icon from './Icon.jsx'

/**
 * Rappel affiché aux gestionnaires sur la liste et la carte publiques :
 * seuls leurs terrains y apparaissent (ceux des autres ne sont visibles que sur l'accueil).
 */
export default function ManagerScopeNotice({ className = '' }) {
  const { user } = useAuth()
  if (user?.role !== 'GESTIONNAIRE') return null

  return (
    <div className={`anim-fade-in flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#b6f23a]/25 bg-[#b6f23a]/[0.06] px-4 py-3 text-xs text-[#d6f79a] ${className}`} role="note">
      <p className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" name="map-pin" />
        <span>
          Vous êtes connecté en tant que gestionnaire : seuls <strong>vos terrains</strong> apparaissent ici.
          Les terrains des autres gestionnaires ne sont visibles que sur la page d’accueil.
        </span>
      </p>
      <Link className="inline-flex items-center gap-1.5 rounded-full border border-[#b6f23a]/40 px-3 py-1.5 font-bold text-[#b6f23a] hover:bg-[#b6f23a]/10" to="/gestionnaire/terrains">
        Gérer mes terrains
        <Icon className="size-3.5" name="arrow-right" />
      </Link>
    </div>
  )
}
