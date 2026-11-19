import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contextes/useAuth.js'
import { createReservation, getTerrainAvailability, readJson } from '../../services/api.js'

function localDate(value) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const readResponse = (response) => readJson(response, 'Impossible de traiter la réservation.')

export default function ReservationForm({ terrain }) {
  const navigate = useNavigate()
  const [date, setDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return localDate(tomorrow)
  })
  const { user } = useAuth()
  // Le gestionnaire contactera le client sur ce numéro pour convenir du paiement (aucun paiement en ligne).
  const [whatsapp, setWhatsapp] = useState(user?.telephone || '')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [availabilityResult, setAvailabilityResult] = useState({ date: null, data: null, error: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const availability = availabilityResult.date === date ? availabilityResult.data : null
  const checking = availabilityResult.date !== date
  const error = availabilityResult.date === date ? availabilityResult.error : submitError

  useEffect(() => {
    let active = true

    getTerrainAvailability(terrain.id, date)
      .then(readResponse)
      .then((payload) => {
        if (active) setAvailabilityResult({ date, data: payload, error: '' })
      })
      .catch((requestError) => {
        if (active) setAvailabilityResult({ date, data: null, error: requestError.message })
      })

    return () => {
      active = false
    }
  }, [date, terrain.id])

  const conflict = useMemo(() => {
    if (!availability || !startTime || !endTime || endTime <= startTime) return false

    const start = new Date(`${date}T${startTime}:00`)
    const end = new Date(`${date}T${endTime}:00`)
    const periods = [
      ...(availability.reservations || []),
      ...(availability.indisponibilites || []),
    ]

    return periods.some((period) => (
      start < new Date(period.date_fin) && end > new Date(period.date_debut)
    ))
  }, [availability, date, endTime, startTime])

  const insideOpeningHours = availability?.ouvert
    && startTime >= availability.horaire.heure_ouverture.slice(0, 5)
    && endTime <= availability.horaire.heure_fermeture.slice(0, 5)

  const estimatedAmount = useMemo(() => {
    if (!startTime || !endTime || endTime <= startTime) return 0
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    const durationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute)

    return Math.round(Number(terrain.tarif_horaire) * durationMinutes / 60)
  }, [endTime, startTime, terrain.tarif_horaire])

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError('')

    try {
      await readResponse(await createReservation({
        terrain_id: terrain.id,
        date_debut: `${date} ${startTime}:00`,
        date_fin: `${date} ${endTime}:00`,
        telephone_whatsapp: whatsapp.trim(),
      }))
      navigate('/client/reservations', {
        state: { notice: 'Demande envoyée ! Le gestionnaire va la valider puis vous écrire sur WhatsApp pour le paiement.' },
      })
    } catch (requestError) {
      setSubmitError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = availability?.ouvert && insideOpeningHours && !conflict && endTime > startTime && whatsapp.trim().length >= 9

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <p className="text-xs text-[#88927f]">Réserver ce terrain</p>
        <p className="mt-1 font-heading text-xl font-semibold text-[#b6f23a]">
          {estimatedAmount.toLocaleString('fr-FR')} FCFA
        </p>
        <p className="text-[10px] text-[#88927f]">Estimation · aucun paiement en ligne : vous réglez directement avec le gestionnaire.</p>
      </div>

      <label className="grid gap-1 text-[10px] font-bold text-[#cfd6c9]">
        Date
        <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-normal text-white placeholder:text-white/30" min={localDate(new Date())} onChange={(event) => setDate(event.target.value)} required type="date" value={date} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-[10px] font-bold text-[#cfd6c9]">
          De
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-normal text-white placeholder:text-white/30" onChange={(event) => setStartTime(event.target.value)} required type="time" value={startTime} />
        </label>
        <label className="grid gap-1 text-[10px] font-bold text-[#cfd6c9]">
          À
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-normal text-white placeholder:text-white/30" onChange={(event) => setEndTime(event.target.value)} required type="time" value={endTime} />
        </label>
      </div>

      <label className="grid gap-1 text-[10px] font-bold text-[#cfd6c9]">
        Votre numéro WhatsApp
        <input
          autoComplete="tel"
          className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-normal text-white placeholder:text-white/30"
          inputMode="tel"
          maxLength={25}
          onChange={(event) => setWhatsapp(event.target.value)}
          placeholder="77 123 45 67"
          required
          type="tel"
          value={whatsapp}
        />
        <span className="font-normal text-[#88927f]">Le gestionnaire vous y contactera pour convenir du paiement.</span>
      </label>

      {checking && <p className="text-xs text-[#88927f]">Vérification des disponibilités…</p>}
      {!checking && availability && (
        <p className={`text-xs ${canSubmit ? 'text-[#b6f23a]' : 'text-[#ff9b84]'}`}>
          {!availability.ouvert
            ? 'Le terrain est fermé ce jour-là.'
            : !insideOpeningHours
              ? `Ouverture ${availability.horaire.heure_ouverture.slice(0, 5)} – ${availability.horaire.heure_fermeture.slice(0, 5)}`
              : conflict
                ? 'Ce créneau chevauche une réservation ou une indisponibilité.'
                : 'Créneau disponible, sous réserve de confirmation.'}
        </p>
      )}
      {error && <p className="text-xs text-[#ff9b84]" role="alert">{error}</p>}

      <button className="w-full rounded-full bg-[#b6f23a] px-4 py-3 text-xs font-bold text-[#0b0f0c] hover:bg-[#9ad92a] disabled:cursor-not-allowed disabled:opacity-50" disabled={checking || submitting || !canSubmit} type="submit">
        {submitting ? 'Envoi…' : 'Demander la réservation'}
      </button>
    </form>
  )
}
