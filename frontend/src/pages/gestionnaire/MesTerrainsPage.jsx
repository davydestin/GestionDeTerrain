import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { deleteTerrain, getManagedTerrains } from '../../services/api.js'
import AvailabilityDialog from './AvailabilityDialog.jsx'
import { formatPrice, primaryImage, readResponse } from './helpers.js'
import { AvailabilityBadge, ConfirmButton, Notice, TerrainPhotoPlaceholder } from './ui.jsx'

const STATUS_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'ACTIF', label: 'En ligne' },
  { value: 'INACTIF', label: 'Hors ligne' },
]

function StatTile({ label, value, tone = 'default' }) {
  const color = tone === 'warning' && value > 0 ? 'text-[#ffb59f]' : 'text-[#f3f5ef]'

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-[11px] font-semibold text-[#88927f]">{label}</p>
      <p className={`mt-1 font-heading text-2xl font-semibold tabular-nums ${color}`}>{value ?? '—'}</p>
    </div>
  )
}

function TerrainCard({ terrain, index = 0, busy, onEditAvailability, onDelete }) {
  const photo = primaryImage(terrain)
  const noHours = (terrain.horaires_actifs_count ?? 0) === 0
  const pending = terrain.reservations_en_attente_count ?? 0
  const upcoming = terrain.reservations_a_venir_count ?? 0

  return (
    <article className="anim-fade-up lift group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]" style={{ "--i": index }}>
      <Link className="relative block aspect-[16/10] overflow-hidden" to={`/gestionnaire/terrains/${terrain.id}`}>
        {photo
          ? <img alt="" className="zoom-on-hover h-full w-full object-cover" loading="lazy" src={photo.url} />
          : <TerrainPhotoPlaceholder className="h-full w-full" terrain={terrain} />}
        <AvailabilityBadge className="absolute left-3 top-3" terrain={terrain} />
        {photo && terrain.images?.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-[#0b0f0c]/80 px-2 py-1 text-[10px] font-semibold text-[#cfd6c9]">
            {terrain.images.length} photos
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <Link className="font-heading text-base font-semibold text-[#f3f5ef] hover:text-[#b6f23a]" to={`/gestionnaire/terrains/${terrain.id}`}>
            {terrain.nom}
          </Link>
          <p className="mt-0.5 truncate text-xs text-[#88927f]">
            {[terrain.quartier, terrain.commune?.nom].filter(Boolean).join(' · ')}
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <dt className="text-[#88927f]">Revêtement</dt>
            <dd className="truncate font-semibold text-[#cfd6c9]">{terrain.type}</dd>
          </div>
          <div>
            <dt className="text-[#88927f]">Capacité</dt>
            <dd className="font-semibold text-[#cfd6c9]">{terrain.capacite} joueurs</dd>
          </div>
          <div>
            <dt className="text-[#88927f]">Tarif / h</dt>
            <dd className="font-semibold text-[#b6f23a]">{formatPrice(terrain.tarif_horaire)}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-1.5">
          {noHours && (
            <Link className="rounded-full bg-[#ff6b4a]/15 px-2.5 py-1 text-[10px] font-bold text-[#ffb59f] hover:bg-[#ff6b4a]/25" to={`/gestionnaire/terrains/${terrain.id}?onglet=horaires`}>
              Aucun horaire · non réservable
            </Link>
          )}
          {pending > 0 && (
            <span className="rounded-full bg-[#b6f23a]/15 px-2.5 py-1 text-[10px] font-bold text-[#d6f79a]">
              {pending} demande{pending > 1 ? 's' : ''} en attente
            </span>
          )}
          {upcoming > 0 && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-[#cfd6c9]">
              {upcoming} réservation{upcoming > 1 ? 's' : ''} à venir
            </span>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <Link className="rounded-full bg-[#b6f23a] px-3.5 py-1.5 text-[11px] font-bold text-[#0b0f0c] hover:bg-[#9ad92a]" to={`/gestionnaire/terrains/${terrain.id}`}>
            Gérer
          </Link>
          <button
            className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-[#cfd6c9] hover:bg-white/10 disabled:opacity-60"
            disabled={busy}
            onClick={() => onEditAvailability(terrain)}
            type="button"
          >
            Disponibilité
          </button>
          <span className="ml-auto">
            <ConfirmButton busy={busy} confirmLabel="Supprimer" onConfirm={() => onDelete(terrain)}>Supprimer</ConfirmButton>
          </span>
        </div>
      </div>
    </article>
  )
}

export default function MesTerrainsPage() {
  const location = useLocation()
  const [terrains, setTerrains] = useState([])
  const [meta, setMeta] = useState(null)
  const [stats, setStats] = useState(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statut, setStatut] = useState('')
  const [loadedFilters, setLoadedFilters] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(location.state?.notice || '')
  const [reloadToken, setReloadToken] = useState(0)
  const [availabilityTerrain, setAvailabilityTerrain] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  const filtersKey = `${debouncedSearch}|${statut}|${reloadToken}`
  const loading = loadedFilters !== filtersKey

  useEffect(() => {
    let active = true

    getManagedTerrains({ search: debouncedSearch, statut })
      .then(readResponse)
      .then((payload) => {
        if (!active) return
        setTerrains(payload.data || [])
        setMeta(payload.meta || null)
        setStats(payload.stats || null)
        setError('')
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoadedFilters(`${debouncedSearch}|${statut}|${reloadToken}`)
      })

    return () => {
      active = false
    }
  }, [debouncedSearch, statut, reloadToken])

  async function loadMore() {
    if (!meta || meta.current_page >= meta.last_page) return
    setLoadingMore(true)

    try {
      const payload = await readResponse(await getManagedTerrains({ search: debouncedSearch, statut, page: meta.current_page + 1 }))
      setTerrains((current) => {
        const known = new Set(current.map((terrain) => terrain.id))
        return [...current, ...(payload.data || []).filter((terrain) => !known.has(terrain.id))]
      })
      setMeta(payload.meta || null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoadingMore(false)
    }
  }

  function availabilitySaved(updatedTerrain, message) {
    // La carte reprend tout de suite le terrain renvoyé par l'API ; les compteurs se rechargent ensuite.
    setTerrains((current) => current.map((terrain) => (terrain.id === updatedTerrain.id ? { ...terrain, ...updatedTerrain } : terrain)))
    setError('')
    setNotice(message)
    setReloadToken((token) => token + 1)
  }

  async function removeTerrain(terrain) {
    setBusyId(terrain.id)
    setError('')

    try {
      await readResponse(await deleteTerrain(terrain.id))
      setNotice(`« ${terrain.nom} » a été supprimé.`)
      setReloadToken((token) => token + 1)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId(null)
    }
  }

  const hasFilters = Boolean(debouncedSearch || statut)
  const total = stats?.total ?? 0
  const hasMore = meta && meta.current_page < meta.last_page

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Espace gestionnaire</p>
          <h1 className="font-display text-3xl font-semibold uppercase text-[#f3f5ef] sm:text-4xl">Mes terrains</h1>
        </div>
        <Link className="inline-flex items-center gap-2 rounded-full bg-[#b6f23a] px-5 py-2.5 text-xs font-bold text-[#0b0f0c] hover:bg-[#9ad92a]" to="/gestionnaire/terrains/nouveau">
          <span aria-hidden="true" className="text-base leading-none">+</span>
          Ajouter un terrain
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Terrains" value={stats?.total} />
        <StatTile label="En ligne" value={stats?.actifs} />
        <StatTile label="Hors ligne" value={stats?.inactifs} />
        <StatTile label="Demandes en attente" tone="warning" value={stats?.reservations_en_attente} />
      </div>

      {stats?.sans_horaires > 0 && (
        <Notice tone="error">
          {stats.sans_horaires} terrain{stats.sans_horaires > 1 ? 's n’ont' : ' n’a'} aucun horaire d’ouverture : {stats.sans_horaires > 1 ? 'ils ne peuvent' : 'il ne peut'} pas être réservé{stats.sans_horaires > 1 ? 's' : ''}. Ouvrez la fiche et renseignez l’onglet « Horaires ».
        </Notice>
      )}
      <Notice onClose={() => setNotice('')}>{notice}</Notice>
      <Notice tone="error">{error}</Notice>

      {total > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            aria-label="Rechercher un terrain"
            className="h-10 w-full min-w-0 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm sm:w-auto sm:max-w-sm sm:flex-1"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher par nom, quartier, type…"
            type="search"
            value={search}
          />
          <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-1" role="group" aria-label="Filtrer par statut">
            {STATUS_FILTERS.map((filter) => (
              <button
                aria-pressed={statut === filter.value}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${statut === filter.value ? 'bg-[#b6f23a] text-[#0b0f0c]' : 'text-[#cfd6c9] hover:bg-white/10'}`}
                key={filter.value || 'tous'}
                onClick={() => setStatut(filter.value)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
          {meta && <span className="text-xs text-[#88927f]">{meta.total} résultat{meta.total > 1 ? 's' : ''}</span>}
        </div>
      )}

      {loading && terrains.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((index) => <div className="h-80 skeleton" key={index} />)}
        </div>
      ) : total === 0 && !hasFilters ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center">
          <p className="font-heading text-lg font-semibold text-[#f3f5ef]">Vous n’avez pas encore de terrain</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#88927f]">
            Ajoutez votre premier terrain : placez-le sur la carte, ajoutez des photos et vos horaires, et il apparaîtra aux clients de Dakar.
          </p>
          <Link className="mt-5 inline-block rounded-full bg-[#b6f23a] px-5 py-2.5 text-xs font-bold text-[#0b0f0c]" to="/gestionnaire/terrains/nouveau">
            Ajouter mon premier terrain
          </Link>
        </div>
      ) : terrains.length === 0 ? (
        <p className="rounded-2xl border border-white/10 px-6 py-10 text-center text-sm text-[#88927f]">
          Aucun terrain ne correspond à ces critères.
        </p>
      ) : (
        <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
          {terrains.map((terrain, index) => (
            <TerrainCard
              index={index}
              busy={busyId === terrain.id}
              key={terrain.id}
              onDelete={removeTerrain}
              onEditAvailability={setAvailabilityTerrain}
              terrain={terrain}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <button className="rounded-full border border-white/10 px-5 py-2 text-xs font-semibold text-[#cfd6c9] hover:bg-white/10 disabled:opacity-60" disabled={loadingMore} onClick={loadMore} type="button">
            {loadingMore ? 'Chargement…' : 'Afficher plus de terrains'}
          </button>
        </div>
      )}

      {availabilityTerrain && (
        <AvailabilityDialog
          onClose={() => setAvailabilityTerrain(null)}
          onSaved={availabilitySaved}
          terrain={availabilityTerrain}
        />
      )}
    </div>
  )
}
