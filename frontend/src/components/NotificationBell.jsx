import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contextes/useAuth.js'
import { getNotifications, markAllNotificationsRead, markNotificationRead, readJson } from '../services/api.js'
import { NEW_NOTIFICATIONS_EVENT } from './notificationEvents.js'
import Icon from './Icon.jsx'

const POLL_INTERVAL_MS = 20_000
const TOAST_DURATION_MS = 7000

function timeAgo(value) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(value))
}

// Où mène une notification selon le rôle de la personne connectée.
function targetFor(role, notification) {
  if (role === 'GESTIONNAIRE') {
    const vue = /demande/i.test(notification.titre) ? 'en_attente' : 'historique'
    return `/gestionnaire/reservations?vue=${vue}${notification.reservation_id ? `&reservation=${notification.reservation_id}` : ''}`
  }

  return role === 'CLIENT' ? '/client/reservations' : null
}

/**
 * Cloche de notifications : interroge l'API régulièrement (et au retour sur l'onglet),
 * affiche le nombre de non lues, un aperçu au clic et un toast à l'arrivée d'une nouvelle notification.
 */
export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const knownIds = useRef(null)
  const panelRef = useRef(null)

  const refresh = useCallback(async () => {
    try {
      const payload = await readJson(await getNotifications())
      const list = payload.notifications || []
      setNotifications(list)
      setUnread(payload.non_lues || 0)

      // Toast uniquement pour ce qui arrive après le premier chargement ; les pages concernées
      // (ex. « Demandes ») écoutent l'événement pour se rafraîchir sans rechargement.
      if (knownIds.current) {
        const freshItems = list.filter((item) => !item.lu && !knownIds.current.has(item.id))
        if (freshItems.length > 0) {
          setToast(freshItems[0])
          window.dispatchEvent(new CustomEvent(NEW_NOTIFICATIONS_EVENT, { detail: freshItems }))
        }
      }
      knownIds.current = new Set(list.map((item) => item.id))
    } catch {
      // Silencieux : la cloche ne doit jamais gêner la page ; nouvel essai au prochain cycle.
    }
  }, [])

  useEffect(() => {
    const first = setTimeout(refresh, 0)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, POLL_INTERVAL_MS)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(first)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast])

  // Le nombre de non lues apparaît aussi dans l'onglet du navigateur.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '')
    document.title = unread > 0 ? `(${unread}) ${base}` : base
  }, [unread])

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (event.key === 'Escape' || (event.type === 'mousedown' && !panelRef.current?.contains(event.target))) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  async function openNotification(notification) {
    setOpen(false)
    setToast(null)

    if (!notification.lu) {
      setNotifications((current) => current.map((item) => (item.id === notification.id ? { ...item, lu: true } : item)))
      setUnread((count) => Math.max(0, count - 1))
      markNotificationRead(notification.id).catch(() => {})
    }

    const target = targetFor(user.role, notification)
    if (target) navigate(target)
  }

  async function markAll() {
    setNotifications((current) => current.map((item) => ({ ...item, lu: true })))
    setUnread(0)
    await markAllNotificationsRead().catch(() => {})
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications : ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}
        className="relative grid size-9 place-items-center rounded-full border border-white/10 text-[#cfd6c9] hover:bg-white/10"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Icon className="size-4" name="bell" />
        {unread > 0 && (
          <span key={unread} className="anim-badge absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff6b4a] px-1 text-[10px] font-bold text-white tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="anim-pop absolute right-0 top-11 z-[1200] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#11160f] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold text-[#f3f5ef]">Notifications</p>
            {unread > 0 && (
              <button className="text-[11px] font-semibold text-[#b6f23a] hover:underline" onClick={markAll} type="button">Tout marquer comme lu</button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-[#88927f]">Aucune notification pour l’instant.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-white/[0.06] ${notification.lu ? '' : 'bg-[#b6f23a]/[0.05]'}`}
                    onClick={() => openNotification(notification)}
                    type="button"
                  >
                    <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.lu ? 'bg-transparent' : 'bg-[#b6f23a]'}`} />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-[#f3f5ef]">{notification.titre}</span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-[#a3ad9f]">{notification.message}</span>
                      <span className="mt-1 block text-[10px] text-[#88927f]">{timeAgo(notification.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {toast && (
        <div key={toast.id} className="anim-toast fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-4 z-[1300] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[#b6f23a]/30 bg-[#11160f] p-4 shadow-2xl" role="status">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full bg-[#b6f23a]" />
            <button className="min-w-0 text-left" onClick={() => openNotification(toast)} type="button">
              <span className="block text-sm font-semibold text-[#f3f5ef]">{toast.titre}</span>
              <span className="mt-0.5 block text-xs text-[#cfd6c9]">{toast.message}</span>
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#b6f23a]">Voir <Icon className="size-3.5" name="arrow-right" /></span>
            </button>
            <button aria-label="Fermer" className="ml-auto grid size-6 shrink-0 place-items-center rounded-full text-[#88927f] hover:bg-white/10 hover:text-white" onClick={() => setToast(null)} type="button"><Icon className="size-3.5" name="close" /></button>
          </div>
        </div>
      )}
    </div>
  )
}
