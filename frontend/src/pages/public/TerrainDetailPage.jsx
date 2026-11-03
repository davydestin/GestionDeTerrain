import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPublicTerrain } from '../../services/api.js'
import { useAuth } from '../../contextes/useAuth.js'
import ReservationForm from '../client/ReservationForm.jsx'

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.message || 'Impossible de charger ce terrain.')
  }

  return payload
}

export default function TerrainDetailPage() {
  const { terrainId } = useParams()
  const { user } = useAuth()
  const [terrain, setTerrain] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    getPublicTerrain(terrainId)
      .then(readResponse)
      .then((payload) => {
        if (active) setTerrain(payload.data)
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
  }, [terrainId])

  if (loading) {
    return <main className="mx-auto min-h-screen max-w-6xl px-5 py-12 text-sm text-[#77817a]">Chargement du terrain…</main>
  }

  if (error || !terrain) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-12">
        <p className="text-sm text-[#984b32]" role="alert">{error || 'Terrain introuvable.'}</p>
        <Link className="mt-4 inline-block text-sm font-bold text-[#2f7259]" to="/terrains">Retour aux terrains</Link>
      </main>
    )
  }

  const photos = terrain.images || []
  const mainPhoto = photos.find((photo) => photo.est_principale) || photos[0]

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8 text-[#202b25] sm:px-8">
      <Link className="text-xs font-bold text-[#2f7259] hover:underline" to="/terrains">← Tous les terrains</Link>
      <header className="mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-[#dfe3db] pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase text-[#2f7259]">{terrain.commune?.nom} · {terrain.quartier}</p>
          <h1 className="mt-1 font-['Space_Grotesk'] text-3xl font-semibold">{terrain.nom}</h1>
          <p className="mt-2 text-sm text-[#66736a]">{terrain.adresse}, {terrain.ville}</p>
        </div>
        <p className="text-lg font-bold text-[#2f7259]">
          {Number(terrain.tarif_horaire).toLocaleString('fr-FR')} FCFA <span className="text-xs font-medium text-[#77817a]">/ heure</span>
        </p>
      </header>

      <section className="mt-6 grid gap-3 md:grid-cols-[1.4fr_0.6fr]">
        <div className="overflow-hidden rounded-lg bg-[#e6ebe3]">
          {mainPhoto ? (
            <img alt={terrain.nom} className="aspect-[16/10] h-full w-full object-cover" src={mainPhoto.url} />
          ) : (
            <div className="grid aspect-[16/10] place-items-center text-sm text-[#77817a]">Aucune photo disponible</div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
          {photos.filter((photo) => photo.id !== mainPhoto?.id).slice(0, 2).map((photo) => (
            <img alt={`${terrain.nom} - photo`} className="aspect-[16/10] h-full w-full rounded-lg bg-[#e6ebe3] object-cover" key={photo.id} src={photo.url} />
          ))}
          <div className="flex flex-col justify-center rounded-lg border border-[#dfe3db] bg-[#fffefa] p-5">
            <span className="text-xs text-[#77817a]">Capacité</span>
            <strong className="mt-1 font-['Space_Grotesk'] text-xl">{terrain.capacite} places</strong>
            <span className="mt-4 text-xs text-[#77817a]">Type</span>
            <strong className="mt-1 text-sm">{terrain.type}</strong>
            {terrain.latitude && terrain.longitude && (
              <Link className="mt-5 text-xs font-bold text-[#2f7259] hover:underline" to={`/carte?terrain=${terrain.id}`}>
                Voir sur la carte →
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-8 border-b border-[#dfe3db] py-8 md:grid-cols-[1fr_300px]">
        <div>
          <h2 className="font-['Space_Grotesk'] text-xl font-semibold">À propos de ce terrain</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#56635a]">
            {terrain.description || 'Aucune description disponible.'}
          </p>
        </div>
        <aside className="h-fit rounded-lg border border-[#dfe3db] bg-[#fffefa] p-5">
          <p className="text-xs text-[#77817a]">Tarif horaire</p>
          <p className="mt-1 font-['Space_Grotesk'] text-2xl font-semibold text-[#2f7259]">
            {Number(terrain.tarif_horaire).toLocaleString('fr-FR')} FCFA
          </p>
          {user?.role === 'CLIENT' ? (
            <div className="mt-6 border-t border-[#e2e5de] pt-5">
              <ReservationForm terrain={terrain} />
            </div>
          ) : !user ? (
            <Link className="mt-5 inline-flex w-full justify-center rounded bg-[#2f7259] px-4 py-3 text-xs font-bold text-white hover:bg-[#255e48]" to="/connexion">
              Se connecter pour réserver
            </Link>
          ) : (
            <p className="mt-5 text-xs text-[#77817a]">La réservation est accessible aux comptes client.</p>
          )}
        </aside>
      </section>
    </main>
  )
}
