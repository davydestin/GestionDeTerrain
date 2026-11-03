import { useEffect, useState } from 'react'
import { cancelReservation, createPayment, roleData } from '../../services/api.js'

const methods = [
  ['WAVE', 'Wave'],
  ['ORANGE_MONEY', 'Orange Money'],
  ['FREE_MONEY', 'Free Money'],
  ['ESPECES', 'Espèces'],
  ['CARTE', 'Carte'],
]

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const validationMessage = Object.values(payload.errors || {}).flat()[0]
    throw new Error(validationMessage || payload.message || 'Une erreur est survenue.')
  }

  return payload
}

function formatDate(value) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function ClientReservationsPage() {
  const [reservations, setReservations] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentForms, setPaymentForms] = useState({})
  const [busyReservationId, setBusyReservationId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

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

  function updatePaymentForm(reservationId, field, value) {
    setPaymentForms((current) => ({
      ...current,
      [reservationId]: { method: 'WAVE', reference: '', ...current[reservationId], [field]: value },
    }))
  }

  async function submitPayment(event, reservation) {
    event.preventDefault()
    const form = paymentForms[reservation.id] || { method: 'WAVE', reference: '' }
    setBusyReservationId(reservation.id)
    setError('')
    setNotice('')

    try {
      const payload = await readResponse(await createPayment(reservation.id, {
        methode: form.method,
        reference_transaction: form.method === 'ESPECES' ? null : form.reference,
      }))
      setReservations((current) => current.map((item) => (
        item.id === reservation.id
          ? { ...item, paiements: [payload.paiement, ...(item.paiements || [])] }
          : item
      )))
      setNotice('Tentative de paiement enregistrée. Elle sera confirmée après vérification.')
      setPaymentForms((current) => ({ ...current, [reservation.id]: { method: 'WAVE', reference: '' } }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyReservationId(null)
    }
  }

  async function handleCancel(reservation) {
    if (!window.confirm('Annuler cette réservation ?')) return

    setBusyReservationId(reservation.id)
    setError('')
    setNotice('')

    try {
      const payload = await readResponse(await cancelReservation(reservation.id))
      setReservations((current) => current.map((item) => (
        item.id === reservation.id ? payload.reservation : item
      )))
      setNotice('Réservation annulée.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyReservationId(null)
    }
  }

  const visibleReservations = statusFilter
    ? reservations.filter((reservation) => reservation.statut === statusFilter)
    : reservations

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase text-[#2f7259]">Espace client</p>
          <h1 className="mt-1 font-['Space_Grotesk'] text-2xl font-semibold text-[#202b25]">Mes réservations</h1>
        </div>
        <label className="grid gap-1 text-[10px] font-bold text-[#56635a]">
          Historique par statut
          <select className="h-10 min-w-48 rounded border border-[#dce1d9] bg-[#fffefa] px-3 text-xs font-normal" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option value="">Toutes</option>
            {['EN_ATTENTE', 'CONFIRMEE', 'ANNULEE', 'REFUSEE', 'TERMINEE'].map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="rounded border border-[#f0c5b3] bg-[#fff5f0] px-3 py-2 text-sm text-[#984b32]" role="alert">{error}</p>}
      {notice && <p className="rounded border border-[#c6dfcc] bg-[#edf6ef] px-3 py-2 text-sm text-[#286348]" role="status">{notice}</p>}

      {loading ? (
        <p className="border-y border-[#e2e5de] py-8 text-sm text-[#77817a]">Chargement des réservations…</p>
      ) : visibleReservations.length === 0 ? (
        <p className="border-y border-[#e2e5de] py-8 text-sm text-[#77817a]">Aucune réservation pour ce filtre.</p>
      ) : (
        <div className="divide-y divide-[#e2e5de] border-y border-[#e2e5de]">
          {visibleReservations.map((reservation) => {
            const payments = reservation.paiements || []
            const isPaid = payments.some((payment) => payment.statut === 'PAYE')
            const canPay = ['EN_ATTENTE', 'CONFIRMEE'].includes(reservation.statut) && !isPaid
            const canCancel = ['EN_ATTENTE', 'CONFIRMEE'].includes(reservation.statut)
            const form = paymentForms[reservation.id] || { method: 'WAVE', reference: '' }

            return (
              <article className="grid gap-4 bg-[#fffefa] px-3 py-5 sm:px-5 lg:grid-cols-[1fr_auto]" key={reservation.id}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#77817a]">Terrain</p>
                    <h2 className="mt-1 font-['Space_Grotesk'] text-lg font-semibold">{reservation.terrain?.nom || 'Terrain'}</h2>
                    <p className="mt-1 text-xs text-[#66736a]">{reservation.terrain?.ville || 'Dakar'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><span className="block text-[#77817a]">Début</span><strong className="mt-1 block">{formatDate(reservation.date_debut)}</strong></div>
                    <div><span className="block text-[#77817a]">Fin</span><strong className="mt-1 block">{formatDate(reservation.date_fin)}</strong></div>
                    <div><span className="block text-[#77817a]">Réservation</span><strong className="mt-1 block">{reservation.statut}</strong></div>
                    <div><span className="block text-[#77817a]">Montant total</span><strong className="mt-1 block">{Number(reservation.montant_total).toLocaleString('fr-FR')} FCFA</strong></div>
                  </div>
                  {payments.length > 0 && (
                    <div className="sm:col-span-2">
                      <p className="text-[10px] font-bold uppercase text-[#77817a]">Paiements</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {payments.map((payment) => (
                          <span className="rounded bg-[#f1f2eb] px-2.5 py-1.5 text-[11px] text-[#56635a]" key={payment.id}>
                            {payment.methode} · {payment.statut} · {Number(payment.montant).toLocaleString('fr-FR')} FCFA
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-center gap-3 lg:w-64">
                  {canPay && (
                    <form className="grid gap-2" onSubmit={(event) => submitPayment(event, reservation)}>
                      <label className="grid gap-1 text-[10px] font-bold text-[#56635a]">
                        Méthode de paiement
                        <select className="h-9 rounded border border-[#dce1d9] bg-white px-2 text-xs font-normal" onChange={(event) => updatePaymentForm(reservation.id, 'method', event.target.value)} value={form.method}>
                          {methods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      {form.method !== 'ESPECES' && (
                        <input
                          className="h-9 rounded border border-[#dce1d9] bg-white px-2 text-xs"
                          onChange={(event) => updatePaymentForm(reservation.id, 'reference', event.target.value)}
                          placeholder="Référence de transaction"
                          required
                          value={form.reference}
                        />
                      )}
                      <button className="rounded bg-[#2f7259] px-3 py-2 text-xs font-bold text-white disabled:opacity-60" disabled={busyReservationId === reservation.id} type="submit">
                        {busyReservationId === reservation.id ? 'Envoi…' : 'Enregistrer un paiement'}
                      </button>
                    </form>
                  )}
                  {canCancel && (
                    <button className="rounded border border-[#e6c6ba] px-3 py-2 text-xs font-bold text-[#984b32] hover:bg-[#fff5f0] disabled:opacity-60" disabled={busyReservationId === reservation.id} onClick={() => handleCancel(reservation)} type="button">
                      Annuler la réservation
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
