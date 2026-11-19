import { useEffect, useState } from 'react'
import {
  createTerrainIndisponibilite,
  deleteTerrainIndisponibilite,
  getTerrainIndisponibilites,
} from '../../../services/api.js'
import { formatDateTime, readResponse } from '../helpers.js'
import { ConfirmButton, Notice } from '../ui.jsx'
import Icon from '../../../components/Icon.jsx'

const emptyForm = { date_debut: '', date_fin: '', motif: '' }

// Valeur pour <input type="datetime-local"> à l'heure locale : « 2026-11-20T08:00 ».
function localInputValue(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function durationLabel(start, end) {
  const hours = (new Date(end) - new Date(start)) / 3_600_000
  if (hours < 24) return `${Math.round(hours * 10) / 10} h`
  const days = Math.round((hours / 24) * 10) / 10
  return `${days} jour${days > 1 ? 's' : ''}`
}

export default function IndisponibilitesSection({ terrainId, onChanged }) {
  const [items, setItems] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [showPast, setShowPast] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true

    getTerrainIndisponibilites(terrainId)
      .then(readResponse)
      .then((payload) => {
        if (active) setItems(payload.indisponibilites || [])
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })

    return () => {
      active = false
    }
  }, [terrainId])

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function presetFullDay() {
    const start = new Date()
    start.setDate(start.getDate() + 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setHours(23, 59, 0, 0)
    setForm((current) => ({ ...current, date_debut: localInputValue(start), date_fin: localInputValue(end) }))
  }

  async function submit(event) {
    event.preventDefault()

    if (form.date_fin <= form.date_debut) {
      setError('La fin doit être après le début.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const payload = await readResponse(await createTerrainIndisponibilite(terrainId, {
        date_debut: form.date_debut.replace('T', ' '),
        date_fin: form.date_fin.replace('T', ' '),
        motif: form.motif.trim() || null,
      }))
      // Affichage immédiat à partir de la réponse, sans attendre un rechargement.
      setItems((current) => [...(current || []), payload.indisponibilite]
        .sort((a, b) => new Date(a.date_debut) - new Date(b.date_debut)))
      setForm(emptyForm)
      setNotice('Fermeture enregistrée : ces créneaux ne sont plus réservables.')
      onChanged?.()
    } catch (requestError) {
      setError(requestError.status === 409
        ? `${requestError.message} Annulez ou refusez d’abord les réservations concernées.`
        : requestError.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(item) {
    setBusyId(item.id)
    setError('')
    setNotice('')

    try {
      await readResponse(await deleteTerrainIndisponibilite(terrainId, item.id))
      setItems((current) => (current || []).filter((existing) => existing.id !== item.id))
      setNotice('Fermeture supprimée : les créneaux sont de nouveau réservables.')
      onChanged?.()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId(null)
    }
  }

  const now = new Date()
  const upcoming = (items || []).filter((item) => new Date(item.date_fin) >= now)
  const past = (items || []).filter((item) => new Date(item.date_fin) < now)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-3">
        <Notice onClose={() => setNotice('')}>{notice}</Notice>
        <Notice tone="error">{error}</Notice>

        {items === null ? (
          <p className="text-sm text-[#88927f]">Chargement…</p>
        ) : upcoming.length === 0 ? (
          <p className="rounded-2xl border border-white/10 px-4 py-6 text-sm text-[#88927f]">
            Aucune fermeture prévue. Ajoutez-en une pour un entretien, un tournoi privé ou des congés.
          </p>
        ) : (
          <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
            {upcoming.map((item) => (
              <li className="flex flex-wrap items-center gap-3 bg-white/[0.04] px-4 py-3" key={item.id}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#f3f5ef]">
                    {formatDateTime(item.date_debut)} <Icon className="mx-1 size-3.5 align-[-2px] text-[#88927f]" name="arrow-right" /> {formatDateTime(item.date_fin)}
                  </p>
                  <p className="text-[11px] text-[#88927f]">
                    {durationLabel(item.date_debut, item.date_fin)}{item.motif ? ` · ${item.motif}` : ''}
                  </p>
                </div>
                <ConfirmButton busy={busyId === item.id} confirmLabel="Supprimer" onConfirm={() => remove(item)}>
                  Supprimer
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}

        {past.length > 0 && (
          <div>
            <button className="text-[11px] font-semibold text-[#88927f] hover:text-[#cfd6c9]" onClick={() => setShowPast((value) => !value)} type="button">
              {showPast ? 'Masquer' : 'Afficher'} les {past.length} fermeture{past.length > 1 ? 's' : ''} passée{past.length > 1 ? 's' : ''}
            </button>
            {showPast && (
              <ul className="mt-2 space-y-1 text-[11px] text-[#88927f]">
                {past.map((item) => (
                  <li key={item.id}>{formatDateTime(item.date_debut)} <Icon className="mx-1 size-3 align-[-2px]" name="arrow-right" /> {formatDateTime(item.date_fin)}{item.motif ? ` · ${item.motif}` : ''}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <form className="h-fit space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4" onSubmit={submit}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#f3f5ef]">Fermer le terrain</p>
          <button className="text-[11px] font-semibold text-[#b6f23a] hover:underline" onClick={presetFullDay} type="button">Demain, toute la journée</button>
        </div>
        <label className="grid gap-1 text-[11px] font-semibold text-[#cfd6c9]">
          Début
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-normal text-white" min={localInputValue(now)} name="date_debut" onChange={updateField} required type="datetime-local" value={form.date_debut} />
        </label>
        <label className="grid gap-1 text-[11px] font-semibold text-[#cfd6c9]">
          Fin
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-normal text-white" min={form.date_debut || localInputValue(now)} name="date_fin" onChange={updateField} required type="datetime-local" value={form.date_fin} />
        </label>
        <label className="grid gap-1 text-[11px] font-semibold text-[#cfd6c9]">
          <span>Motif <span className="font-normal text-[#88927f]">· facultatif</span></span>
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-normal" maxLength={255} name="motif" onChange={updateField} placeholder="Entretien de la pelouse…" value={form.motif} />
        </label>
        <button className="w-full rounded-full bg-[#b6f23a] px-4 py-2.5 text-xs font-bold text-[#0b0f0c] disabled:opacity-60" disabled={saving} type="submit">
          {saving ? 'Enregistrement…' : 'Ajouter la fermeture'}
        </button>
      </form>
    </div>
  )
}
