import { Link } from 'react-router-dom'

export default function TerrainCard({ terrain }) {
  const primaryImage = terrain.images?.find((image) => image.est_principale) || terrain.images?.[0]

  return (
    <article className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] transition-shadow hover:shadow-[0_18px_50px_-24px_#b6f23a66] sm:grid sm:grid-cols-[240px_1fr]">
      <Link className="block aspect-[4/3] overflow-hidden bg-white/10 sm:aspect-auto" to={`/terrains/${terrain.id}`}>
        {primaryImage ? (
          <img alt={terrain.nom} className="h-full w-full object-cover" loading="lazy" src={primaryImage.url} />
        ) : (
          <div className="grid h-full min-h-40 place-items-center text-xs font-semibold text-[#88927f]">Aucune photo</div>
        )}
      </Link>
      <div className="flex min-w-0 flex-col justify-between gap-5 p-4 sm:p-5">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link className="font-heading text-lg font-semibold text-[#f3f5ef] hover:text-[#b6f23a]" to={`/terrains/${terrain.id}`}>
                {terrain.nom}
              </Link>
              <p className="mt-1 text-xs text-[#a3ad9f]">
                {[terrain.quartier, terrain.commune?.nom, terrain.ville].filter(Boolean).join(' · ')}
              </p>
            </div>
            <p className="whitespace-nowrap rounded-full bg-[#c8f542] px-3 py-1 text-sm font-bold text-[#f3f5ef]">
              {Number(terrain.tarif_horaire).toLocaleString('fr-FR')} FCFA <span className="text-[10px] font-medium text-[#88927f]">/ h</span>
            </p>
          </div>
          {terrain.description && <p className="mt-4 line-clamp-2 text-sm leading-5 text-[#cfd6c9]">{terrain.description}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#a3ad9f]">
          <span>{terrain.type} · {terrain.capacite} places</span>
          <Link className="font-bold text-[#b6f23a] hover:underline" to={`/terrains/${terrain.id}`}>
            Voir le détail <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </article>
  )
}
