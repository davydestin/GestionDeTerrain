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
    <main className="mx-auto w-full max-w-6xl px-5 py-10 text-[#f3f5ef] sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase text-[#b6f23a]">Dakar · Terrains actifs</p>
          <h1 className="mt-1 font-heading text-3xl font-semibold">Trouver un terrain</h1>
        </div>
        <Link className="rounded border border-white/10 px-4 py-2 text-xs font-bold text-[#b6f23a] hover:bg-white/10" to="/carte">
          Afficher la carte
        </Link>
      </div>

      <form className="grid gap-3 border-b border-white/10 py-5 sm:grid-cols-2 lg:grid-cols-6" onSubmit={applyFilters}>
        <label className="grid gap-1 text-[10px] font-bold text-[#cfd6c9] lg:col-span-2">
          Commune
          <select className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-normal text-white placeholder:text-white/30" name="commune_id" onChange={updateDraft} value={draft.commune_id}>
            <option value="">Toutes les communes</option>
            {communes.map((commune) => <option key={commune.id} value={commune.id}>{commune.nom}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[10px] font-bold text-[#cfd6c9]">
          Quartier
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-normal text-white placeholder:text-white/30" name="quartier" onChange={updateDraft} placeholder="Ex. Plateau" value={draft.quartier} />
        </label>
        <label className="grid gap-1 text-[10px] font-bold text-[#cfd6c9]">
          Type
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-normal text-white placeholder:text-white/30" name="type" onChange={updateDraft} placeholder="Football" value={draft.type} />
        </label>
        <label className="grid gap-1 text-[10px] font-bold text-[#cfd6c9]">
          Prix min. / h
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-normal text-white placeholder:text-white/30" min="0" name="min_price" onChange={updateDraft} type="number" value={draft.min_price} />
        </label>
        <label className="grid gap-1 text-[10px] font-bold text-[#cfd6c9]">
          Prix max. / h
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-normal text-white placeholder:text-white/30" min="0" name="max_price" onChange={updateDraft} type="number" value={draft.max_price} />
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
          <button className="rounded-full bg-[#b6f23a] px-5 py-2.5 text-xs font-bold text-[#0b0f0c] hover:bg-[#9ad92a]" type="submit">Filtrer</button>
          <button className="rounded px-4 py-2.5 text-xs font-bold text-[#cfd6c9] hover:bg-white/10" onClick={resetFilters} type="button">Réinitialiser</button>
        </div>
      </form>

      <div className="flex items-center justify-between py-4 text-xs text-[#a3ad9f]">
        <span>{meta ? `${meta.total} terrain${meta.total === 1 ? '' : 's'}` : 'Chargement des terrains…'}</span>
        <span>Résultats à Dakar</span>
      </div>

      {(error || terrainError) && <p className="mb-4 rounded-xl border border-[#ff6b4a]/30 bg-[#ff6b4a]/10 px-3 py-2 text-sm text-[#ff9b84]" role="alert">{error || terrainError}</p>}
      {loading ? (
        <p className="border-y border-white/10 py-10 text-center text-sm text-[#88927f]">Chargement…</p>
      ) : terrains.length === 0 ? (
        <p className="border-y border-white/10 py-10 text-center text-sm text-[#88927f]">Aucun terrain ne correspond à ces critères.</p>
      ) : (
        <div className="grid gap-4">
          {terrains.map((terrain) => <TerrainCard key={terrain.id} terrain={terrain} />)}
        </div>
      )}

      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between py-5 text-xs text-[#a3ad9f]">
          <span>Page {meta.current_page} sur {meta.last_page}</span>
          <div className="flex gap-2">
            <button className="rounded border border-white/10 px-3 py-2 disabled:opacity-50" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} type="button">Précédent</button>
            <button className="rounded border border-white/10 px-3 py-2 disabled:opacity-50" disabled={page >= meta.last_page || loading} onClick={() => setPage((current) => current + 1)} type="button">Suivant</button>
          </div>
        </div>
      )}
    </main>
  )
}
