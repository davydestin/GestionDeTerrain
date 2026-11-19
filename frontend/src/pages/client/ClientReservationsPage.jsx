import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cancelReservation, readJson, roleData } from '../../services/api.js'
import Icon from '../../components/Icon.jsx'

const readResponse = (response) => readJson(response)

// Ce que chaque statut signifie pour le client (le paiement se règle sur WhatsApp, hors application).
const STATUSES = {
  EN_ATTENTE: {
    label: 'En attente de validation',
    style: 'bg-[#ffb59f]/15 text-[#ffb59f]',
    help: 'Le gestionnaire doit valider votre demande. Vous serez notifié dès qu’il l’aura traitée.',
  },
  CONFIRMEE: {
    label: 'Confirmée',
    style: 'bg-[#b6f23a]/15 text-[#d6f79a]',
    help: 'Le gestionnaire vous contacte sur WhatsApp pour convenir du paiement.',
  },
  REFUSEE: { label: 'Refusée', style: 'bg-white/10 text-[#cfd6c9]', help: 'Le gestionnaire n’a pas pu accepter ce créneau. Essayez un autre horaire.' },
  ANNULEE: { label: 'Annulée', style: 'bg-white/10 text-[#cfd6c9]', help: null },
  TERMINEE: { label: 'Terminée', style: 'bg-white/10 text-[#cfd6c9]', help: null },
}

const FILTERS = [
  { value: '', label: 'Toutes' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'CONFIRMEE', label: 'Confirmées' },
  { value: 'PASSEES', label: 'Passées et annulées' },
]

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

function matchesFilter(reservation, filter) {
  if (!filter) return true
  if (filter === 'PASSEES') return !['EN_ATTENTE', 'CONFIRMEE'].includes(reservation.statut) || new Date(reservation.date_fin) < new Date()
  return reservation.statut === filter && new Date(reservation.date_fin) >= new Date()
}

export default function ClientReservationsPage() {
  const location = useLocation()
  const [reservations, setReservations] = useState([])
  const [filter, setFilter] = useState('')
  const [askingCancelId, setAskingCancelId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(location.state?.notice || '')

  useEffect(() => {
    let active = true

    roleData('CLIENT')
      .then(readResponse)
      .then((payload) => {
        if (active) setReservations(payload.reservations || [])
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  async function cancel(reservation) {
    setBusyId(reservation.id)
    setError('')
    setNotice('')

    try {
      const payload = await readResponse(await cancelReservation(reservation.id))
      setReservations((current) => current.map((item) => (
        item.id === reservation.id ? { ...item, statut: payload.reservation.statut } : item
      )))
      setNotice('Réservation annulée. Le gestionnaire a été prévenu.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId(null)
      setAskingCancelId(null)
    }
  }

  const visible = reservations.filter((reservation) => matchesFilter(reservation, filter))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Espace client</p>
          <h1 className="font-display text-3xl font-semibold uppercase text-[#f3f5ef] sm:text-4xl">Mes réservations</h1>
        </div>
        <Link className="rounded-full bg-[#b6f23a] px-5 py-2.5 text-xs font-bold text-[#0b0f0c] hover:bg-[#9ad92a]" to="/client/terrains">
          Réserver un terrain
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 sm:w-fit" role="group" aria-label="Filtrer les réservations">
        {FILTERS.map((item) => (
          <button
            aria-pressed={filter === item.value}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${filter === item.value ? 'bg-[#b6f23a] text-[#0b0f0c]' : 'text-[#cfd6c9] hover:bg-white/10'}`}
            key={item.value || 'toutes'}
            onClick={() => setFilter(item.value)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {notice && (
        <p className="flex items-start justify-between gap-3 rounded-xl border border-[#b6f23a]/30 bg-[#b6f23a]/10 px-3 py-2 text-sm text-[#d6f79a]" role="status">
          {notice}
          <button aria-label="Fermer" className="grid size-5 shrink-0 place-items-center rounded-full opacity-70 hover:bg-white/10 hover:opacity-100" onClick={() => setNotice('')} type="button"><Icon className="size-3.5" name="close" /></button>
        </p>
      )}
      {error && <p className="rounded-xl border border-[#ff6b4a]/30 bg-[#ff6b4a]/10 px-3 py-2 text-sm text-[#ff9b84]" role="alert">{error}</p>}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map((index) => <div className="h-32 skeleton" key={index} />)}
        </div>
      ) : reservations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center">
          <p className="text-sm font-semibold text-[#f3f5ef]">Vous n’avez pas encore réservé de terrain</p>
          <p className="mt-1 text-xs text-[#88927f]">Choisissez un terrain, un créneau, et le gestionnaire vous recontacte sur WhatsApp.</p>
          <Link className="mt-4 inline-block rounded-full bg-[#b6f23a] px-5 py-2.5 text-xs font-bold text-[#0b0f0c]" to="/client/terrains">Voir les terrains</Link>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-white/10 px-6 py-8 text-center text-sm text-[#88927f]">Aucune réservation pour ce filtre.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((reservation, index) => {
            const status = STATUSES[reservation.statut] || { label: reservation.statut, style: 'bg-white/10 text-[#cfd6c9]' }
            const start = new Date(reservation.date_debut)
            const end = new Date(reservation.date_fin)
            const upcoming = end >= new Date()
            const canCancel = upcoming && ['EN_ATTENTE', 'CONFIRMEE'].includes(reservation.statut)
            const terrain = reservation.terrain

            return (
              <li className="anim-fade-up rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5" key={reservation.id} style={{ "--i": index }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link className="font-heading text-lg font-semibold text-[#f3f5ef] hover:text-[#b6f23a]" to={`/client/terrains/${terrain?.id}`}>
                      {terrain?.nom || 'Terrain'}
                    </Link>
                    <p className="text-xs text-[#88927f]">{[terrain?.quartier, terrain?.commune?.nom, terrain?.ville].filter(Boolean).join(' · ')}</p>
                    <p className="mt-2 text-sm capitalize text-[#cfd6c9]">
                      {dayFormat.format(start)} · {timeFormat.format(start)} – {timeFormat.format(end)}
                    </p>
                  </div>
                  <div className="flex w-full items-center justify-between gap-2 sm:block sm:w-auto sm:text-right">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${status.style}`}>{status.label}</span>
                    <p className="mt-1 font-heading text-base font-semibold text-[#b6f23a]">{Number(reservation.montant_total).toLocaleString('fr-FR')} FCFA</p>
                  </div>
                </div>

                {upcoming && status.help && (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-[#cfd6c9]">
                    <span aria-hidden="true" className={`mt-1 size-1.5 shrink-0 rounded-full ${reservation.statut === 'CONFIRMEE' ? 'bg-[#25d366]' : 'bg-[#ffb59f]'}`} />
                    <span>
                      {status.help}
                      {reservation.statut === 'CONFIRMEE' && reservation.telephone_whatsapp && ` (numéro indiqué : +${reservation.telephone_whatsapp})`}
                    </span>
                  </p>
                )}

                {reservation.statut === 'REFUSEE' && (
                  <div className="mt-3 rounded-xl border border-[#ff6b4a]/25 bg-[#ff6b4a]/[0.07] px-3 py-2 text-xs">
                    <p className="font-semibold text-[#ff9b84]">Motif du refus</p>
                    <p className="mt-0.5 text-[#cfd6c9] [overflow-wrap:anywhere]">
                      {reservation.motif_refus || 'Le gestionnaire n’a pas précisé de motif.'}
                    </p>
                  </div>
                )}

                {canCancel && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {askingCancelId === reservation.id ? (
                      <>
                        <span className="text-xs text-[#cfd6c9]">Annuler cette réservation ?</span>
                        <button className="rounded-full bg-[#ff6b4a] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60" disabled={busyId === reservation.id} onClick={() => cancel(reservation)} type="button">
                          {busyId === reservation.id ? '…' : 'Oui, annuler'}
                        </button>
                        <button className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-[#cfd6c9] hover:bg-white/10" onClick={() => setAskingCancelId(null)} type="button">Non</button>
                      </>
                    ) : (
                      <button className="rounded-full border border-[#ff6b4a]/40 px-3 py-1.5 text-[11px] font-semibold text-[#ff9b84] hover:bg-[#ff6b4a]/10" onClick={() => setAskingCancelId(reservation.id)} type="button">
                        Annuler la réservation
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
