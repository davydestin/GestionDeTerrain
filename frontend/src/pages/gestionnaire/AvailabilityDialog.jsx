import { useEffect, useRef, useState } from 'react'
import { setTerrainAvailability } from '../../services/api.js'
import { readResponse } from './helpers.js'
import { Notice } from './ui.jsx'
import Icon from '../../components/Icon.jsx'

// Valeur pour <input type="datetime-local"> à l'heure locale.
function localInputValue(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function endOfDay(daysFromToday) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)
  date.setHours(23, 59, 0, 0)
  return date
}

const DURATIONS = [
  { key: 'ce_soir', label: 'Jusqu’à ce soir', until: () => endOfDay(0) },
  { key: 'demain', label: 'Jusqu’à demain soir', until: () => endOfDay(1) },
  { key: 'semaine', label: 'Pendant 7 jours', until: () => endOfDay(7) },
  { key: 'date', label: 'Jusqu’à une date précise', until: null },
  { key: 'nouvel_ordre', label: 'Jusqu’à nouvel ordre (masquer le terrain)', until: null },
]

/**
 * Fenêtre « Disponibilité du terrain » : rendre disponible, ou indisponible pour une durée
 * (le terrain reste visible mais n'est plus réservable) ou jusqu'à nouvel ordre (terrain masqué).
 */
export default function AvailabilityDialog({ terrain, onClose, onSaved }) {
  const etat = terrain.disponibilite?.etat || (terrain.statut === 'ACTIF' ? 'DISPONIBLE' : 'HORS_LIGNE')
  const [duration, setDuration] = useState('ce_soir')
  const [customDate, setCustomDate] = useState(() => localInputValue(endOfDay(2)))
  const [motif, setMotif] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef(null)
  const upcoming = terrain.reservations_a_venir_count ?? 0

  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(details, successMessage) {
    setSaving(true)
    setError('')

    try {
      const payload = await readResponse(await setTerrainAvailability(terrain.id, details))
      await onSaved(payload.data, successMessage)
      onClose()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  function makeUnavailable(event) {
    event.preventDefault()
    const choice = DURATIONS.find((item) => item.key === duration)

    if (duration === 'nouvel_ordre') {
      submit({ etat: 'INDISPONIBLE', jusqu_au: null }, `« ${terrain.nom} » est masqué aux clients jusqu’à nouvel ordre.`)
      return
    }

    const until = choice.until ? choice.until() : new Date(customDate)
    if (Number.isNaN(until.getTime()) || until <= new Date()) {
      setError('Choisissez une date de fin dans le futur.')
      return
    }

    submit(
      { etat: 'INDISPONIBLE', jusqu_au: localInputValue(until).replace('T', ' '), motif: motif.trim() || null },
      `« ${terrain.nom} » est indisponible jusqu’au ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(until)}.`,
    )
  }

  return (
    <div className="anim-fade-in fixed inset-0 z-[1400] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        aria-labelledby="availability-title"
        aria-modal="true"
        className="anim-pop max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#11160f] p-5 shadow-2xl outline-none [transform-origin:center]"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold text-[#f3f5ef]" id="availability-title">Disponibilité du terrain</h2>
            <p className="text-xs text-[#88927f]">{terrain.nom}</p>
          </div>
          <button aria-label="Fermer" className="grid size-8 place-items-center rounded-full text-[#88927f] hover:bg-white/10 hover:text-white" onClick={onClose} type="button"><Icon className="size-4" name="close" /></button>
        </div>

        {etat !== 'DISPONIBLE' && (
          <div className="mt-4 rounded-xl border border-[#b6f23a]/30 bg-[#b6f23a]/[0.06] p-3">
            <p className="text-xs text-[#cfd6c9]">
              {etat === 'HORS_LIGNE'
                ? 'Le terrain est actuellement masqué aux clients.'
                : `Le terrain est fermé${terrain.disponibilite?.motif ? ` (${terrain.disponibilite.motif})` : ''}.`}
            </p>
            <button
              className="mt-2 w-full rounded-full bg-[#b6f23a] px-4 py-2.5 text-xs font-bold text-[#0b0f0c] hover:bg-[#9ad92a] disabled:opacity-60"
              disabled={saving}
              onClick={() => submit({ etat: 'DISPONIBLE' }, `« ${terrain.nom} » est de nouveau disponible à la réservation.`)}
              type="button"
            >
              {saving ? 'Enregistrement…' : 'Rendre disponible maintenant'}
            </button>
          </div>
        )}

        <form className="mt-4 space-y-3" onSubmit={makeUnavailable}>
          <p className="text-xs font-semibold text-[#f3f5ef]">{etat === 'DISPONIBLE' ? 'Rendre le terrain indisponible' : 'Ou modifier l’indisponibilité'}</p>
          <fieldset className="grid gap-1.5">
            <legend className="sr-only">Durée</legend>
            {DURATIONS.map((item) => (
              <label className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-xs ${duration === item.key ? 'border-[#b6f23a]/60 bg-[#b6f23a]/[0.06] text-[#f3f5ef]' : 'border-white/10 text-[#cfd6c9] hover:bg-white/[0.04]'}`} key={item.key}>
                <input checked={duration === item.key} className="accent-[#b6f23a]" name="duree" onChange={() => setDuration(item.key)} type="radio" value={item.key} />
                {item.label}
              </label>
            ))}
          </fieldset>

          {duration === 'date' && (
            <label className="grid gap-1 text-[11px] font-semibold text-[#cfd6c9]">
              Indisponible jusqu’au
              <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-normal text-white" min={localInputValue(new Date())} onChange={(event) => setCustomDate(event.target.value)} required type="datetime-local" value={customDate} />
            </label>
          )}

          {duration !== 'nouvel_ordre' ? (
            <label className="grid gap-1 text-[11px] font-semibold text-[#cfd6c9]">
              <span>Motif <span className="font-normal text-[#88927f]">· affiché aux clients</span></span>
              <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-normal" maxLength={255} onChange={(event) => setMotif(event.target.value)} placeholder="Ex. : travaux, pluie, tournoi privé…" value={motif} />
            </label>
          ) : (
            <p className="rounded-xl bg-white/[0.04] px-3 py-2 text-[11px] text-[#a3ad9f]">
              Le terrain disparaît de la recherche et de la carte.
              {upcoming > 0 && ` Attention : ${upcoming} réservation${upcoming > 1 ? 's' : ''} à venir ${upcoming > 1 ? 'restent' : 'reste'} maintenue${upcoming > 1 ? 's' : ''} ; prévenez les clients ou refusez les demandes.`}
            </p>
          )}

          <Notice tone="error">{error}</Notice>

          <button className="w-full rounded-full bg-[#ff6b4a] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#f05a39] disabled:opacity-60" disabled={saving} type="submit">
            {saving ? 'Enregistrement…' : duration === 'nouvel_ordre' ? 'Masquer le terrain' : 'Rendre indisponible'}
          </button>
        </form>
      </div>
    </div>
  )
}
