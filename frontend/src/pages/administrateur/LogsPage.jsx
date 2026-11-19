import { useEffect, useState } from 'react'
import { getAdminLogs, readJson } from '../../services/api.js'

// Niveaux affichés en pastilles, du plus grave au plus anodin.
const LEVELS = [
  ['EMERGENCY', 'Urgence'],
  ['ALERT', 'Alerte'],
  ['CRITICAL', 'Critique'],
  ['ERROR', 'Erreur'],
  ['WARNING', 'Avertissement'],
  ['NOTICE', 'Notice'],
  ['INFO', 'Info'],
  ['DEBUG', 'Debug'],
]
const LEVEL_LABELS = Object.fromEntries(LEVELS)

function levelTone(level) {
  if (['EMERGENCY', 'ALERT', 'CRITICAL', 'ERROR'].includes(level)) return 'border-[#ff6b4a]/30 bg-[#ff6b4a]/10 text-[#ff9b84]'
  if (level === 'WARNING') return 'border-[#ffb547]/30 bg-[#ffb547]/10 text-[#ffcf85]'
  if (['NOTICE', 'INFO'].includes(level)) return 'border-[#3788ff]/30 bg-[#3788ff]/10 text-[#9fc2ff]'
  return 'border-white/15 bg-white/[0.06] text-[#cfd6c9]'
}

const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'medium' })
const dateOnly = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

function fileLabel(file) {
  const day = file.nom.match(/laravel-(\d{4}-\d{2}-\d{2})\.log/)?.[1]
  const name = day ? dateOnly.format(new Date(`${day}T12:00:00`)) : 'Historique (laravel.log)'
  return `${name} · ${formatSize(file.taille)}`
}

function safeDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date)
}

/** Logs techniques de l'application (erreurs, avertissements…), en lecture seule. */
export default function LogsPage() {
  const [filters, setFilters] = useState({ fichier: '', niveau: '', search: '', inclure_tests: '' })
  const [searchDraft, setSearchDraft] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true

    getAdminLogs({ ...filters, page })
      .then((response) => readJson(response, 'Impossible de charger les logs.'))
      .then((payload) => {
        if (!active) return
        setResult(payload)
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
  }, [filters, page, refreshKey])

  function applyFilter(name, value) {
    setLoading(true)
    setPage(1)
    setOpenId(null)
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function changePage(delta) {
    setLoading(true)
    setOpenId(null)
    setPage((current) => current + delta)
  }

  function refresh() {
    setLoading(true)
    setRefreshKey((key) => key + 1)
  }

  const entries = result?.entrees?.data || []
  const meta = result?.entrees
  const counts = result?.compteurs || {}
  const files = result?.fichiers || []
  const presentLevels = LEVELS.filter(([level]) => counts[level])

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Espace administrateur</p>
          <h1>Logs</h1>
        </div>
      </div>

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="max-w-2xl text-sm text-[#a3ad9f]">
            Erreurs et avertissements techniques de l’application (serveur Laravel), un fichier par jour,
            conservés 14 jours. Pour savoir qui a fait quoi, consultez plutôt le journal d’audit.
          </p>
          <button
            className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-[#cfd6c9] hover:bg-white/10 disabled:opacity-50"
            disabled={loading}
            onClick={refresh}
            type="button"
          >
            {loading ? 'Chargement…' : 'Actualiser'}
          </button>
        </div>

        <div className="grid gap-3 border-y border-white/10 py-4 sm:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-[#cfd6c9]">
            Jour
            <select
              className="h-10 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.06] pl-3 pr-8 text-sm font-normal"
              onChange={(event) => applyFilter('fichier', event.target.value)}
              value={filters.fichier || result?.fichier || ''}
            >
              {files.length === 0 && <option value="">Aucun fichier</option>}
              {files.map((file) => <option key={file.nom} value={file.nom}>{fileLabel(file)}</option>)}
            </select>
          </label>
          <form
            className="grid gap-1 text-[11px] font-semibold text-[#cfd6c9]"
            onSubmit={(event) => { event.preventDefault(); applyFilter('search', searchDraft.trim()) }}
          >
            <label htmlFor="logs-search">Rechercher dans les messages et les traces</label>
            <div className="flex gap-2">
              <input
                autoComplete="off"
                className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-normal"
                id="logs-search"
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Ex. : SQLSTATE, Google, géocodage"
                value={searchDraft}
              />
              <button className="h-10 rounded-full bg-[#b6f23a] px-4 text-xs font-bold text-[#0b0f0c] hover:bg-[#9ad92a]" type="submit">OK</button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2 sm:col-span-2" role="group" aria-label="Filtrer par niveau">
            <button
              aria-pressed={!filters.niveau}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${!filters.niveau ? 'border-[#b6f23a] bg-[#b6f23a]/15 text-[#b6f23a]' : 'border-white/10 text-[#cfd6c9] hover:bg-white/10'}`}
              onClick={() => applyFilter('niveau', '')}
              type="button"
            >
              Tous
            </button>
            {presentLevels.map(([level, label]) => (
              <button
                aria-pressed={filters.niveau === level}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold ${filters.niveau === level ? levelTone(level) : 'border-white/10 text-[#cfd6c9] hover:bg-white/10'}`}
                key={level}
                onClick={() => applyFilter('niveau', filters.niveau === level ? '' : level)}
                type="button"
              >
                {label} <span className="tabular-nums opacity-70">{counts[level]}</span>
              </button>
            ))}
          </div>
        </div>

        {result?.entrees_tests > 0 && (
          <label className="flex w-fit items-center gap-2 text-xs text-[#a3ad9f]">
            <input
              checked={filters.inclure_tests === '1'}
              onChange={(event) => applyFilter('inclure_tests', event.target.checked ? '1' : '')}
              type="checkbox"
            />
            Afficher les {result.entrees_tests} entrées générées par les tests automatiques (erreurs simulées, pas de vrais incidents)
          </label>
        )}

        {result?.tronque && (
          <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-[#a3ad9f]">
            Fichier volumineux : seules les entrées les plus récentes (3 derniers Mo) sont affichées.
          </p>
        )}
        {error && <p className="rounded-xl border border-[#ff6b4a]/30 bg-[#ff6b4a]/10 px-3 py-2 text-sm text-[#ff9b84]" role="alert">{error}</p>}

        <ul className="divide-y divide-white/10 border-y border-white/10">
          {!loading && entries.map((entry) => {
            const open = openId === entry.id

            return (
              <li className="py-3" key={entry.id}>
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${levelTone(entry.niveau)}`}>
                    {LEVEL_LABELS[entry.niveau] || entry.niveau}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-[#88927f]">{safeDate(entry.date)}</span>
                  {entry.environnement !== 'local' && entry.environnement !== 'production' && (
                    <span className="shrink-0 text-[10px] uppercase text-[#88927f]">{entry.environnement}</span>
                  )}
                  <p className="min-w-0 basis-full text-sm text-[#f3f5ef] [overflow-wrap:anywhere] sm:basis-auto sm:flex-1">{entry.message}</p>
                  {entry.details && (
                    <button
                      aria-expanded={open}
                      className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-xs font-semibold hover:bg-white/10"
                      onClick={() => setOpenId(open ? null : entry.id)}
                      type="button"
                    >
                      {open ? 'Masquer' : 'Détails'}
                    </button>
                  )}
                </div>
                {open && (
                  <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-[#0b0f0c]/70 p-3 font-mono text-[11px] leading-5 text-[#cfd6c9] whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {entry.details}
                  </pre>
                )}
              </li>
            )
          })}
          {!loading && entries.length === 0 && !error && (
            <li className="py-10 text-center text-sm text-[#88927f]">
              {filters.niveau || filters.search ? 'Aucune entrée ne correspond à ces filtres.' : 'Aucune entrée dans ce fichier : tout va bien.'}
            </li>
          )}
          {loading && <li className="py-10 text-center text-sm text-[#88927f]">Chargement…</li>}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#a3ad9f]">
          <span>{meta && meta.last_page > 0 ? `${meta.total} entrée${meta.total === 1 ? '' : 's'} · page ${meta.current_page} sur ${meta.last_page}` : ''}</span>
          <div className="flex gap-2">
            <button className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50" disabled={!meta || meta.current_page <= 1 || loading} onClick={() => changePage(-1)} type="button">
              Précédent
            </button>
            <button className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50" disabled={!meta || meta.current_page >= meta.last_page || loading} onClick={() => changePage(1)} type="button">
              Suivant
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
