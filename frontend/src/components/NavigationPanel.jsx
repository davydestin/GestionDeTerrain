import { formatDistance, formatDuration } from '../services/geo.js'
import { googleMapsDirectionsUrl } from '../services/routingService.js'
import Icon from './Icon.jsx'

const STATUS_TEXT = {
  localisation: 'Recherche de votre position…',
  calcul: 'Calcul de l’itinéraire…',
  recalcul: 'Vous avez quitté le tracé : recalcul de l’itinéraire…',
  apercu: 'Itinéraire prêt.',
  guidage: 'Guidage en cours : la carte suit votre position.',
  arrive: 'Vous êtes arrivé au terrain.',
}

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

/** Panneau de l'itinéraire guidé (au-dessus de la carte). */
export default function NavigationPanel({ navigation, progress, follow, userPosition, onBegin, onStop, onRecenter, onMode, onRetry }) {
  const { terrain, status, mode, error } = navigation
  const busy = ['localisation', 'calcul', 'recalcul'].includes(status)
  const arrived = status === 'arrive'
  const mapsUrl = googleMapsDirectionsUrl(navigation.destination, mode, userPosition)

  return (
    <section
      aria-label={`Itinéraire vers ${terrain.nom}`}
      aria-live="polite"
      className={`anim-fade-up mb-4 rounded-3xl border p-4 sm:p-5 ${arrived ? 'border-[#b6f23a]/50 bg-[#b6f23a]/10' : 'border-[#ff6b4a]/30 bg-[#ff6b4a]/[0.07]'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#ff9b84]">Itinéraire</p>
          <h2 className="truncate font-heading text-lg font-semibold">{terrain.nom}</h2>
          <p className="text-xs text-[#a3ad9f]">{[terrain.quartier, terrain.commune?.nom].filter(Boolean).join(' · ')}</p>
        </div>

        <div className="flex rounded-full border border-white/10 bg-[#0b0f0c]/60 p-1" role="group" aria-label="Mode de déplacement">
          {[['voiture', 'En voiture'], ['pied', 'À pied']].map(([value, label]) => (
            <button
              aria-pressed={mode === value}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${mode === value ? 'bg-[#f3f5ef] text-[#0b0f0c]' : 'text-[#cfd6c9] hover:bg-white/10'}`}
              disabled={busy}
              key={value}
              onClick={() => onMode(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {progress && !arrived && (
        <dl className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-[#0b0f0c]/50 px-3 py-2.5">
            <dt className="text-[11px] text-[#88927f]">Distance</dt>
            <dd className="font-heading text-xl font-semibold tabular-nums">{formatDistance(progress.remaining.distance)}</dd>
          </div>
          <div className="rounded-2xl bg-[#0b0f0c]/50 px-3 py-2.5">
            <dt className="text-[11px] text-[#88927f]">Temps</dt>
            <dd className="font-heading text-xl font-semibold tabular-nums">{formatDuration(progress.seconds)}</dd>
          </div>
          <div className="rounded-2xl bg-[#0b0f0c]/50 px-3 py-2.5">
            <dt className="text-[11px] text-[#88927f]">Arrivée</dt>
            <dd className="font-heading text-xl font-semibold tabular-nums">{timeFormat.format(progress.arrival)}</dd>
          </div>
        </dl>
      )}

      <p className={`mt-3 flex items-center gap-2 text-xs ${status === 'erreur' ? 'text-[#ff9b84]' : arrived ? 'font-semibold text-[#d6f79a]' : 'text-[#cfd6c9]'}`} role={status === 'erreur' ? 'alert' : undefined}>
        {busy && <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-[#ff9b84]" />}
        {arrived && <Icon className="size-4" name="check" />}
        {status === 'erreur' ? error : STATUS_TEXT[status]}
        {userPosition?.accuracy > 60 && !arrived && status !== 'erreur' && (
          <span className="text-[#88927f]">· précision GPS ≈ {Math.round(userPosition.accuracy)} m</span>
        )}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {status === 'apercu' && (
          <button className="inline-flex items-center gap-1.5 rounded-full bg-[#ff6b4a] px-4 py-2 text-xs font-bold text-white hover:bg-[#f05a39]" onClick={onBegin} type="button">
            <Icon className="size-4" name="locate" />
            Démarrer le guidage
          </button>
        )}
        {status === 'guidage' && !follow && (
          <button className="inline-flex items-center gap-1.5 rounded-full bg-[#3788ff] px-4 py-2 text-xs font-bold text-white hover:bg-[#2a74e0]" onClick={onRecenter} type="button">
            <Icon className="size-4" name="locate" />
            Recentrer sur moi
          </button>
        )}
        {status === 'erreur' && (
          <button className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold hover:bg-white/10" onClick={onRetry} type="button">
            Réessayer
          </button>
        )}
        <a
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-[#f3f5ef] hover:border-[#b6f23a] hover:text-[#b6f23a]"
          href={mapsUrl}
          rel="noreferrer"
          target="_blank"
        >
          Ouvrir dans Google Maps
          <Icon className="size-3.5" name="arrow-up-right" />
        </a>
        <button className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-[#cfd6c9] hover:bg-white/10" onClick={onStop} type="button">
          <Icon className="size-3.5" name="close" />
          {arrived ? 'Fermer' : 'Arrêter'}
        </button>
      </div>
    </section>
  )
}
