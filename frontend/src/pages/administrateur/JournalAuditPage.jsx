import { Fragment, useEffect, useState } from 'react'
import { roleLabels } from '../../components/roles.js'
import { getAuditLog, readJson } from '../../services/api.js'

const CATEGORIES = [
  ['auth', 'Connexions'],
  ['utilisateur', 'Comptes'],
  ['profil', 'Profils'],
  ['terrain', 'Terrains'],
  ['reservation', 'Réservations'],
]

// Couleur du badge selon la nature de l'action.
function actionTone(action) {
  if (/echouee|supprime|desactive|refusee|annulee/.test(action)) return 'border-[#ff6b4a]/30 bg-[#ff6b4a]/10 text-[#ff9b84]'
  if (/cree|creee|confirmee|active|inscription|ajout/.test(action)) return 'border-[#b6f23a]/30 bg-[#b6f23a]/10 text-[#b6f23a]'
  return 'border-white/15 bg-white/[0.06] text-[#cfd6c9]'
}

const FIELD_LABELS = {
  nom: 'Nom', prenom: 'Prénom', email: 'E-mail', telephone: 'Téléphone', password: 'Mot de passe',
  role: 'Rôle', statut: 'État', tarif_horaire: 'Tarif horaire', adresse: 'Adresse', quartier: 'Quartier',
  commune_id: 'Commune', capacite: 'Capacité', type: 'Revêtement', description: 'Description',
  latitude: 'Latitude', longitude: 'Longitude', jour_semaine: 'Jour', heure_ouverture: 'Ouverture',
  heure_fermeture: 'Fermeture', actif: 'Actif', date_debut: 'Début', date_fin: 'Fin', motif: 'Motif',
  photos: 'Photos (n°)', photo: 'Photo n°', horaires: 'Horaires', horaire: 'Horaire n°',
  indisponibilite: 'Fermeture n°', terrain_id: 'Terrain n°', montant_total: 'Montant (FCFA)', etat: 'État', jusqu_au: 'Jusqu’au',
}

const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'medium' })

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (value === true) return 'oui'
  if (value === false) return 'non'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function Details({ entry }) {
  // reconstitue / date_approximative sont affichés à part, pas dans la liste des détails.
  const { changements, reconstitue, date_approximative: approximate, ...others } = entry.details || {}

  return (
    <div className="grid gap-3 text-xs text-[#cfd6c9]">
      {reconstitue && (
        <p className="max-w-2xl rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[#a3ad9f]">
          Action antérieure à la mise en place du journal, reconstituée à partir des données enregistrées
          (pas d’adresse IP ni de navigateur).
          {approximate && ' La date est approximative : cette donnée n’a pas de date de création en base.'}
        </p>
      )}
      {changements && (
        <table className="w-full max-w-2xl border-collapse text-left">
          <thead className="text-[10px] uppercase text-[#88927f]">
            <tr><th className="py-1 pr-3 font-semibold">Champ</th><th className="py-1 pr-3 font-semibold">Avant</th><th className="py-1 font-semibold">Après</th></tr>
          </thead>
          <tbody>
            {Object.entries(changements).map(([field, change]) => (
              <tr className="border-t border-white/10" key={field}>
                <td className="py-1.5 pr-3 font-semibold text-[#f3f5ef]">{FIELD_LABELS[field] || field}</td>
                <td className="py-1.5 pr-3 text-[#ff9b84] [overflow-wrap:anywhere]">{formatValue(change.avant)}</td>
                <td className="py-1.5 text-[#b6f23a] [overflow-wrap:anywhere]">{formatValue(change.apres)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {Object.keys(others).length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {Object.entries(others).map(([key, value]) => (
            <Fragment key={key}>
              <dt className="text-[#88927f]">{FIELD_LABELS[key] || key.replaceAll('_', ' ')}</dt>
              <dd className="[overflow-wrap:anywhere]">{formatValue(value)}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[#88927f]">
        <dt>Cible</dt><dd>{entry.cible_type ? `${entry.cible_type} n° ${entry.cible_id}` : '—'}</dd>
        <dt>Navigateur</dt><dd className="[overflow-wrap:anywhere]">{entry.user_agent || '—'}</dd>
      </dl>
    </div>
  )
}

/** Journal d'audit : historique en lecture seule de toutes les actions sensibles. */
export default function JournalAuditPage() {
  const emptyFilters = { search: '', categorie: '', action: '', role: '', du: '', au: '' }
  const [filters, setFilters] = useState(emptyFilters)
  const [searchDraft, setSearchDraft] = useState('')
  const [page, setPage] = useState(1)
  const [entries, setEntries] = useState([])
  const [meta, setMeta] = useState(null)
  const [actions, setActions] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    let active = true

    getAuditLog({ ...filters, page })
      .then((response) => readJson(response, 'Impossible de charger le journal d’audit.'))
      .then((payload) => {
        if (!active) return
        const result = payload.entrees || {}
        setEntries(result.data || [])
        setMeta({ total: result.total, current_page: result.current_page, last_page: result.last_page })
        setActions(payload.actions || {})
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
    setPage(1)
    setOpenId(null)
    setFilters((current) => {
      const next = { ...current, [name]: value }
      // Une action précise n'a de sens que dans sa catégorie.
      if (name === 'categorie' && next.action && !next.action.startsWith(`${value}.`)) next.action = ''
      return next
    })
  }

  function changePage(delta) {
    setLoading(true)
    setOpenId(null)
    setPage((current) => current + delta)
  }

  function resetFilters() {
    setLoading(true)
    setPage(1)
    setSearchDraft('')
    setFilters(emptyFilters)
  }

  const visibleActions = Object.entries(actions).filter(([key]) => !filters.categorie || key.startsWith(`${filters.categorie}.`))
  const hasFilters = Object.values(filters).some(Boolean)
  const inputClass = 'h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-normal'
  const labelClass = 'grid gap-1 text-[11px] font-semibold text-[#cfd6c9]'

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Espace administrateur</p>
          <h1>Journal d’audit</h1>
        </div>
      </div>

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="max-w-2xl text-sm text-[#a3ad9f]">
            Connexions, gestion des comptes, terrains et réservations : chaque action sensible est enregistrée
            avec son auteur, sa date et son adresse IP. Les entrées ne peuvent être ni modifiées ni supprimées.
          </p>
          <p className="text-sm text-[#a3ad9f]">
            {meta ? `${meta.total} entrée${meta.total === 1 ? '' : 's'}` : 'Chargement…'}
          </p>
        </div>

        <form
          className="grid gap-3 border-y border-white/10 py-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
          onSubmit={(event) => { event.preventDefault(); applyFilter('search', searchDraft.trim()) }}
        >
          <label className={`${labelClass} sm:col-span-2 lg:col-span-3 xl:col-span-2`}>
            Rechercher
            <div className="flex gap-2">
              <input
                autoComplete="off"
                className={`${inputClass} min-w-0 flex-1`}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Auteur, e-mail, IP ou description"
                value={searchDraft}
              />
              <button className="h-10 rounded-full bg-[#b6f23a] px-4 text-xs font-bold text-[#0b0f0c] hover:bg-[#9ad92a]" type="submit">OK</button>
            </div>
          </label>
          <label className={labelClass}>
            Catégorie
            <select className={inputClass} onChange={(event) => applyFilter('categorie', event.target.value)} value={filters.categorie}>
              <option value="">Toutes</option>
              {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Action
            <select className={inputClass} onChange={(event) => applyFilter('action', event.target.value)} value={filters.action}>
              <option value="">Toutes</option>
              {visibleActions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Rôle de l’auteur
            <select className={inputClass} onChange={(event) => applyFilter('role', event.target.value)} value={filters.role}>
              <option value="">Tous</option>
              {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className={labelClass}>
              Du
              <input className={inputClass} max={filters.au || undefined} onChange={(event) => applyFilter('du', event.target.value)} type="date" value={filters.du} />
            </label>
            <label className={labelClass}>
              Au
              <input className={inputClass} min={filters.du || undefined} onChange={(event) => applyFilter('au', event.target.value)} type="date" value={filters.au} />
            </label>
          </div>
          {hasFilters && (
            <button className="justify-self-start text-xs font-semibold text-[#b6f23a] hover:underline sm:col-span-2 lg:col-span-3 xl:col-span-6" onClick={resetFilters} type="button">
              Effacer les filtres
            </button>
          )}
        </form>

        {error && <p className="rounded-xl border border-[#ff6b4a]/30 bg-[#ff6b4a]/10 px-3 py-2 text-sm text-[#ff9b84]" role="alert">{error}</p>}

        <div className="relative overflow-x-auto border-y border-white/10">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-white/[0.06] text-[10px] uppercase text-[#a3ad9f]">
              <tr>
                <th className="px-3 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Auteur</th>
                <th className="px-3 py-3 font-semibold">Action</th>
                <th className="px-3 py-3 font-semibold">Description</th>
                <th className="px-3 py-3 font-semibold">Adresse IP</th>
                <th className="px-3 py-3"><span className="sr-only">Détails</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {!loading && entries.map((entry) => {
                const open = openId === entry.id

                return (
                  <Fragment key={entry.id}>
                    <tr className="bg-white/[0.03] align-top">
                      <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-[#cfd6c9]">
                        {entry.details?.date_approximative && <span title="Date approximative">≈ </span>}
                        {dateTime.format(new Date(entry.created_at))}
                        {entry.details?.reconstitue && (
                          <span className="mt-1 block w-fit rounded-full border border-white/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#88927f]" title="Reconstitué à partir des données existantes">
                            Historique
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {entry.utilisateur_nom ? (
                          <>
                            <span className="block font-semibold text-[#f3f5ef]">{entry.utilisateur_nom}</span>
                            <span className="block text-xs text-[#88927f]">
                              {roleLabels[entry.utilisateur_role] || entry.utilisateur_role}
                              {!entry.utilisateur_id && ' · compte supprimé'}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs italic text-[#88927f]">Visiteur anonyme</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-bold ${actionTone(entry.action)}`}>
                          {actions[entry.action] || entry.action}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[#cfd6c9]">{entry.description}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-[#a3ad9f]">{entry.adresse_ip || '—'}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          aria-expanded={open}
                          className="rounded-lg border border-white/10 px-2 py-1 text-xs font-semibold hover:bg-white/10"
                          onClick={() => setOpenId(open ? null : entry.id)}
                          type="button"
                        >
                          {open ? 'Masquer' : 'Détails'}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-[#0b0f0c]/40">
                        <td className="px-3 py-4" colSpan="6"><Details entry={entry} /></td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {!loading && entries.length === 0 && !error && (
                <tr>
                  <td className="px-3 py-10 text-center text-sm text-[#88927f]" colSpan="6">
                    {hasFilters ? 'Aucune entrée ne correspond à ces filtres.' : 'Le journal est vide pour le moment.'}
                  </td>
                </tr>
              )}
              {loading && (
                <tr><td className="px-3 py-10 text-center text-sm text-[#88927f]" colSpan="6">Chargement…</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#a3ad9f]">
          <span>{meta && meta.last_page > 0 ? `Page ${meta.current_page} sur ${meta.last_page}` : ''}</span>
          <div className="flex gap-2">
            <button
              className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!meta || meta.current_page <= 1 || loading}
              onClick={() => changePage(-1)}
              type="button"
            >
              Précédent
            </button>
            <button
              className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!meta || meta.current_page >= meta.last_page || loading}
              onClick={() => changePage(1)}
              type="button"
            >
              Suivant
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
