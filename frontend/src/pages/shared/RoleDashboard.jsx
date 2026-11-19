import { useAuth } from '../../contextes/useAuth.js'
import GestionUtilisateurs from '../administrateur/GestionUtilisateurs.jsx'

// Espace administrateur — page « Utilisateurs », affichée dans components/WorkspaceLayout.jsx
// comme les pages client et gestionnaire.
export default function RoleDashboard() {
  const { user } = useAuth()

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Espace administrateur</p>
          <h1>Utilisateurs</h1>
        </div>
      </div>

      <GestionUtilisateurs currentUserId={user.id} />
    </>
  )
}
