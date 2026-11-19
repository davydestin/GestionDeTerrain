import { useState } from 'react'
import PitchArt from '../../components/PitchArt.jsx'
import Icon from '../../components/Icon.jsx'

const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Disponibilité réelle du terrain (statut + fermeture en cours), renvoyée par l'API dans `disponibilite`. */
export function AvailabilityBadge({ terrain, className = '' }) {
  const etat = terrain.disponibilite?.etat || (terrain.statut === 'ACTIF' ? 'DISPONIBLE' : 'HORS_LIGNE')
  const styles = {
    DISPONIBLE: ['Disponible', 'bg-[#b6f23a] text-[#0b0f0c]', 'bg-[#0b0f0c]'],
    INDISPONIBLE: [
      `Indisponible jusqu’au ${terrain.disponibilite?.jusqu_au ? shortDate.format(new Date(terrain.disponibilite.jusqu_au)) : '…'}`,
      'bg-[#ff6b4a] text-white',
      'bg-white',
    ],
    HORS_LIGNE: ['Hors ligne · masqué', 'bg-[#0b0f0c]/85 text-[#cfd6c9] ring-1 ring-white/15', 'bg-[#88927f]'],
  }
  const [label, badgeClass, dotClass] = styles[etat]

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${badgeClass} ${className}`} title={terrain.disponibilite?.motif || undefined}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  )
}

export function Notice({ tone = 'success', children, onClose }) {
  if (!children) return null
  const styles = tone === 'error'
    ? 'border-[#ff6b4a]/30 bg-[#ff6b4a]/10 text-[#ff9b84]'
    : 'border-[#b6f23a]/30 bg-[#b6f23a]/10 text-[#d6f79a]'

  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-xs ${styles}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && (
        <button aria-label="Fermer" className="grid size-5 shrink-0 place-items-center rounded-full opacity-70 hover:bg-white/10 hover:opacity-100" onClick={onClose} type="button"><Icon className="size-3.5" name="close" /></button>
      )}
    </div>
  )
}

/**
 * Bouton d'action destructive en deux temps : un premier clic demande confirmation,
 * sans boîte de dialogue du navigateur.
 */
export function ConfirmButton({ children, confirmLabel = 'Confirmer', onConfirm, busy = false, className = '' }) {
  const [asking, setAsking] = useState(false)

  if (asking) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          className="rounded-full bg-[#ff6b4a] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
          disabled={busy}
          onClick={async () => {
            await onConfirm()
            setAsking(false)
          }}
          type="button"
        >
          {busy ? '…' : confirmLabel}
        </button>
        <button className="rounded-full px-2 py-1.5 text-[11px] font-semibold text-[#cfd6c9] hover:bg-white/10" onClick={() => setAsking(false)} type="button">
          Annuler
        </button>
      </span>
    )
  }

  return (
    <button
      className={`rounded-full border border-[#ff6b4a]/40 px-3 py-1.5 text-[11px] font-semibold text-[#ff9b84] hover:bg-[#ff6b4a]/10 ${className}`}
      onClick={() => setAsking(true)}
      type="button"
    >
      {children}
    </button>
  )
}

export function TerrainPhotoPlaceholder({ className = '' }) {
  return <PitchArt className={className} label="Aucune photo · ajoutez-en une" />
}
