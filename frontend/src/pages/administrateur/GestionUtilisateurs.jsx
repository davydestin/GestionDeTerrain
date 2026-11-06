import { useEffect, useState } from 'react'
import { getAdminUsers, updateUserRole } from '../../services/api.js'

const roles = ['CLIENT', 'GESTIONNAIRE', 'ADMINISTRATEUR']
const roleLabels = {
  CLIENT: 'Client',
  GESTIONNAIRE: 'Gestionnaire',
  ADMINISTRATEUR: 'Administrateur',
}

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const validationMessage = Object.values(payload.errors || {}).flat()[0]
    throw new Error(validationMessage || payload.message || 'Une erreur est survenue.')
  }

  return payload
}

export default function GestionUtilisateurs({ currentUserId }) {
  const [users, setUsers] = useState([])
  const [meta, setMeta] = useState(null)
  const [filters, setFilters] = useState({ search: '', role: '', statut: '' })
  const [searchDraft, setSearchDraft] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [updatingUserId, setUpdatingUserId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true

    getAdminUsers({ ...filters, page })
      .then(readResponse)
      .then((payload) => {
        if (!active) return
        setUsers(payload.users?.data || [])
        setMeta(payload.users?.meta || null)
        setError('')
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
  }, [filters, page])

  function applyFilter(name, value) {
    setLoading(true)
    setNotice('')
    setPage(1)
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function submitSearch(event) {
    event.preventDefault()
    applyFilter('search', searchDraft.trim())
  }

  async function changeRole(userId, role) {
    const previousRole = users.find((user) => user.id === userId)?.role
    setUpdatingUserId(userId)
    setError('')
    setNotice('')

    try {
      const payload = await readResponse(await updateUserRole(userId, role))
      setUsers((currentUsers) => currentUsers.map((user) => (
        user.id === userId ? payload.user : user
      )))
      setNotice('Rôle mis à jour.')
    } catch (requestError) {
      setError(requestError.message)
      setUsers((currentUsers) => currentUsers.map((user) => (
        user.id === userId ? { ...user, role: previousRole } : user
      )))
    } finally {
      setUpdatingUserId(null)
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase text-[#b6f23a]">Administration</p>
          <h2 className="mt-1 font-heading text-2xl font-semibold text-[#f3f5ef]">Comptes utilisateurs</h2>
        </div>
        <p className="text-sm text-[#a3ad9f]">
          {meta ? `${meta.total} compte${meta.total === 1 ? '' : 's'}` : 'Chargement des comptes…'}
        </p>
      </div>

      <form className="grid gap-3 border-y border-white/10 py-4 sm:grid-cols-[minmax(220px,1fr)_180px_160px_auto]" onSubmit={submitSearch}>
        <label className="grid gap-1 text-[11px] font-semibold text-[#cfd6c9]">
          Rechercher
          <input
            autoComplete="off"
            className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-normal"
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Nom, e-mail ou téléphone"
            value={searchDraft}
          />
        </label>
        <label className="grid gap-1 text-[11px] font-semibold text-[#cfd6c9]">
          Rôle
          <select
            className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-normal"
            onChange={(event) => applyFilter('role', event.target.value)}
            value={filters.role}
          >
            <option value="">Tous les rôles</option>
            {roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[11px] font-semibold text-[#cfd6c9]">
          État du compte
          <select
            className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-normal"
            onChange={(event) => applyFilter('statut', event.target.value)}
            value={filters.statut}
          >
            <option value="">Tous</option>
            <option value="actif">Actif</option>
            <option value="inactif">Désactivé</option>
          </select>
        </label>
        <button className="h-10 self-end rounded-full bg-[#b6f23a] px-4 text-xs font-bold text-[#0b0f0c] transition hover:bg-[#9ad92a]" type="submit">
          Rechercher
        </button>
      </form>

      {error && <p className="rounded-xl border border-[#ff6b4a]/30 bg-[#ff6b4a]/10 px-3 py-2 text-sm text-[#ff9b84]" role="alert">{error}</p>}
      {notice && <p className="rounded-xl border border-[#b6f23a]/30 bg-[#b6f23a]/10 px-3 py-2 text-sm text-[#b6f23a]" role="status">{notice}</p>}

      <div className="overflow-x-auto border-y border-white/10">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-white/[0.06] text-[10px] uppercase text-[#a3ad9f]">
            <tr>
              <th className="px-3 py-3 font-semibold">Utilisateur</th>
              <th className="px-3 py-3 font-semibold">Téléphone</th>
              <th className="px-3 py-3 font-semibold">État</th>
              <th className="px-3 py-3 font-semibold">Rôle</th>
              <th className="px-3 py-3 font-semibold">Inscription</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {users.map((user) => (
              <tr className="bg-white/[0.06]" key={user.id}>
                <td className="px-3 py-3">
                  <span className="block font-semibold text-[#f3f5ef]">{user.prenom} {user.nom}</span>
                  <span className="block text-xs text-[#88927f]">{user.email}</span>
                </td>
                <td className="px-3 py-3 text-[#cfd6c9]">{user.telephone || '—'}</td>
                <td className="px-3 py-3">
                  <span className={user.statut
                    ? 'rounded-full bg-[#b6f23a]/15 px-2 py-1 text-[10px] font-bold text-[#b6f23a]'
                    : 'rounded bg-[#eceeea] px-2 py-1 text-[10px] font-bold text-[#727a74]'}
                  >
                    {user.statut ? 'Actif' : 'Désactivé'}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <label className="sr-only" htmlFor={`user-role-${user.id}`}>
                    Rôle de {user.prenom} {user.nom}
                  </label>
                  <select
                    className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.06] px-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={updatingUserId === user.id || user.id === currentUserId}
                    id={`user-role-${user.id}`}
                    onChange={(event) => changeRole(user.id, event.target.value)}
                    value={user.role}
                  >
                    {roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                  </select>
                  {user.id === currentUserId && <span className="mt-1 block text-[10px] text-[#88927f]">Votre compte</span>}
                </td>
                <td className="px-3 py-3 text-xs text-[#a3ad9f]">
                  {user.created_at ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(user.created_at)) : '—'}
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && (
              <tr>
                <td className="px-3 py-10 text-center text-sm text-[#88927f]" colSpan="5">
                  Aucun utilisateur ne correspond à ces filtres.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="px-3 py-10 text-center text-sm text-[#88927f]" colSpan="5">Chargement…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#a3ad9f]">
        <span>{meta ? `Page ${meta.current_page} sur ${meta.last_page}` : ''}</span>
        <div className="flex gap-2">
          <button
            className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!meta || meta.current_page <= 1 || loading}
            onClick={() => { setLoading(true); setPage((current) => current - 1) }}
            type="button"
          >
            Précédent
          </button>
          <button
            className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!meta || meta.current_page >= meta.last_page || loading}
            onClick={() => { setLoading(true); setPage((current) => current + 1) }}
            type="button"
          >
            Suivant
          </button>
        </div>
      </div>
    </section>
  )
}
