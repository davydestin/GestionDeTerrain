import { useEffect, useState } from 'react'
import { createAdminUser, deleteAdminUser, getAdminUsers, readJson, updateAdminUser } from '../../services/api.js'

const roles = ['CLIENT', 'GESTIONNAIRE', 'ADMINISTRATEUR']
const roleLabels = {
  CLIENT: 'Client',
  GESTIONNAIRE: 'Gestionnaire',
  ADMINISTRATEUR: 'Administrateur',
}

const readResponse = (response) => readJson(response)

// Un compte client n'est modifiable que par le client lui-même (règle aussi appliquée par l'API).
const isClient = (user) => user.role === 'CLIENT'
const CLIENT_LOCKED_MESSAGE = 'Un compte client ne peut être modifié que par le client lui-même.'

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
  const emptyForm = { nom: '', prenom: '', email: '', telephone: '', password: '', role: 'CLIENT', statut: true }
  const [form, setForm] = useState(emptyForm)
  const [editingUserId, setEditingUserId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true

    getAdminUsers({ ...filters, page })
      .then(readResponse)
      .then((payload) => {
        if (!active) return
        setUsers(payload.users?.data || [])
        // Le paginateur Laravel place total / current_page / last_page à la racine (pas de clé « meta »).
        const page = payload.users
        setMeta(page ? { total: page.total, current_page: page.current_page, last_page: page.last_page } : null)
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

  function updateForm(event) {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  function startCreate() {
    setEditingUserId(null)
    setForm(emptyForm)
    setError('')
    setNotice('')
  }

  function startEdit(user) {
    setEditingUserId(user.id)
    setForm({ nom: user.nom, prenom: user.prenom, email: user.email, telephone: user.telephone || '', password: '', role: user.role, statut: Boolean(user.statut) })
    setError('')
    setNotice('')
  }

  async function submitUser(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      const details = { ...form }
      if (!details.password) delete details.password
      const payload = editingUserId
        ? await readResponse(await updateAdminUser(editingUserId, details))
        : await readResponse(await createAdminUser(details))
      setUsers((currentUsers) => editingUserId
        ? currentUsers.map((user) => user.id === editingUserId ? payload.user : user)
        : [payload.user, ...currentUsers])
      setNotice(editingUserId ? 'Utilisateur modifié.' : 'Utilisateur créé.')
      startCreate()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  async function removeUser(user) {
    if (!window.confirm(`Supprimer le compte de ${user.prenom} ${user.nom} ?`)) return
    setError('')
    setNotice('')

    try {
      await readResponse(await deleteAdminUser(user.id))
      setUsers((currentUsers) => currentUsers.filter((currentUser) => currentUser.id !== user.id))
      setNotice('Utilisateur supprimé.')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function changeRole(userId, role) {
    const previousRole = users.find((user) => user.id === userId)?.role
    setUpdatingUserId(userId)
    setError('')
    setNotice('')

    try {
      const payload = await readResponse(await updateAdminUser(userId, { role }))
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

      <form className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={submitUser}>
        <div className="sm:col-span-2 lg:col-span-4">
          <h3 className="text-sm font-semibold text-[#f3f5ef]">{editingUserId ? 'Modifier un compte' : 'Créer un compte'}</h3>
          <p className="mt-1 text-xs text-[#88927f]">
            Transmettez l’e-mail et le mot de passe à la personne : elle se connecte avec ces identifiants
            sur la page de connexion habituelle.
          </p>
        </div>
        <input aria-label="Prénom" className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm" name="prenom" onChange={updateForm} placeholder="Prénom" required value={form.prenom} />
        <input aria-label="Nom" className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm" name="nom" onChange={updateForm} placeholder="Nom" required value={form.nom} />
        <input aria-label="E-mail" className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm" name="email" onChange={updateForm} placeholder="E-mail" required type="email" value={form.email} />
        <input aria-label="Téléphone" className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm" name="telephone" onChange={updateForm} placeholder="Téléphone" value={form.telephone} />
        <input aria-label="Mot de passe" className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm" minLength="8" name="password" onChange={updateForm} placeholder={editingUserId ? 'Nouveau mot de passe (facultatif)' : 'Mot de passe'} required={!editingUserId} type="password" value={form.password} />
        <select aria-label="Rôle" className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm" name="role" onChange={updateForm} value={form.role}>{roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select>
        <label className="flex h-10 items-center gap-2 text-sm text-[#cfd6c9]"><input checked={form.statut} name="statut" onChange={updateForm} type="checkbox" /> Compte actif</label>
        <div className="flex gap-2">
          <button className="rounded-full bg-[#b6f23a] px-4 py-2 text-xs font-bold text-[#0b0f0c] disabled:opacity-50" disabled={saving} type="submit">{saving ? 'Enregistrement…' : editingUserId ? 'Enregistrer' : 'Créer'}</button>
          {editingUserId && <button className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold" onClick={startCreate} type="button">Annuler</button>}
        </div>
      </form>

      <form className="grid gap-3 border-y border-white/10 py-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_180px_160px_auto]" onSubmit={submitSearch}>
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

      {/* « relative » : sinon les étiquettes sr-only (position absolue) échappent au défilement et élargissent la page. */}
      <div className="relative overflow-x-auto border-y border-white/10">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-white/[0.06] text-[10px] uppercase text-[#a3ad9f]">
            <tr>
              <th className="px-3 py-3 font-semibold">Utilisateur</th>
              <th className="px-3 py-3 font-semibold">Téléphone</th>
              <th className="px-3 py-3 font-semibold">État</th>
              <th className="px-3 py-3 font-semibold">Rôle</th>
              <th className="px-3 py-3 font-semibold">Inscription</th>
              <th className="px-3 py-3 font-semibold">Actions</th>
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
                    disabled={updatingUserId === user.id || user.id === currentUserId || isClient(user)}
                    id={`user-role-${user.id}`}
                    onChange={(event) => changeRole(user.id, event.target.value)}
                    title={isClient(user) ? CLIENT_LOCKED_MESSAGE : undefined}
                    value={user.role}
                  >
                    {roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                  </select>
                  {user.id === currentUserId && <span className="mt-1 block text-[10px] text-[#88927f]">Votre compte</span>}
                  {isClient(user) && <span className="mt-1 block text-[10px] text-[#88927f]">Profil géré par le client</span>}
                </td>
                <td className="px-3 py-3 text-xs text-[#a3ad9f]">
                  {user.created_at ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(user.created_at)) : '—'}
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    <button className="rounded-lg border border-white/10 px-2 py-1 text-xs font-semibold hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent" disabled={isClient(user)} onClick={() => startEdit(user)} title={isClient(user) ? CLIENT_LOCKED_MESSAGE : undefined} type="button">Modifier</button>
                    <button className="rounded-lg border border-[#ff6b4a]/30 px-2 py-1 text-xs font-semibold text-[#ff9b84] hover:bg-[#ff6b4a]/10 disabled:opacity-50" disabled={user.id === currentUserId} onClick={() => removeUser(user)} type="button">Supprimer</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && (
              <tr>
                <td className="px-3 py-10 text-center text-sm text-[#88927f]" colSpan="6">
                  Aucun utilisateur ne correspond à ces filtres.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="px-3 py-10 text-center text-sm text-[#88927f]" colSpan="6">Chargement…</td>
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
