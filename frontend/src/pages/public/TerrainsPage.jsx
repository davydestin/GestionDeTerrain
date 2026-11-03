import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCommunes, getPublicTerrains } from '../../services/api.js'
import TerrainCard from '../../components/TerrainCard.jsx'

const initialFilters = {
  commune_id: '',
  quartier: '',
  type: '',
  min_price: '',
  max_price: '',
}

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.message || 'Impossible de charger les terrains.')
  }

  return payload
}

export default function TerrainsPage() {
  const [communes, setCommunes] = useState([])
  const [filters, setFilters] = useState(initialFilters)
  const [draft, setDraft] = useState(initialFilters)
  const [terrainResult, setTerrainResult] = useState({ key: null, data: [], meta: null, error: '' })
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const requestKey = JSON.stringify({ ...filters, page })
  const currentResult = terrainResult.key === requestKey ? terrainResult : null
  const terrains = currentResult?.data || []
  const meta = currentResult?.meta || null
  const loading = currentResult === null
  const terrainError = currentResult?.error || ''

  useEffect(() => {
    let active = true

    getCommunes()
      .then(readResponse)
      .then((payload) => {
        if (active) setCommunes(payload.data || [])
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    getPublicTerrains({ ...filters, page })
      .then(readResponse)
      .then((payload) => {
        if (!active) return
        setTerrainResult({ key: requestKey, data: payload.data || [], meta: payload.meta || null, error: '' })
      })
      .catch((requestError) => {
        if (active) setTerrainResult({ key: requestKey, data: [], meta: null, error: requestError.message })
      })

    return () => {
      active = false
    }
  }, [filters, page, requestKey])

  function updateDraft(event) {
    setDraft((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function applyFilters(event) {
    event.preventDefault()
    setPage(1)
    setFilters(Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== '')))
  }

  function resetFilters() {
    setDraft(initialFilters)
    setFilters({})
    setPage(1)
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8 text-[#202b25] sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#dfe3db] pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase text-[#2f7259]">Dakar · Terrains actifs</p>
          <h1 className="mt-1 font-['Space_Grotesk'] text-3xl font-semibold">Trouver un terrain</h1>
        </div>
        <Link className="rounded border border-[#d5ddd4] px-4 py-2 text-xs font-bold text-[#2f7259] hover:bg-[#e9eee8]" to="/carte">
          Afficher la carte
        </Link>
      </div>

      <form className="grid gap-3 border-b border-[#dfe3db] py-5 sm:grid-cols-2 lg:grid-cols-6" onSubmit={applyFilters}>
        <label className="grid gap-1 text-[10px] font-bold text-[#56635a] lg:col-span-2">
          Commune
          <select className="h-10 rounded border border-[#dce1d9] bg-[#fffefa] px-3 text-xs font-normal" name="commune_id" onChange={updateDraft} value={draft.commune_id}>
            <option value="">Toutes les communes</option>
            {communes.map((commune) => <option key={commune.id} value={commune.id}>{commune.nom}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[10px] font-bold text-[#56635a]">
          Quartier
          <input className="h-10 rounded border border-[#dce1d9] bg-[#fffefa] px-3 text-xs font-normal" name="quartier" onChange={updateDraft} placeholder="Ex. Plateau" value={draft.quartier} />
        </label>
        <label className="grid gap-1 text-[10px] font-bold text-[#56635a]">
          Type
          <input className="h-10 rounded border border-[#dce1d9] bg-[#fffefa] px-3 text-xs font-normal" name="type" onChange={updateDraft} placeholder="Football" value={draft.type} />
        </label>
        <label className="grid gap-1 text-[10px] font-bold text-[#56635a]">
          Prix min. / h
          <input className="h-10 rounded border border-[#dce1d9] bg-[#fffefa] px-3 text-xs font-normal" min="0" name="min_price" onChange={updateDraft} type="number" value={draft.min_price} />
        </label>
        <label className="grid gap-1 text-[10px] font-bold text-[#56635a]">
          Prix max. / h
          <input className="h-10 rounded border border-[#dce1d9] bg-[#fffefa] px-3 text-xs font-normal" min="0" name="max_price" onChange={updateDraft} type="number" value={draft.max_price} />
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
          <button className="rounded bg-[#2f7259] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#255e48]" type="submit">Filtrer</button>
          <button className="rounded px-4 py-2.5 text-xs font-bold text-[#56635a] hover:bg-[#e9eee8]" onClick={resetFilters} type="button">Réinitialiser</button>
        </div>
      </form>

      <div className="flex items-center justify-between py-4 text-xs text-[#66736a]">
        <span>{meta ? `${meta.total} terrain${meta.total === 1 ? '' : 's'}` : 'Chargement des terrains…'}</span>
        <span>Résultats à Dakar</span>
      </div>

      {(error || terrainError) && <p className="mb-4 rounded border border-[#f0c5b3] bg-[#fff5f0] px-3 py-2 text-sm text-[#984b32]" role="alert">{error || terrainError}</p>}
      {loading ? (
        <p className="border-y border-[#e2e5de] py-10 text-center text-sm text-[#77817a]">Chargement…</p>
      ) : terrains.length === 0 ? (
        <p className="border-y border-[#e2e5de] py-10 text-center text-sm text-[#77817a]">Aucun terrain ne correspond à ces critères.</p>
      ) : (
        <div className="divide-y divide-[#e2e5de] border-y border-[#e2e5de]">
          {terrains.map((terrain) => <TerrainCard key={terrain.id} terrain={terrain} />)}
        </div>
      )}

      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between py-5 text-xs text-[#66736a]">
          <span>Page {meta.current_page} sur {meta.last_page}</span>
          <div className="flex gap-2">
            <button className="rounded border border-[#dce1d9] px-3 py-2 disabled:opacity-50" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} type="button">Précédent</button>
            <button className="rounded border border-[#dce1d9] px-3 py-2 disabled:opacity-50" disabled={page >= meta.last_page || loading} onClick={() => setPage((current) => current + 1)} type="button">Suivant</button>
          </div>
        </div>
      )}
    </main>
  )
}
