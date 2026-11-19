import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DakarMap from '../../components/DakarMap.jsx'
import Icon from '../../components/Icon.jsx'
import ManagerScopeNotice from '../../components/ManagerScopeNotice.jsx'
import NavigationPanel from '../../components/NavigationPanel.jsx'
import { getCommunes, getMapTerrains, readJson } from '../../services/api.js'
import useRouteNavigation from './useRouteNavigation.js'

const emptyFilters = { commune_id: '', quartier: '', type: '', min_price: '', max_price: '' }

const readResponse = (response) => readJson(response, 'Impossible de charger la carte.')

/**
 * Carte des terrains. Page publique par défaut ; dans l'espace client (`embedded`),
 * elle s'affiche dans le cadre de l'espace et les fiches s'ouvrent sous `basePath`.
 */
export default function CarteTerrainsPage({ basePath = '/terrains', embedded = false }) {
  const [searchParams] = useSearchParams()
  const [communes, setCommunes] = useState([])
  const [draft, setDraft] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [bounds, setBounds] = useState(null)
  const [mapResult, setMapResult] = useState({ key: null, terrains: [], error: '' })
  const [communesError, setCommunesError] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeFilterCount = Object.values(filters).filter((value) => value !== '' && value != null).length
  const selectedTerrainId = searchParams.get('terrain')
  const requestKey = bounds ? JSON.stringify({ ...bounds, ...filters }) : null
  // On attend que la carte soit immobile avant d'interroger l'API (un glissement émet plusieurs zones).
  const [settledKey, setSettledKey] = useState(null)
  const loading = requestKey !== null && mapResult.key !== requestKey
  // Les terrains déjà affichés restent visibles pendant l'actualisation : pas de marqueurs qui clignotent.
  const terrains = mapResult.terrains
  const error = communesError || (mapResult.key === requestKey ? mapResult.error : '')

  // Localisation, suivi de position et itinéraire guidé.
  const nav = useRouteNavigation()
  const autoStarted = useRef(false)

  // Arrivée depuis la fiche d'un terrain avec « Itinéraire » (?terrain=ID&itineraire=1) :
  // le guidage démarre dès que le terrain est chargé sur la carte.
  const wantsRoute = searchParams.get('itineraire') === '1'
  const routeTarget = wantsRoute ? terrains.find((terrain) => String(terrain.id) === String(selectedTerrainId)) : null
  // Référence stable vers nav.start (l'objet `nav` change à chaque rendu).
  const startRouteRef = useRef(nav.start)
  useEffect(() => {
    startRouteRef.current = nav.start
  })
  useEffect(() => {
    if (!routeTarget || autoStarted.current) return
    autoStarted.current = true
    // Hors du rendu de l'effet : start() met à jour l'état de la page.
    setTimeout(() => startRouteRef.current(routeTarget), 0)
  }, [routeTarget])

  useEffect(() => {
    let active = true

    getCommunes()
      .then(readResponse)
      .then((payload) => {
        if (active) setCommunes(payload.data || [])
      })
      .catch((requestError) => {
        if (active) setCommunesError(requestError.message)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!requestKey) return undefined
    // Premier affichage immédiat, puis anti-rebond pour les déplacements suivants.
    const timer = setTimeout(() => setSettledKey(requestKey), settledKey === null ? 0 : 350)
    return () => clearTimeout(timer)
  }, [requestKey, settledKey])

  useEffect(() => {
    if (!settledKey) return undefined
    let active = true

    getMapTerrains(JSON.parse(settledKey))
      .then(readResponse)
      .then((payload) => {
        if (active) {
          setMapResult({ key: settledKey, terrains: payload.data || [], error: '' })
        }
      })
      .catch((requestError) => {
        // En cas d'erreur, on garde les derniers terrains connus plutôt que de vider la carte.
        if (active) setMapResult((current) => ({ ...current, key: settledKey, error: requestError.message }))
      })

    return () => {
      active = false
    }
  }, [settledKey])

  const handleBoundsChange = useCallback((nextBounds) => {
    setBounds((currentBounds) => {
      if (currentBounds && Object.keys(nextBounds).every((key) => currentBounds[key] === nextBounds[key])) {
        return currentBounds
      }

      return nextBounds
    })
  }, [])

  function updateDraft(event) {
    setDraft((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function applyFilters(event) {
    event.preventDefault()
    setFilters(Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== '')))
    setFiltersOpen(false)
  }

  function resetFilters() {
    setDraft(emptyFilters)
    setFilters({})
  }

  const navigationForMap = nav.navigation && {
    route: nav.navigation.route,
    remaining: nav.progress?.remaining,
    destination: nav.navigation.destination,
  }

  const Wrapper = embedded ? 'div' : 'main'

  return (
    <Wrapper className={embedded ? 'w-full text-[#f3f5ef]' : 'mx-auto min-h-screen w-full max-w-[1500px] px-4 py-6 text-[#f3f5ef] sm:px-7 sm:py-8'}>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-white/10 pb-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase text-[#b6f23a]">Carte interactive · Dakar</p>
          <h1 className="mt-1 font-heading text-2xl font-semibold sm:text-3xl">Terrains autour de vous</h1>
        </div>
        <Link className="text-xs font-bold text-[#b6f23a] hover:underline" to={basePath}>Revenir à la liste</Link>
      </header>

      <ManagerScopeNotice className="mb-4" />

      {/* Téléphone et tablette : filtres repliés derrière un bouton pour laisser la place à la carte. */}
      <button
        aria-controls="filtres-carte"
        aria-expanded={filtersOpen}
        className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-[#cfd6c9] hover:bg-white/10 lg:hidden"
        onClick={() => setFiltersOpen((open) => !open)}
        type="button"
      >
        {filtersOpen ? 'Masquer les filtres' : 'Filtrer les terrains'}
        {activeFilterCount > 0 && <span className="rounded-full bg-[#b6f23a] px-1.5 text-[10px] text-[#0b0f0c]">{activeFilterCount}</span>}
      </button>

      <form className={`mb-4 gap-3 sm:grid-cols-2 lg:grid lg:grid-cols-3 xl:grid-cols-6 ${filtersOpen ? 'grid' : 'hidden'}`} id="filtres-carte" onSubmit={applyFilters}>
        <label className="grid gap-1 text-[10px] font-bold text-[#cfd6c9]">
          Commune
          <select className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-normal text-white placeholder:text-white/30" name="commune_id" onChange={updateDraft} value={draft.commune_id}>
            <option value="">Toutes</option>
            {communes.map((commune) => <option key={commune.id} value={commune.id}>{commune.nom}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[10px] font-bold text-[#cfd6c9]">
          Quartier
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-normal text-white placeholder:text-white/30" name="quartier" onChange={updateDraft} value={draft.quartier} />
        </label>
        <label className="grid gap-1 text-[10px] font-bold text-[#cfd6c9]">
          Revêtement
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-normal text-white placeholder:text-white/30" name="type" onChange={updateDraft} placeholder="Synthétique" value={draft.type} />
        </label>
        <label className="grid gap-1 text-[10px] font-bold text-[#cfd6c9]">
          Prix min. / h
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-normal text-white placeholder:text-white/30" min="0" name="min_price" onChange={updateDraft} type="number" value={draft.min_price} />
        </label>
        <label className="grid gap-1 text-[10px] font-bold text-[#cfd6c9]">
          Prix max. / h
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-normal text-white placeholder:text-white/30" min="0" name="max_price" onChange={updateDraft} type="number" value={draft.max_price} />
        </label>
        <div className="flex items-end gap-2">
          <button className="h-10 rounded-full bg-[#b6f23a] px-4 text-xs font-bold text-[#0b0f0c] hover:bg-[#9ad92a]" type="submit">Filtrer</button>
          <button className="h-10 rounded-full px-3 text-xs font-bold text-[#cfd6c9] hover:bg-white/10" onClick={resetFilters} type="button">Effacer</button>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="inline-flex items-center gap-1.5 rounded-full border border-[#3788ff]/50 bg-[#3788ff]/10 px-4 py-2 text-xs font-bold text-[#9fc2ff] hover:bg-[#3788ff]/20" onClick={nav.locate} type="button">
          <Icon className="size-4" name="locate" />
          Me localiser
        </button>
        <button
          aria-pressed={nav.tracking}
          className={nav.tracking ? 'rounded-full bg-[#ff6b4a] px-4 py-2 text-xs font-bold text-white' : 'rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-[#cfd6c9] hover:bg-white/10'}
          onClick={nav.toggleTracking}
          type="button"
        >
          {nav.tracking ? 'Arrêter le suivi' : 'Suivre ma position'}
        </button>
        {nav.tracking && !nav.follow && !nav.navigation && (
          <button className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-[#cfd6c9] hover:bg-white/10" onClick={nav.recenter} type="button">Recentrer</button>
        )}
        {!nav.navigation && (
          <span className="text-xs text-[#88927f]">
            {nav.userPosition ? 'Touchez un terrain puis « Itinéraire » pour être guidé.' : 'Choisissez un terrain sur la carte, puis « Itinéraire ».'}
          </span>
        )}
      </div>

      {nav.navigation && (
        <NavigationPanel
          follow={nav.follow}
          navigation={nav.navigation}
          onBegin={nav.beginGuidance}
          onMode={nav.setMode}
          onRecenter={nav.recenter}
          onRetry={nav.retry}
          onStop={nav.stop}
          progress={nav.progress}
          userPosition={nav.userPosition}
        />
      )}

      {(error || nav.error) && <p className="mb-3 rounded-xl border border-[#ff6b4a]/30 bg-[#ff6b4a]/10 px-3 py-2 text-sm text-[#ff9b84]" role="alert">{error || nav.error}</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-[min(70svh,560px)] min-h-[360px] overflow-hidden rounded-3xl border border-white/10 bg-[#11160f] lg:h-[calc(100svh-15rem)] lg:min-h-[480px] lg:max-h-[820px]">
          <DakarMap
            centerRequest={nav.centerRequest}
            fitRoute={nav.fitRoute}
            follow={nav.follow}
            navigation={navigationForMap}
            onBoundsChange={handleBoundsChange}
            onManualMove={nav.pauseFollow}
            onRouteRequest={nav.start}
            // Venue pour un itinéraire, ou itinéraire en cours : pas de bulle par-dessus le tracé.
            openSelectedPopup={!wantsRoute && !nav.navigation}
            selectedTerrainId={selectedTerrainId}
            terrainBasePath={basePath}
            terrains={terrains}
            userPosition={nav.userPosition}
          />
        </div>
        <aside className="max-h-[50svh] overflow-y-auto rounded-3xl border border-white/10 bg-white/[0.03] xl:h-[calc(100svh-15rem)] xl:min-h-[480px] xl:max-h-[820px]">
          <div className="sticky top-0 z-[400] flex items-center justify-between border-b border-white/10 bg-[#0b0f0c]/90 px-4 py-3 text-xs backdrop-blur">
            <strong>{terrains.length} terrain{terrains.length === 1 ? '' : 's'} dans la zone</strong>
            {loading && <span className="text-[#88927f]">Actualisation…</span>}
          </div>
          {terrains.length === 0 && !loading ? (
            <p className="px-3 py-8 text-sm text-[#88927f]">Aucun terrain dans cette zone.</p>
          ) : terrains.map((terrain) => (
            <div
              className={`flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4 transition-colors hover:bg-white/[0.06] ${String(terrain.id) === selectedTerrainId ? 'bg-[#b6f23a]/10' : ''}`}
              key={terrain.id}
            >
              <Link className="min-w-0" to={`${basePath}/${terrain.id}`}>
                <span className="block font-semibold text-[#f3f5ef]">{terrain.nom}</span>
                <span className="mt-1 block text-xs text-[#a3ad9f]">
                  {[terrain.quartier, terrain.commune?.nom].filter(Boolean).join(' · ')}
                </span>
                <span className="mt-2 block text-xs font-bold text-[#b6f23a]">
                  {Number(terrain.tarif_horaire).toLocaleString('fr-FR')} FCFA / h
                </span>
              </Link>
              <button
                aria-label={`Itinéraire vers ${terrain.nom}`}
                className="grid size-9 shrink-0 place-items-center rounded-full border border-[#ff6b4a]/40 text-[#ff9b84] hover:bg-[#ff6b4a]/10"
                onClick={() => nav.start(terrain)}
                title="Itinéraire"
                type="button"
              >
                <Icon className="size-4" name="map-pin" />
              </button>
            </div>
          ))}
        </aside>
      </div>
    </Wrapper>
  )
}
