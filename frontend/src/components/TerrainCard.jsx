import { Link } from 'react-router-dom'
import PitchArt from './PitchArt.jsx'
import Icon from './Icon.jsx'

/** Carte d'un terrain dans la liste publique. `index` sert au décalage de l'animation d'apparition. */
export default function TerrainCard({ terrain, index = 0, basePath = '/terrains' }) {
  const primaryImage = terrain.images?.find((image) => image.est_principale) || terrain.images?.[0]
  const unavailable = terrain.disponibilite?.etat === 'INDISPONIBLE'

  return (
    <article
      className="anim-fade-up lift group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] sm:grid sm:grid-cols-[260px_1fr]"
      style={{ '--i': index }}
    >
      <Link className="relative block aspect-[16/10] overflow-hidden sm:aspect-auto sm:min-h-44" to={`${basePath}/${terrain.id}`}>
        {primaryImage ? (
          <img alt={terrain.nom} className="zoom-on-hover absolute inset-0 h-full w-full object-cover" loading="lazy" src={primaryImage.url} />
        ) : (
          <PitchArt className="absolute inset-0" label="Photo bientôt disponible" />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-[#0b0f0c]/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#b6f23a] backdrop-blur">
          {terrain.type}
        </span>
      </Link>

      <div className="flex min-w-0 flex-col justify-between gap-4 p-4 sm:p-5">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link className="font-heading text-lg font-semibold text-[#f3f5ef] transition-colors group-hover:text-[#b6f23a]" to={`${basePath}/${terrain.id}`}>
                {terrain.nom}
              </Link>
              <p className="mt-1 text-xs text-[#a3ad9f]">
                {[terrain.quartier, terrain.commune?.nom, terrain.ville].filter(Boolean).join(' · ')}
              </p>
            </div>
            <p className="whitespace-nowrap rounded-full bg-[#b6f23a] px-3 py-1 text-sm font-bold text-[#0b0f0c]">
              {Number(terrain.tarif_horaire).toLocaleString('fr-FR')} FCFA<span className="text-[10px] font-semibold text-[#0b0f0c]/60"> / h</span>
            </p>
          </div>
          {terrain.description && <p className="mt-3 line-clamp-2 text-sm leading-5 text-[#cfd6c9]">{terrain.description}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[#cfd6c9]">{terrain.capacite} joueurs</span>
            {unavailable && (
              <span className="rounded-full bg-[#ff6b4a]/15 px-2.5 py-1 font-semibold text-[#ffb59f]">Fermé temporairement</span>
            )}
          </div>
          <Link className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-bold text-[#f3f5ef] transition-colors hover:border-[#b6f23a] hover:text-[#b6f23a]" to={`${basePath}/${terrain.id}`}>
            Voir le terrain
            <span className="transition-transform group-hover:translate-x-0.5"><Icon className="size-3.5" name="arrow-right" /></span>
          </Link>
        </div>
      </div>
    </article>
  )
}
