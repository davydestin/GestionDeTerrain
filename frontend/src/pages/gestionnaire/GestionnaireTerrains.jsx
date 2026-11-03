import { useEffect, useState } from 'react'
import { createTerrain, getManagerCommunes } from '../../services/api.js'

const initialForm = {
  commune_id: '',
  nom: '',
  quartier: '',
  adresse: '',
  description: '',
  type: '',
  capacite: '',
  tarif_horaire: '',
  latitude: '',
  longitude: '',
}

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const validationMessage = Object.values(payload.errors || {}).flat()[0]
    throw new Error(validationMessage || payload.message || 'Une erreur est survenue.')
  }

  return payload
}

export default function GestionnaireTerrains({ terrains, loading, onTerrainCreated }) {
  const [communes, setCommunes] = useState([])
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    getManagerCommunes()
      .then(readResponse)
      .then((payload) => {
        if (active) setCommunes(payload.communes || [])
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })

    return () => {
      active = false
    }
  }, [])

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    const details = Object.fromEntries(
      Object.entries(form).filter(([, value]) => value !== ''),
    )

    try {
      const payload = await readResponse(await createTerrain(details))
      onTerrainCreated(payload.terrain)
      setForm(initialForm)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-8">
      <form
        className="rounded-lg border border-[#dfe3db] bg-[#fffefa] p-5 shadow-sm sm:p-6"
        onSubmit={submit}
      >
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase text-[#2f7259]">Gestion immobilière</p>
            <h2 className="mt-1 font-['Space_Grotesk'] text-xl font-semibold text-[#202b25]">
              Ajouter un terrain
            </h2>
          </div>
          <span className="text-xs text-[#77817a]">Ville fixée à Dakar</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1.5 text-xs font-semibold text-[#3a463f]">
            Nom du terrain
            <input className="h-10 rounded border border-[#dce1d9] bg-white px-3 text-sm font-normal" name="nom" onChange={updateField} required value={form.nom} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-[#3a463f]">
            Commune
            <select className="h-10 rounded border border-[#dce1d9] bg-white px-3 text-sm font-normal" name="commune_id" onChange={updateField} required value={form.commune_id}>
              <option value="">Sélectionner une commune</option>
              {communes.map((commune) => <option key={commune.id} value={commune.id}>{commune.nom}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-[#3a463f]">
            Quartier
            <input className="h-10 rounded border border-[#dce1d9] bg-white px-3 text-sm font-normal" name="quartier" onChange={updateField} required value={form.quartier} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-[#3a463f] sm:col-span-2 lg:col-span-3">
            Adresse détaillée
            <input className="h-10 rounded border border-[#dce1d9] bg-white px-3 text-sm font-normal" name="adresse" onChange={updateField} required value={form.adresse} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-[#3a463f] sm:col-span-2 lg:col-span-3">
            Description <span className="font-normal text-[#77817a]">Facultatif</span>
            <textarea className="min-h-20 rounded border border-[#dce1d9] bg-white px-3 py-2 text-sm font-normal" name="description" onChange={updateField} value={form.description} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-[#3a463f]">
            Type de terrain
            <input className="h-10 rounded border border-[#dce1d9] bg-white px-3 text-sm font-normal" name="type" onChange={updateField} required value={form.type} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-[#3a463f]">
            Capacité
            <input className="h-10 rounded border border-[#dce1d9] bg-white px-3 text-sm font-normal" min="1" name="capacite" onChange={updateField} required type="number" value={form.capacite} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-[#3a463f]">
            Tarif horaire (FCFA)
            <input className="h-10 rounded border border-[#dce1d9] bg-white px-3 text-sm font-normal" min="0" name="tarif_horaire" onChange={updateField} required step="0.01" type="number" value={form.tarif_horaire} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-[#3a463f]">
            Latitude <span className="font-normal text-[#77817a]">Facultatif</span>
            <input className="h-10 rounded border border-[#dce1d9] bg-white px-3 text-sm font-normal" max="90" min="-90" name="latitude" onChange={updateField} step="any" type="number" value={form.latitude} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-[#3a463f]">
            Longitude <span className="font-normal text-[#77817a]">Facultatif</span>
            <input className="h-10 rounded border border-[#dce1d9] bg-white px-3 text-sm font-normal" max="180" min="-180" name="longitude" onChange={updateField} step="any" type="number" value={form.longitude} />
          </label>
        </div>

        {error && <p className="mt-4 rounded border border-[#f0c5b3] bg-[#fff5f0] px-3 py-2 text-xs text-[#984b32]" role="alert">{error}</p>}
        <div className="mt-5 flex justify-end">
          <button className="rounded bg-[#2f7259] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#255e48] disabled:cursor-wait disabled:opacity-60" disabled={saving || communes.length === 0} type="submit">
            {saving ? 'Enregistrement…' : 'Enregistrer le terrain'}
          </button>
        </div>
      </form>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-['Space_Grotesk'] text-lg font-semibold text-[#202b25]">Mes terrains</h2>
          <span className="text-xs text-[#77817a]">{terrains.length} résultat{terrains.length === 1 ? '' : 's'}</span>
        </div>
        {loading ? (
          <p className="py-5 text-sm text-[#77817a]">Chargement des terrains…</p>
        ) : terrains.length === 0 ? (
          <p className="border-t border-[#e2e5de] py-5 text-sm text-[#77817a]">Aucun terrain enregistré.</p>
        ) : (
          <div className="divide-y divide-[#e2e5de] border-y border-[#e2e5de]">
            {terrains.map((terrain) => (
              <article className="grid gap-2 bg-[#fffefa] px-3 py-4 text-xs sm:grid-cols-[1.4fr_1fr_auto] sm:items-center sm:gap-5 sm:px-4" key={terrain.id}>
                <div className="min-w-0">
                  <strong className="block text-sm text-[#202b25]">{terrain.nom}</strong>
                  <span className="block truncate text-[#77817a]">
                    {[terrain.quartier, terrain.commune?.nom, terrain.ville, terrain.adresse].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <span className="text-[#56635a]">{terrain.type} · {terrain.capacite} places</span>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {terrain.latitude && terrain.longitude && (
                    <span className="text-[#77817a]">{terrain.latitude}, {terrain.longitude}</span>
                  )}
                  <span className="rounded bg-[#e2eee5] px-2 py-1 text-[10px] font-bold text-[#286348]">{terrain.statut}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}