import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { NEW_NOTIFICATIONS_EVENT } from '../../components/notificationEvents.js'
import { confirmReservation, getManagedReservations, refuseReservation } from '../../services/api.js'
import { formatPrice, readResponse } from './helpers.js'
import { Notice } from './ui.jsx'

const VUES = [
  { key: 'en_attente', label: 'À valider', counter: 'en_attente' },
  { key: 'a_venir', label: 'Confirmées à venir', counter: 'a_venir' },
  { key: 'historique', label: 'Historique', counter: null },
]

const STATUS_LABELS = {
  EN_ATTENTE: ['En attente', 'bg-[#ffb59f]/15 text-[#ffb59f]'],
  CONFIRMEE: ['Confirmée', 'bg-[#b6f23a]/15 text-[#d6f79a]'],
  REFUSEE: ['Refusée', 'bg-white/10 text-[#cfd6c9]'],
  ANNULEE: ['Annulée par le client', 'bg-white/10 text-[#cfd6c9]'],
  TERMINEE: ['Terminée', 'bg-white/10 text-[#cfd6c9]'],
}

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

function durationLabel(start, end) {
  const minutes = Math.round((new Date(end) - new Date(start)) / 60_000)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${hours ? `${hours} h` : ''}${rest ? ` ${rest} min` : ''}`.trim()
}

function WhatsAppIcon({ className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.1-1.3A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3 .8.8-2.95-.2-.3a8.2 8.2 0 1 1 6.9 3.78Zm4.5-6.15c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.55.12-.17.25-.64.8-.78.97-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-3.34-2.92c-.25-.43.25-.4.72-1.34.08-.16.04-.3-.02-.42-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.3 2.74 2.74 0 0 0-.86 2.04 4.76 4.76 0 0 0 1 2.53 10.9 10.9 0 0 0 4.18 3.7c1.56.67 2.17.73 2.95.61.48-.07 1.46-.6 1.67-1.17.2-.58.2-1.07.14-1.17-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  )
}

function ReservationCard({ reservation, index = 0, highlighted, onConfirm, onRefuse, busy }) {
  const [refusing, setRefusing] = useState(false)
  const [motif, setMotif] = useState('')
  const [label, style] = STATUS_LABELS[reservation.statut] || [reservation.statut, 'bg-white/10 text-[#cfd6c9]']
  const start = new Date(reservation.date_debut)
  const end = new Date(reservation.date_fin)
  const isPending = reservation.statut === 'EN_ATTENTE'
  const isConfirmed = reservation.statut === 'CONFIRMEE'

  return (
    <article
      className={`anim-fade-up rounded-2xl border p-4 transition sm:p-5 ${highlighted ? 'border-[#b6f23a]/60 bg-[#b6f23a]/[0.06]' : 'border-white/10 bg-white/[0.04]'}`}
      id={`reservation-${reservation.id}`}
      style={{ "--i": index }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-lg font-semibold capitalize text-[#f3f5ef]">{dayFormat.format(start)}</p>
          <p className="text-sm text-[#cfd6c9]">
            {timeFormat.format(start)} – {timeFormat.format(end)}
            <span className="text-[#88927f]"> · {durationLabel(start, end)} · {reservation.terrain?.nom}</span>
          </p>
        </div>
        <div className="flex w-full items-center justify-between gap-2 sm:block sm:w-auto sm:text-right">
          <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${style}`}>{label}</span>
          <p className="mt-1 font-heading text-base font-semibold text-[#b6f23a]">{formatPrice(reservation.montant_total)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-xs">
        <span className="font-semibold text-[#f3f5ef]">{reservation.client?.prenom} {reservation.client?.nom}</span>
        {reservation.telephone_whatsapp && <span className="text-[#a3ad9f]">WhatsApp : {reservation.telephone_whatsapp}</span>}
        <span className="text-[#88927f]">Demandé le {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(reservation.created_at))}</span>
      </div>
      {reservation.commentaire && (
        <p className="mt-2 rounded-xl bg-white/[0.04] px-3 py-2 text-xs italic text-[#cfd6c9]">« {reservation.commentaire} »</p>
      )}
      {reservation.statut === 'REFUSEE' && reservation.motif_refus && (
        <p className="mt-2 text-xs text-[#a3ad9f]">
          <span className="font-semibold text-[#ff9b84]">Motif du refus : </span>{reservation.motif_refus}
        </p>
      )}

      {isPending && !refusing && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-full bg-[#25d366] px-4 py-2 text-xs font-bold text-[#0b0f0c] hover:bg-[#1ebe5a] disabled:opacity-60"
            disabled={busy}
            onClick={() => onConfirm(reservation)}
            type="button"
          >
            <WhatsAppIcon />
            {busy ? 'Validation…' : 'Valider et écrire sur WhatsApp'}
          </button>
          <button className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-[#cfd6c9] hover:bg-white/10" disabled={busy} onClick={() => setRefusing(true)} type="button">
            Refuser
          </button>
        </div>
      )}

      {isPending && refusing && (
        <form
          className="mt-4 grid gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault()
            onRefuse(reservation, motif)
          }}
        >
          <label className="grid gap-1 text-[11px] font-semibold text-[#cfd6c9]">
            <span>Motif du refus <span className="font-normal text-[#88927f]">· facultatif, envoyé au client</span></span>
            <input autoFocus className="h-9 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm font-normal" maxLength={255} onChange={(event) => setMotif(event.target.value)} placeholder="Ex. : terrain réservé pour un tournoi" value={motif} />
          </label>
          <button className="h-9 rounded-full bg-[#ff6b4a] px-4 text-xs font-bold text-white disabled:opacity-60" disabled={busy} type="submit">
            {busy ? '…' : 'Refuser la demande'}
          </button>
          <button className="h-9 rounded-full px-3 text-xs font-semibold text-[#cfd6c9] hover:bg-white/10" onClick={() => setRefusing(false)} type="button">Annuler</button>
        </form>
      )}

      {isConfirmed && reservation.whatsapp_url && (
        <a
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#25d366]/50 px-4 py-2 text-xs font-bold text-[#7ee2a4] hover:bg-[#25d366]/10"
          href={reservation.whatsapp_url}
          rel="noreferrer"
          target="_blank"
        >
          <WhatsAppIcon />
          Discuter du paiement sur WhatsApp
        </a>
      )}
    </article>
  )
}

export default function ReservationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const vue = VUES.some((item) => item.key === searchParams.get('vue')) ? searchParams.get('vue') : 'en_attente'
  const highlightedId = Number(searchParams.get('reservation')) || null
  const [result, setResult] = useState({ vue: null, data: [], meta: null })
  const [compteurs, setCompteurs] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)
  // Rechargé aussi quand on arrive depuis une notification (paramètre « reservation » qui change).
  const requestKey = `${vue}|${reloadToken}|${highlightedId}`
  const loading = result.vue !== requestKey

  // Nouvelle notification reçue pendant qu'on est sur la page : la liste se met à jour toute seule.
  useEffect(() => {
    const onNewNotifications = () => setReloadToken((token) => token + 1)
    window.addEventListener(NEW_NOTIFICATIONS_EVENT, onNewNotifications)
    return () => window.removeEventListener(NEW_NOTIFICATIONS_EVENT, onNewNotifications)
  }, [])

  useEffect(() => {
    let active = true
    const key = `${vue}|${reloadToken}|${highlightedId}`

    getManagedReservations({ vue })
      .then(readResponse)
      .then((payload) => {
        if (!active) return
        setResult({ vue: key, data: payload.data || [], meta: payload.meta || null })
        setCompteurs(payload.compteurs || null)
      })
      .catch((requestError) => {
        if (!active) return
        setError(requestError.message)
        setResult({ vue: key, data: [], meta: null })
      })

    return () => {
      active = false
    }
  }, [vue, reloadToken, highlightedId])

  // Arrivée depuis une notification : on amène la demande concernée à l'écran.
  useEffect(() => {
    if (!highlightedId || loading) return
    document.getElementById(`reservation-${highlightedId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightedId, loading])

  function selectVue(key) {
    setSearchParams({ vue: key })
    setError('')
  }

  async function confirm(reservation) {
    // La fenêtre est ouverte dans le geste du clic (sinon le navigateur la bloque), puis dirigée vers WhatsApp.
    const whatsappWindow = window.open('', '_blank')
    setBusyId(reservation.id)
    setError('')
    setNotice(null)

    try {
      const payload = await readResponse(await confirmReservation(reservation.id))
      const url = payload.reservation.whatsapp_url

      if (url && whatsappWindow) {
        whatsappWindow.opener = null
        whatsappWindow.location.href = url
      } else {
        whatsappWindow?.close()
      }

      setNotice({
        text: `Réservation de ${reservation.client?.prenom || 'votre client'} confirmée. ${url ? (whatsappWindow ? 'WhatsApp s’est ouvert dans un nouvel onglet pour convenir du paiement.' : 'Votre navigateur a bloqué l’ouverture automatique :') : 'Le client n’a pas laissé de numéro WhatsApp valide.'}`,
        url: whatsappWindow ? null : url,
      })
      setReloadToken((token) => token + 1)
    } catch (requestError) {
      whatsappWindow?.close()
      setError(requestError.message)
      setReloadToken((token) => token + 1)
    } finally {
      setBusyId(null)
    }
  }

  async function refuse(reservation, motif) {
    setBusyId(reservation.id)
    setError('')
    setNotice(null)

    try {
      await readResponse(await refuseReservation(reservation.id, motif.trim()))
      setNotice({ text: `Demande de ${reservation.client?.prenom || 'votre client'} refusée. Le client a été prévenu.` })
      setReloadToken((token) => token + 1)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId(null)
    }
  }

  const reservations = result.data

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Espace gestionnaire</p>
        <h1 className="font-display text-3xl font-semibold uppercase text-[#f3f5ef] sm:text-4xl">Demandes de réservation</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#88927f]">
          Validez une demande puis convenez du paiement avec le client sur WhatsApp : aucun paiement ne passe par l’application.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-white/10" role="tablist" aria-label="Demandes de réservation">
        {VUES.map((item) => {
          const count = item.counter ? compteurs?.[item.counter] : null
          return (
            <button
              aria-selected={vue === item.key}
              className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${vue === item.key ? 'border-[#b6f23a] text-[#f3f5ef]' : 'border-transparent text-[#88927f] hover:text-[#cfd6c9]'}`}
              key={item.key}
              onClick={() => selectVue(item.key)}
              role="tab"
              type="button"
            >
              {item.label}
              {count > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${item.key === 'en_attente' ? 'bg-[#ff6b4a] text-white' : 'bg-white/10'}`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {notice && (
        <Notice onClose={() => setNotice(null)}>
          {notice.text}
          {notice.url && (
            <a className="ml-1 font-bold underline" href={notice.url} rel="noreferrer" target="_blank">Ouvrir WhatsApp</a>
          )}
        </Notice>
      )}
      <Notice tone="error">{error}</Notice>

      {loading && reservations.length === 0 ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map((index) => <div className="h-36 skeleton" key={index} />)}
        </div>
      ) : reservations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center">
          <p className="text-sm font-semibold text-[#f3f5ef]">
            {vue === 'en_attente' ? 'Aucune demande à valider' : vue === 'a_venir' ? 'Aucune réservation confirmée à venir' : 'Pas encore d’historique'}
          </p>
          <p className="mt-1 text-xs text-[#88927f]">
            {vue === 'en_attente'
              ? 'Vous recevrez une notification dès qu’un client demandera un créneau.'
              : <>Vérifiez que vos terrains ont des <Link className="text-[#b6f23a] hover:underline" to="/gestionnaire/terrains">horaires et sont disponibles</Link>.</>}
          </p>
        </div>
      ) : (
        <div className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          {reservations.map((reservation, index) => (
            <ReservationCard
              busy={busyId === reservation.id}
              index={index}
              highlighted={reservation.id === highlightedId}
              key={reservation.id}
              onConfirm={confirm}
              onRefuse={refuse}
              reservation={reservation}
            />
          ))}
          {result.meta?.last_page > 1 && (
            <p className="text-center text-[11px] text-[#88927f]">
              {result.meta.total} demandes au total — les 20 premières sont affichées.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
