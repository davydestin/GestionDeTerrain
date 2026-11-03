import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { roleData } from '../../services/api.js'
import { useAuth } from '../../contextes/useAuth.js'
import GestionUtilisateurs from '../administrateur/GestionUtilisateurs.jsx'
import GestionnaireTerrains from '../gestionnaire/GestionnaireTerrains.jsx'

const roleLabels = {
  CLIENT: 'Client',
  GESTIONNAIRE: 'Gestionnaire',
  ADMINISTRATEUR: 'Administrateur',
}

const rolePaths = {
  CLIENT: '/client/reservations',
  GESTIONNAIRE: '/gestionnaire/terrains',
  ADMINISTRATEUR: '/administrateur/utilisateurs',
}

const roleNavigation = {
  CLIENT: [
    { to: '/client/reservations', label: 'Mes réservations' },
    { to: '/client/profil', label: 'Mon profil' },
  ],
  GESTIONNAIRE: [{ to: '/gestionnaire/terrains', label: 'Mes terrains' }],
  ADMINISTRATEUR: [{ to: '/administrateur/utilisateurs', label: 'Utilisateurs' }],
}

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const validationMessage = Object.values(payload.errors || {}).flat()[0]
    throw new Error(validationMessage || payload.message || 'Une erreur est survenue.')
  }

  return payload
}

function displayDate(value) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function RoleDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(user.role !== 'ADMINISTRATEUR')
  const [error, setError] = useState('')
  const [logoutError, setLogoutError] = useState('')

  useEffect(() => {
    if (user.role === 'ADMINISTRATEUR') return undefined
    let active = true

    roleData(user.role)
      .then(readResponse)
      .then((payload) => {
        const data = user.role === 'CLIENT'
          ? payload.reservations
          : payload.data || payload.terrains

        if (active) setRows(data || [])
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user])

  async function handleLogout() {
    setLogoutError('')

    try {
      await logout()
      navigate('/connexion', { replace: true })
    } catch (requestError) {
      setLogoutError(requestError.message)
    }
  }

  const role = user.role
  const title = role === 'CLIENT'
    ? 'Mes réservations'
    : role === 'GESTIONNAIRE'
      ? 'Mes terrains'
      : 'Utilisateurs'

  return (
    <main className="workspace">
      <header className="workspace-header">
        <Link className="brand-lockup" to={rolePaths[role]}>
          <span className="brand-mark" aria-hidden="true">GT</span>
          <span>Gestion de terrain</span>
        </Link>
        <nav className="flex items-center gap-4" aria-label="Navigation principale">
          {roleNavigation[role].map((item) => (
            <Link className="text-xs font-semibold text-[#56635a] hover:text-[#2f7259]" key={item.to} to={item.to}>
              {item.label}
            </Link>
          ))}
          <div className="account-actions">
            <div className="account-identity">
              <span className="account-name">{user.prenom} {user.nom}</span>
              <span className="role-tag">{roleLabels[role]}</span>
            </div>
            <button className="button button-quiet" onClick={handleLogout} type="button">
              Déconnexion
            </button>
          </div>
        </nav>
      </header>

      <section className="workspace-content">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Espace {roleLabels[role]?.toLowerCase()}</p>
            <h1>{title}</h1>
          </div>
          {role !== 'ADMINISTRATEUR' && (
            <span className="record-count">{rows.length} résultat{rows.length === 1 ? '' : 's'}</span>
          )}
        </div>

        {logoutError && <p className="notice notice-error" role="alert">{logoutError}</p>}
        {error && <p className="notice notice-error" role="alert">{error}</p>}

        {role === 'ADMINISTRATEUR' ? (
          <GestionUtilisateurs currentUserId={user.id} />
        ) : role === 'GESTIONNAIRE' ? (
          <GestionnaireTerrains
            terrains={rows}
            loading={loading}
            onTerrainCreated={(terrain) => setRows((currentRows) => [terrain, ...currentRows])}
          />
        ) : loading ? (
          <p className="empty-state">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="empty-state">Aucune réservation à afficher.</p>
        ) : (
          <div className="data-list">
            {rows.map((reservation) => (
              <article className="data-row client-row" key={reservation.id}>
                <div>
                  <span className="row-label">Terrain</span>
                  <strong>{reservation.terrain?.nom || 'Terrain'}</strong>
                  <span className="row-secondary">{reservation.terrain?.ville || '—'}</span>
                </div>
                <div>
                  <span className="row-label">Début</span>
                  <span>{displayDate(reservation.date_debut)}</span>
                </div>
                <div>
                  <span className="row-label">Statut</span>
                  <span className="status-tag">{reservation.statut}</span>
                </div>
                <strong className="amount">{Number(reservation.montant_total).toLocaleString('fr-FR')} FCFA</strong>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
