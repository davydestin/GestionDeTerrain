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
    return <main className="mx-auto min-h-screen max-w-6xl px-5 py-12 text-sm text-[#88927f]">Chargement du terrain…</main>
  }

  if (error || !terrain) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-12">
        <p className="text-sm text-[#ff9b84]" role="alert">{error || 'Terrain introuvable.'}</p>
        <Link className="mt-4 inline-block text-sm font-bold text-[#b6f23a]" to="/terrains">Retour aux terrains</Link>
      </main>
    )
  }

  const photos = terrain.images || []
  const mainPhoto = photos.find((photo) => photo.est_principale) || photos[0]

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8 text-[#f3f5ef] sm:px-8">
      <Link className="text-xs font-bold text-[#b6f23a] hover:underline" to="/terrains">← Tous les terrains</Link>
      <header className="mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase text-[#b6f23a]">{terrain.commune?.nom} · {terrain.quartier}</p>
          <h1 className="mt-1 font-heading text-3xl font-semibold">{terrain.nom}</h1>
          <p className="mt-2 text-sm text-[#a3ad9f]">{terrain.adresse}, {terrain.ville}</p>
        </div>
        <p className="text-lg font-bold text-[#b6f23a]">
          {Number(terrain.tarif_horaire).toLocaleString('fr-FR')} FCFA <span className="text-xs font-medium text-[#88927f]">/ heure</span>
        </p>
      </header>

      <section className="mt-6 grid gap-3 md:grid-cols-[1.4fr_0.6fr]">
        <div className="overflow-hidden rounded-lg bg-white/10">
          {mainPhoto ? (
            <img alt={terrain.nom} className="aspect-[16/10] h-full w-full object-cover" src={mainPhoto.url} />
          ) : (
            <div className="grid aspect-[16/10] place-items-center text-sm text-[#88927f]">Aucune photo disponible</div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
          {photos.filter((photo) => photo.id !== mainPhoto?.id).slice(0, 2).map((photo) => (
            <img alt={`${terrain.nom} - photo`} className="aspect-[16/10] h-full w-full rounded-lg bg-white/10 object-cover" key={photo.id} src={photo.url} />
          ))}
          <div className="flex flex-col justify-center rounded-lg border border-white/10 bg-white/[0.06] p-5">
            <span className="text-xs text-[#88927f]">Capacité</span>
            <strong className="mt-1 font-heading text-xl">{terrain.capacite} places</strong>
            <span className="mt-4 text-xs text-[#88927f]">Type</span>
            <strong className="mt-1 text-sm">{terrain.type}</strong>
            {terrain.latitude && terrain.longitude && (
              <Link className="mt-5 text-xs font-bold text-[#b6f23a] hover:underline" to={`/carte?terrain=${terrain.id}`}>
                Voir sur la carte →
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-8 border-b border-white/10 py-8 md:grid-cols-[1fr_300px]">
        <div>
          <h2 className="font-heading text-xl font-semibold">À propos de ce terrain</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#cfd6c9]">
            {terrain.description || 'Aucune description disponible.'}
          </p>
        </div>
        <aside className="h-fit rounded-lg border border-white/10 bg-white/[0.06] p-5">
          <p className="text-xs text-[#88927f]">Tarif horaire</p>
          <p className="mt-1 font-heading text-2xl font-semibold text-[#b6f23a]">
            {Number(terrain.tarif_horaire).toLocaleString('fr-FR')} FCFA
          </p>
          {user?.role === 'CLIENT' ? (
            <div className="mt-6 border-t border-white/10 pt-5">
              <ReservationForm terrain={terrain} />
            </div>
          ) : !user ? (
            <Link className="mt-5 inline-flex w-full justify-center rounded-full bg-[#b6f23a] px-4 py-3 text-xs font-bold text-[#0b0f0c] hover:bg-[#9ad92a]" to="/connexion">
              Se connecter pour réserver
            </Link>
          ) : (
            <p className="mt-5 text-xs text-[#88927f]">La réservation est accessible aux comptes client.</p>
          )}
        </aside>
      </section>
    </main>
  )
}
