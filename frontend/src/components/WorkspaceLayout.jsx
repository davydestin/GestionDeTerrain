import { Outlet, useLocation } from 'react-router-dom'
import WorkspaceHeader from './WorkspaceHeader.jsx'

/** Cadre commun des espaces connectés (client, gestionnaire) : en-tête + page courante. */
export default function WorkspaceLayout() {
  const location = useLocation()

  return (
    <main className="workspace">
      <WorkspaceHeader />
      {/* Clé = chemin (sans les paramètres d'onglet) : l'apparition rejoue à chaque nouvelle page. */}
      <section className="workspace-content anim-page" key={location.pathname}>
        <Outlet />
      </section>
    </main>
  )
}
