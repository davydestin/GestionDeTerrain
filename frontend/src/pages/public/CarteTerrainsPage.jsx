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
    <main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-6 text-[#202b25] sm:px-7">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[#dfe3db] pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase text-[#2f7259]">Carte interactive · Dakar</p>
          <h1 className="mt-1 font-['Space_Grotesk'] text-3xl font-semibold">Terrains autour de vous</h1>
        </div>
        <Link className="text-xs font-bold text-[#2f7259] hover:underline" to="/terrains">Revenir à la liste</Link>
      </header>

      <form className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6" onSubmit={applyFilters}>
        <label className="grid gap-1 text-[10px] font-bold text-[#56635a]">
          Commune
          <select className="h-10 rounded border border-[#dce1d9] bg-[#fffefa] px-3 text-xs font-normal" name="commune_id" onChange={updateDraft} value={draft.commune_id}>
            <option value="">Toutes</option>
            {communes.map((commune) => <option key={commune.id} value={commune.id}>{commune.nom}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[10px] font-bold text-[#56635a]">
          Quartier
          <input className="h-10 rounded border border-[#dce1d9] bg-[#fffefa] px-3 text-xs font-normal" name="quartier" onChange={updateDraft} value={draft.quartier} />
        </label>
        <label className="grid gap-1 text-[10px] font-bold text-[#56635a]">
          Type
          <input className="h-10 rounded border border-[#dce1d9] bg-[#fffefa] px-3 text-xs font-normal" name="type" onChange={updateDraft} value={draft.type} />
        </label>
        <label className="grid gap-1 text-[10px] font-bold text-[#56635a]">
          Prix min. / h
          <input className="h-10 rounded border border-[#dce1d9] bg-[#fffefa] px-3 text-xs font-normal" min="0" name="min_price" onChange={updateDraft} type="number" value={draft.min_price} />
        </label>
        <label className="grid gap-1 text-[10px] font-bold text-[#56635a]">
          Prix max. / h
          <input className="h-10 rounded border border-[#dce1d9] bg-[#fffefa] px-3 text-xs font-normal" min="0" name="max_price" onChange={updateDraft} type="number" value={draft.max_price} />
        </label>
        <div className="flex items-end gap-2">
          <button className="h-10 rounded bg-[#2f7259] px-4 text-xs font-bold text-white hover:bg-[#255e48]" type="submit">Filtrer</button>
          <button className="h-10 rounded px-3 text-xs font-bold text-[#56635a] hover:bg-[#e9eee8]" onClick={resetFilters} type="button">Effacer</button>
        </div>
      </form>

      {error && <p className="mb-3 rounded border border-[#f0c5b3] bg-[#fff5f0] px-3 py-2 text-sm text-[#984b32]" role="alert">{error}</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-[62vh] min-h-[480px] overflow-hidden rounded-lg border border-[#dfe3db] bg-[#e6ebe3]">
          <DakarMap onBoundsChange={handleBoundsChange} selectedTerrainId={selectedTerrainId} terrains={terrains} />
        </div>
        <aside className="max-h-[62vh] overflow-y-auto border-y border-[#dfe3db] xl:min-h-[480px]">
          <div className="sticky top-0 z-[400] flex items-center justify-between border-b border-[#dfe3db] bg-[#f1f2eb] px-3 py-3 text-xs">
            <strong>{terrains.length} terrain{terrains.length === 1 ? '' : 's'} dans la zone</strong>
            {loading && <span className="text-[#77817a]">Actualisation…</span>}
          </div>
          {terrains.length === 0 && !loading ? (
            <p className="px-3 py-8 text-sm text-[#77817a]">Aucun terrain dans cette zone.</p>
          ) : terrains.map((terrain) => (
            <Link
              className={`block border-b border-[#e2e5de] px-3 py-4 hover:bg-[#fffefa] ${String(terrain.id) === selectedTerrainId ? 'bg-[#fffefa]' : ''}`}
              key={terrain.id}
              to={`/terrains/${terrain.id}`}
            >
              <span className="block font-semibold text-[#202b25]">{terrain.nom}</span>
              <span className="mt-1 block text-xs text-[#66736a]">
                {[terrain.quartier, terrain.commune?.nom].filter(Boolean).join(' · ')}
              </span>
              <span className="mt-2 block text-xs font-bold text-[#2f7259]">
                {Number(terrain.tarif_horaire).toLocaleString('fr-FR')} FCFA / h
              </span>
            </Link>
          ))}
        </aside>
      </div>
    </main>
  )
}
