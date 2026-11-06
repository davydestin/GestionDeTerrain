import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DakarMap from '../../components/DakarMap.jsx'
import { getCommunes, getMapTerrains } from '../../services/api.js'

const emptyFilters = { commune_id: '', quartier: '', type: '', min_price: '', max_price: '' }

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const validationMessage = Object.values(payload.errors || {}).flat()[0]
    throw new Error(validationMessage || payload.message || 'Impossible de charger la carte.')
  }

  return payload
}

export default function CarteTerrainsPage() {
  const [searchParams] = useSearchParams()
  const [communes, setCommunes] = useState([])
  const [draft, setDraft] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [bounds, setBounds] = useState(null)
  const [mapResult, setMapResult] = useState({ key: null, terrains: [], error: '' })
  const [communesError, setCommunesError] = useState('')
  const selectedTerrainId = searchParams.get('terrain')
  const requestKey = bounds ? JSON.stringify({ ...bounds, ...filters }) : null
  const loading = requestKey !== null && mapResult.key !== requestKey
  const terrains = mapResult.key === requestKey ? mapResult.terrains : []
  const error = communesError || (mapResult.key === requestKey ? mapResult.error : '')

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
    let active = true

    getMapTerrains(JSON.parse(requestKey))
      .then(readResponse)
      .then((payload) => {
        if (active) {
          setMapResult({ key: requestKey, terrains: payload.data || [], error: '' })
        }
      })
      .catch((requestError) => {
        if (active) setMapResult({ key: requestKey, terrains: [], error: requestError.message })
      })

    return () => {
      active = false
    }
  }, [requestKey])

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
  }

  function resetFilters() {
    setDraft(emptyFilters)
    setFilters({})
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-8 text-[#f3f5ef] sm:px-7">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase text-[#b6f23a]">Carte interactive · Dakar</p>
          <h1 className="mt-1 font-heading text-3xl font-semibold">Terrains autour de vous</h1>
        </div>
        <Link className="text-xs font-bold text-[#b6f23a] hover:underline" to="/terrains">Revenir à la liste</Link>
      </header>

      <form className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6" onSubmit={applyFilters}>
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
          Type
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-normal text-white placeholder:text-white/30" name="type" onChange={updateDraft} value={draft.type} />
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

      {error && <p className="mb-3 rounded-xl border border-[#ff6b4a]/30 bg-[#ff6b4a]/10 px-3 py-2 text-sm text-[#ff9b84]" role="alert">{error}</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-[62vh] min-h-[480px] overflow-hidden rounded-3xl border border-white/10 bg-[#11160f]">
          <DakarMap onBoundsChange={handleBoundsChange} selectedTerrainId={selectedTerrainId} terrains={terrains} />
        </div>
        <aside className="max-h-[62vh] overflow-y-auto rounded-3xl border border-white/10 bg-white/[0.03] xl:h-[62vh] xl:max-h-none">
          <div className="sticky top-0 z-[400] flex items-center justify-between border-b border-white/10 bg-[#0b0f0c]/90 px-4 py-3 text-xs backdrop-blur">
            <strong>{terrains.length} terrain{terrains.length === 1 ? '' : 's'} dans la zone</strong>
            {loading && <span className="text-[#88927f]">Actualisation…</span>}
          </div>
          {terrains.length === 0 && !loading ? (
            <p className="px-3 py-8 text-sm text-[#88927f]">Aucun terrain dans cette zone.</p>
          ) : terrains.map((terrain) => (
            <Link
              className={`block border-b border-white/10 px-4 py-4 transition-colors hover:bg-white/[0.08] ${String(terrain.id) === selectedTerrainId ? 'bg-[#b6f23a]/10' : ''}`}
              key={terrain.id}
              to={`/terrains/${terrain.id}`}
            >
              <span className="block font-semibold text-[#f3f5ef]">{terrain.nom}</span>
              <span className="mt-1 block text-xs text-[#a3ad9f]">
                {[terrain.quartier, terrain.commune?.nom].filter(Boolean).join(' · ')}
              </span>
              <span className="mt-2 block text-xs font-bold text-[#b6f23a]">
                {Number(terrain.tarif_horaire).toLocaleString('fr-FR')} FCFA / h
              </span>
            </Link>
          ))}
        </aside>
      </div>
    </main>
  )
}
