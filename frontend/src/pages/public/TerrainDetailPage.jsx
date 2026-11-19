import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPublicTerrain, readJson } from '../../services/api.js'
import { useAuth } from '../../contextes/useAuth.js'
import ReservationForm from '../client/ReservationForm.jsx'
import PitchArt from '../../components/PitchArt.jsx'
import TerrainLocationMap from '../../components/TerrainLocationMap.jsx'
import Icon from '../../components/Icon.jsx'

const readResponse = (response) => readJson(response, 'Impossible de charger ce terrain.')

/** Fiche d'un terrain ; `embedded` + `basePath` : version affichée dans l'espace client. */
export default function TerrainDetailPage({ basePath = '/terrains', mapPath = '/carte', embedded = false }) {
  const Wrapper = embedded ? 'div' : 'main'
  const frame = embedded ? 'w-full' : 'mx-auto min-h-screen w-full max-w-6xl px-5 sm:px-8'
  const { terrainId } = useParams()
  const { user } = useAuth()
  const [terrain, setTerrain] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedPhotoId, setSelectedPhotoId] = useState(null)

  useEffect(() => {
    let active = true

    getPublicTerrain(terrainId)
      .then(readResponse)
      .then((payload) => {
        if (active) setTerrain(payload.data)
      })
      .catch((requestError) => {
        if (!active) return
        // 404 : terrain inexistant, inactif, ou appartenant à un autre gestionnaire (règle de visibilité).
        setError(requestError.status === 404
          ? 'Ce terrain est introuvable ou n’est pas accessible depuis votre compte.'
          : requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [terrainId])


  if (loading) {
    return (
      <Wrapper className={`${frame} py-8`} aria-busy="true">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton mt-6 h-10 w-2/3" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="skeleton aspect-[16/10]" />
          <div className="skeleton h-72" />
        </div>
      </Wrapper>
    )
  }

  if (error || !terrain) {
    return (
      <Wrapper className={`${frame} py-12`}>
        <p className="text-sm text-[#ff9b84]" role="alert">{error || 'Terrain introuvable.'}</p>
        <Link className="mt-4 inline-block text-sm font-bold text-[#b6f23a]" to={basePath}>Retour aux terrains</Link>
      </Wrapper>
    )
  }

  const photos = terrain.images || []
  const defaultPhoto = photos.find((photo) => photo.est_principale) || photos[0]
  const shownPhoto = photos.find((photo) => photo.id === selectedPhotoId) || defaultPhoto
  const facts = [
    { label: 'Revêtement', value: terrain.type },
    { label: 'Capacité', value: `${terrain.capacite} joueurs` },
    { label: 'Commune', value: terrain.commune?.nom },
    { label: 'Quartier', value: terrain.quartier },
  ].filter((fact) => fact.value)

  return (
    <Wrapper className={`${frame} ${embedded ? 'py-2' : 'py-8'} text-[#f3f5ef]`}>
      <Link className="inline-flex items-center gap-1.5 text-xs font-bold text-[#b6f23a] hover:underline" to={basePath}><Icon className="size-3.5" name="arrow-left" />Tous les terrains</Link>

      <header className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#b6f23a]">{[terrain.commune?.nom, terrain.quartier].filter(Boolean).join(' · ')}</p>
        <h1 className="mt-1 font-heading text-3xl font-semibold sm:text-4xl">{terrain.nom}</h1>
        <p className="mt-2 text-sm text-[#a3ad9f]">{terrain.adresse}, {terrain.ville}</p>
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {/* Galerie : grande photo + miniatures */}
          <section aria-label="Photos du terrain">
            <div className="overflow-hidden rounded-3xl border border-white/10">
              {shownPhoto ? (
                <img alt={terrain.nom} className="anim-fade-in aspect-[16/10] w-full object-cover" key={shownPhoto.id} src={shownPhoto.url} />
              ) : (
                <PitchArt className="aspect-[16/10]" label="Photos bientôt disponibles" />
              )}
            </div>
            {photos.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {photos.map((photo, index) => (
                  <button
                    aria-label={`Afficher la photo ${index + 1}`}
                    aria-pressed={photo.id === shownPhoto?.id}
                    className={`shrink-0 overflow-hidden rounded-xl border-2 transition ${photo.id === shownPhoto?.id ? 'border-[#b6f23a]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    key={photo.id}
                    onClick={() => setSelectedPhotoId(photo.id)}
                    type="button"
                  >
                    <img alt="" className="h-16 w-24 object-cover" loading="lazy" src={photo.url} />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Informations clés */}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {facts.map((fact, index) => (
              <div className="anim-fade-up rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3" key={fact.label} style={{ '--i': index }}>
                <dt className="text-[11px] text-[#88927f]">{fact.label}</dt>
                <dd className="mt-1 truncate text-sm font-semibold" title={fact.value}>{fact.value}</dd>
              </div>
            ))}
          </dl>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-heading text-xl font-semibold">À propos de ce terrain</h2>
              {terrain.latitude && terrain.longitude && (
                <div className="flex flex-wrap gap-2">
                  <Link className="inline-flex items-center gap-1.5 rounded-full bg-[#ff6b4a] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#f05a39]" to={`${mapPath}?terrain=${terrain.id}&itineraire=1`}>
                    <Icon className="size-3.5" name="locate" />
                    Itinéraire
                  </Link>
                  <Link className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-bold hover:border-[#b6f23a] hover:text-[#b6f23a]" to={`${mapPath}?terrain=${terrain.id}`}>
                    <Icon className="size-3.5" name="map-pin" />
                    Voir sur la carte
                  </Link>
                </div>
              )}
            </div>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#cfd6c9]">
              {terrain.description || 'Le gestionnaire n’a pas encore ajouté de description.'}
            </p>
          </section>

          {terrain.latitude && terrain.longitude && (
            <section aria-label="Emplacement du terrain">
              <h2 className="font-heading text-xl font-semibold">Emplacement</h2>
              <p className="mb-3 mt-1 text-sm text-[#a3ad9f]">
                {[terrain.adresse, terrain.quartier, terrain.commune?.nom].filter(Boolean).join(' · ')}
              </p>
              <TerrainLocationMap terrain={terrain} />
            </section>
          )}
        </div>

        {/* Réservation : reste visible pendant le défilement sur ordinateur */}
        <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.05] p-5 lg:sticky lg:top-24">
          {terrain.disponibilite?.etat === 'INDISPONIBLE' && (
            <p className="anim-fade-in mb-4 rounded-xl border border-[#ff6b4a]/30 bg-[#ff6b4a]/10 px-3 py-2 text-xs text-[#ffb59f]" role="status">
              <strong className="block text-[#ff9b84]">
                Indisponible jusqu’au {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(terrain.disponibilite.jusqu_au))}
              </strong>
              {terrain.disponibilite.motif || 'Le terrain est temporairement fermé.'} Vous pouvez réserver un créneau après cette date.
            </p>
          )}
          <p className="text-xs text-[#88927f]">Tarif horaire</p>
          <p className="mt-1 font-heading text-3xl font-semibold text-[#b6f23a]">
            {Number(terrain.tarif_horaire).toLocaleString('fr-FR')} <span className="text-base">FCFA</span>
          </p>
          {user?.role === 'CLIENT' ? (
            <div className="mt-5 border-t border-white/10 pt-5">
              <ReservationForm terrain={terrain} />
            </div>
          ) : !user ? (
            <>
              <Link className="mt-5 inline-flex w-full justify-center rounded-full bg-[#b6f23a] px-4 py-3 text-sm font-bold text-[#0b0f0c] hover:bg-[#9ad92a]" to="/connexion">
                Se connecter pour réserver
              </Link>
              <p className="mt-3 text-center text-[11px] text-[#88927f]">
                Pas encore de compte ? <Link className="font-semibold text-[#b6f23a] hover:underline" to="/inscription">Inscription gratuite</Link>
              </p>
            </>
          ) : (
            <p className="mt-5 text-xs text-[#88927f]">La réservation est accessible aux comptes client.</p>
          )}
          <p className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-[11px] leading-5 text-[#a3ad9f]">
            <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#25d366]" />
            Aucun paiement en ligne : après validation, le gestionnaire vous écrit sur WhatsApp pour le règlement.
          </p>
        </aside>
      </div>
    </Wrapper>
  )
}
