import { useEffect, useRef, useState } from 'react'
import LocationPicker from '../../components/LocationPicker.jsx'
import { createTerrain, getManagerCommunes, updateTerrain } from '../../services/api.js'
import { readResponse } from './helpers.js'
import { Notice } from './ui.jsx'

// Limite de la colonne `terrains.adresse` côté API.
const ADDRESS_MAX_LENGTH = 255

const emptyForm = {
  commune_id: '',
  nom: '',
  quartier: '',
  adresse: '',
  description: '',
  ville: 'Dakar',
  complement: '',
  type: '',
  capacite: '',
  tarif_horaire: '',
}

// Application dédiée au football : le champ « type » décrit le revêtement du terrain.
const REVETEMENTS_SUGGERES = ['Gazon synthétique', 'Gazon naturel', 'Sable', 'Terre battue', 'Salle (futsal)']

const inputClass = 'h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-normal'
const labelClass = 'grid gap-1.5 text-xs font-semibold text-[#cfd6c9]'

// « Mermoz-Sacré-Cœur » → « mermoz sacre coeur » : comparaison tolérante aux accents et tirets.
function normalizeName(value) {
  return (value || '')
    .replace(/œ/gi, 'oe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Retrouve la commune de la liste à partir du nom renvoyé par le géocodage.
function findCommune(communes, ...names) {
  for (const name of names.map(normalizeName).filter((value) => value.length >= 3)) {
    const exact = communes.find((commune) => normalizeName(commune.nom) === name)
    if (exact) return exact

    const partial = communes.filter((commune) => {
      const candidate = normalizeName(commune.nom)
      return candidate.includes(name) || name.includes(candidate)
    })
    if (partial.length === 1) return partial[0]
  }

  return null
}

function formFromTerrain(terrain) {
  if (!terrain) return emptyForm

  // On ne reprend que les champs éditables : pas d'images, commune, dates… dans le PATCH.
  return {
    ...emptyForm,
    commune_id: String(terrain.commune_id || ''),
    nom: terrain.nom || '',
    quartier: terrain.quartier || '',
    adresse: terrain.adresse || '',
    description: terrain.description || '',
    ville: terrain.ville || 'Dakar',
    type: terrain.type || '',
    capacite: terrain.capacite ?? '',
    // L'API renvoie « 25000.00 » : on affiche « 25000 ».
    tarif_horaire: terrain.tarif_horaire != null ? String(Number(terrain.tarif_horaire)) : '',
  }
}

/**
 * Formulaire d'ajout (terrain absent) ou de modification d'un terrain.
 * Le parent doit le remonter (prop `key`) pour l'initialiser avec un autre terrain.
 */
export default function TerrainForm({ terrain = null, onSaved, onCancel, submitLabel }) {
  const editing = Boolean(terrain)
  const [communes, setCommunes] = useState([])
  const [form, setForm] = useState(() => formFromTerrain(terrain))
  const [position, setPosition] = useState(() => (
    terrain?.latitude && terrain?.longitude ? { lat: Number(terrain.latitude), lng: Number(terrain.longitude) } : null
  ))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Champs d'adresse tapés à la main pendant cette saisie : la carte ne les écrase jamais.
  const userEditedFields = useRef(new Set())
  // En modification, l'adresse enregistrée n'est remplacée qu'une fois le repère réellement déplacé
  // (pas au simple affichage de la position existante).
  const pinMoved = useRef(false)

  function handlePositionChange(nextPosition) {
    pinMoved.current = true
    setPosition(nextPosition)
  }

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
    const { name, value } = event.target
    if (value === '') userEditedFields.current.delete(name)
    else userEditedFields.current.add(name)
    setForm((current) => ({ ...current, [name]: value }))
  }

  function applyAddressFromMap(address) {
    if (!address || (editing && !pinMoved.current)) return

    const commune = findCommune(communes, address.commune, address.quartier)
    const suggestions = {
      adresse: address.adresse || '',
      quartier: address.quartier || address.commune || '',
      commune_id: commune ? String(commune.id) : '',
    }
    const editedByUser = userEditedFields.current

    // Mise à jour pure (React peut l'exécuter deux fois en mode strict).
    setForm((current) => {
      const next = { ...current }

      for (const [field, suggestion] of Object.entries(suggestions)) {
        if (suggestion && (!editedByUser.has(field) || current[field] === '')) next[field] = suggestion
      }

      return next
    })
  }

  async function submit(event) {
    event.preventDefault()

    if (!position) {
      setError('Placez le terrain sur la carte (repère au centre) avant d’enregistrer.')
      return
    }

    const fullAddress = [form.adresse.trim(), form.complement.trim()].filter(Boolean).join(', ')
    if (fullAddress.length > ADDRESS_MAX_LENGTH) {
      setError(`L’adresse et son complément ne doivent pas dépasser ${ADDRESS_MAX_LENGTH} caractères au total (actuellement ${fullAddress.length}).`)
      return
    }

    setSaving(true)
    setError('')

    // `complement` n'existe pas côté API : il est fusionné dans `adresse`.
    const details = {
      ...form,
      complement: undefined,
      adresse: fullAddress,
      latitude: position.lat,
      longitude: position.lng,
    }

    try {
      const payload = editing
        ? await readResponse(await updateTerrain(terrain.id, details))
        : await readResponse(await createTerrain(details))
      await onSaved(payload.terrain)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#b6f23a]">1 · Le terrain</legend>
        <label className={`${labelClass} sm:col-span-2 lg:col-span-1`}>
          Nom du terrain
          <input className={inputClass} maxLength={150} name="nom" onChange={updateField} placeholder="Ex. : Terrain Synthétique Médina" required value={form.nom} />
        </label>
        <label className={labelClass}>
          Revêtement
          <input className={inputClass} list="revetements-terrain" name="type" onChange={updateField} placeholder="Ex. : Gazon synthétique" required value={form.type} />
          <datalist id="revetements-terrain">
            {REVETEMENTS_SUGGERES.map((revetement) => <option key={revetement} value={revetement} />)}
          </datalist>
        </label>
        <label className={labelClass}>
          Capacité (joueurs)
          <input className={inputClass} min="1" name="capacite" onChange={updateField} required type="number" value={form.capacite} />
        </label>
        <label className={labelClass}>
          Tarif horaire (FCFA)
          <input className={inputClass} min="0" name="tarif_horaire" onChange={updateField} required step="500" type="number" value={form.tarif_horaire} />
        </label>
      </fieldset>

      <fieldset className="rounded-2xl border border-white/10 bg-[#0b0f0c] p-3">
        <legend className="px-1 text-[11px] font-bold uppercase tracking-wide text-[#b6f23a]">2 · L’emplacement</legend>
        <p className="mb-3 px-1 text-[11px] text-[#88927f]">
          Faites glisser la carte pour amener l’entrée du terrain sous le repère, ou cherchez un lieu. L’adresse ci-dessous se remplit toute seule.
        </p>
        <LocationPicker onAddressResolved={applyAddressFromMap} onChange={handlePositionChange} value={position} />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#b6f23a]">3 · L’adresse</legend>
        <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>
          Adresse détaillée
          <input className={inputClass} maxLength={ADDRESS_MAX_LENGTH} name="adresse" onChange={updateField} placeholder="Rue, numéro, point de repère…" required value={form.adresse} />
        </label>
        <label className={labelClass}>
          Quartier
          <input className={inputClass} name="quartier" onChange={updateField} required value={form.quartier} />
        </label>
        <label className={labelClass}>
          Commune
          <select className={inputClass} name="commune_id" onChange={updateField} required value={form.commune_id}>
            <option value="">Sélectionner une commune</option>
            {communes.map((commune) => <option key={commune.id} value={commune.id}>{commune.nom}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          <span>Complément d’adresse <span className="font-normal text-[#88927f]">· facultatif</span></span>
          <input className={inputClass} name="complement" onChange={updateField} placeholder="Ex. : derrière la mosquée" value={form.complement} />
        </label>
        <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>
          <span>Description <span className="font-normal text-[#88927f]">· facultatif</span></span>
          <textarea className="min-h-24 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-normal" name="description" onChange={updateField} placeholder="Vestiaires, éclairage, parking, terrain à 5 ou à 11…" value={form.description} />
        </label>
      </fieldset>

      <Notice tone="error">{error}</Notice>

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <button className="rounded-full border border-white/10 px-4 py-2.5 text-xs font-semibold text-[#cfd6c9] hover:bg-white/10" onClick={onCancel} type="button">
            Annuler
          </button>
        )}
        <button className="rounded-full bg-[#b6f23a] px-5 py-2.5 text-xs font-bold text-[#0b0f0c] transition hover:bg-[#9ad92a] disabled:cursor-wait disabled:opacity-60" disabled={saving || communes.length === 0} type="submit">
          {saving ? 'Enregistrement…' : submitLabel || (editing ? 'Enregistrer les modifications' : 'Créer le terrain')}
        </button>
      </div>
    </form>
  )
}
