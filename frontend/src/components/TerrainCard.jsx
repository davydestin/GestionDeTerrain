import { Link } from 'react-router-dom'

export default function TerrainCard({ terrain }) {
  const primaryImage = terrain.images?.find((image) => image.est_principale) || terrain.images?.[0]

  return (
    <article className="overflow-hidden border-b border-[#dfe3db] bg-[#fffefa] sm:grid sm:grid-cols-[200px_1fr]">
      <Link className="block aspect-[4/3] overflow-hidden bg-[#e6ebe3] sm:aspect-auto" to={`/terrains/${terrain.id}`}>
        {primaryImage ? (
          <img alt={terrain.nom} className="h-full w-full object-cover" loading="lazy" src={primaryImage.url} />
        ) : (
          <div className="grid h-full min-h-40 place-items-center text-xs font-semibold text-[#77817a]">Aucune photo</div>
        )}
      </Link>
      <div className="flex min-w-0 flex-col justify-between gap-5 p-4 sm:p-5">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link className="font-['Space_Grotesk'] text-lg font-semibold text-[#202b25] hover:text-[#2f7259]" to={`/terrains/${terrain.id}`}>
                {terrain.nom}
              </Link>
              <p className="mt-1 text-xs text-[#66736a]">
                {[terrain.quartier, terrain.commune?.nom, terrain.ville].filter(Boolean).join(' · ')}
              </p>
            </div>
            <p className="whitespace-nowrap text-sm font-bold text-[#2f7259]">
              {Number(terrain.tarif_horaire).toLocaleString('fr-FR')} FCFA <span className="text-[10px] font-medium text-[#77817a]">/ h</span>
            </p>
          </div>
          {terrain.description && <p className="mt-4 line-clamp-2 text-sm leading-5 text-[#56635a]">{terrain.description}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#66736a]">
          <span>{terrain.type} · {terrain.capacite} places</span>
          <Link className="font-bold text-[#2f7259] hover:underline" to={`/terrains/${terrain.id}`}>
            Voir le détail <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </article>
  )
}
