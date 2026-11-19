import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PitchArt from '../../components/PitchArt.jsx'
import Reveal from '../../components/Reveal.jsx'
import { getFeaturedTerrains, readJson } from '../../services/api.js'
import { useAuth } from '../../contextes/useAuth.js'
import Icon from '../../components/Icon.jsx'

const STEPS = [
  {
    title: 'Choisissez votre terrain',
    text: 'Parcourez la liste ou la carte des terrains de foot de Dakar, avec tarifs, photos et horaires.',
    icon: 'map-pin',
  },
  {
    title: 'Demandez un créneau',
    text: 'Indiquez la date, l’heure et votre numéro WhatsApp. Le gestionnaire reçoit votre demande aussitôt.',
    icon: 'calendar',
  },
  {
    title: 'Validez et réglez sur WhatsApp',
    text: 'Une fois la demande acceptée, le gestionnaire vous écrit directement pour convenir du paiement.',
    icon: 'whatsapp',
  },
]

function FloatingCard({ className = '', delay = '0s', children }) {
  return (
    <div className={`anim-float absolute rounded-2xl border border-white/15 bg-[#0b0f0c]/75 p-3.5 text-left shadow-2xl backdrop-blur-md ${className}`} style={{ animationDelay: delay }}>
      {children}
    </div>
  )
}

/** Lien si `to` est fourni, simple bloc sinon (terrain d'un autre gestionnaire : consultable mais pas ouvrable). */
function MaybeLink({ to, className, children }) {
  return to ? <Link className={className} to={to}>{children}</Link> : <div className={className}>{children}</div>
}

function FeaturedTerrains() {
  const { user } = useAuth()
  const isManager = user?.role === 'GESTIONNAIRE'
  const [terrains, setTerrains] = useState(null)

  useEffect(() => {
    let active = true

    // Seule liste où un gestionnaire voit aussi les terrains des autres (règle de visibilité).
    getFeaturedTerrains()
      .then((response) => readJson(response))
      .then((payload) => {
        if (active) setTerrains((payload.data || []).slice(0, 3))
      })
      .catch(() => active && setTerrains([]))

    return () => {
      active = false
    }
  }, [])

  if (terrains !== null && terrains.length === 0) return null

  // Où mène chaque carte : fiche publique (visiteur, client), fiche de gestion (son terrain), nulle part (terrain d'un autre).
  const targetFor = (terrain) => {
    if (!isManager) return `/terrains/${terrain.id}`
    return terrain.est_a_moi ? `/gestionnaire/terrains/${terrain.id}` : null
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
      <Reveal className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#b6f23a]">À la une</p>
          <h2 className="mt-1 font-display text-3xl font-semibold uppercase sm:text-4xl">Terrains à Dakar</h2>
        </div>
        <Link
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-bold hover:border-[#b6f23a] hover:text-[#b6f23a]"
          to={isManager ? '/gestionnaire/terrains' : '/terrains'}
        >
          {isManager ? 'Gérer mes terrains' : 'Voir tous les terrains'}
          <Icon className="size-3.5" name="arrow-right" />
        </Link>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {terrains === null
          ? [0, 1, 2].map((index) => <div className="skeleton h-72" key={index} />)
          : terrains.map((terrain, index) => {
            const photo = terrain.images?.find((image) => image.est_principale) || terrain.images?.[0]
            const target = targetFor(terrain)

            return (
              <Reveal
                as="article"
                className={`group overflow-hidden rounded-3xl border bg-white/[0.04] ${target ? 'lift' : ''} ${terrain.est_a_moi ? 'border-[#b6f23a]/40' : 'border-white/10'}`}
                index={index}
                key={terrain.id}
              >
                <MaybeLink className="relative block aspect-[16/10] overflow-hidden" to={target}>
                  {photo
                    ? <img alt={terrain.nom} className={`${target ? 'zoom-on-hover ' : ''}absolute inset-0 h-full w-full object-cover`} loading="lazy" src={photo.url} />
                    : <PitchArt className="absolute inset-0" />}
                  <span className="absolute left-3 top-3 rounded-full bg-[#0b0f0c]/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#b6f23a] backdrop-blur">{terrain.type}</span>
                  {terrain.est_a_moi && (
                    <span className="absolute right-3 top-3 rounded-full bg-[#b6f23a] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0b0f0c]">Votre terrain</span>
                  )}
                  <span className="absolute bottom-3 right-3 rounded-full bg-[#b6f23a] px-3 py-1 text-xs font-bold text-[#0b0f0c]">
                    {Number(terrain.tarif_horaire).toLocaleString('fr-FR')} FCFA / h
                  </span>
                </MaybeLink>
                <div className="p-4">
                  <MaybeLink className={`font-heading text-lg font-semibold ${target ? 'transition-colors group-hover:text-[#b6f23a]' : ''}`} to={target}>
                    {terrain.nom}
                  </MaybeLink>
                  <p className="mt-1 text-xs text-[#a3ad9f]">{[terrain.quartier, terrain.commune?.nom].filter(Boolean).join(' · ')}</p>
                </div>
              </Reveal>
            )
          })}
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <main>
      {/* ── Accueil */}
      <section className="relative -mt-[72px] overflow-hidden pt-[72px]">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,#b6f23a1f,transparent_70%),radial-gradient(40%_40%_at_90%_60%,#ff6b4a14,transparent_70%)]" />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-14 pt-14 sm:px-8 md:pt-20 lg:grid-cols-[1.05fr_1fr]">
          <div className="text-center lg:text-left">
            <span className="anim-fade-up inline-block rounded-full border border-[#b6f23a]/40 bg-[#b6f23a]/10 px-4 py-1.5 text-xs font-semibold text-[#b6f23a]" style={{ '--i': 0 }}>
              Dakar · Réservation de terrains
            </span>
            <h1 className="anim-fade-up mt-6 font-display text-5xl font-semibold uppercase leading-[1.02] sm:text-6xl xl:text-7xl" style={{ '--i': 1 }}>
              Jouez sur le <span className="text-[#b6f23a]">terrain</span> comme jamais
            </h1>
            <p className="anim-fade-up mx-auto mt-5 max-w-md text-base leading-7 text-white/65 lg:mx-0" style={{ '--i': 2 }}>
              Synthétique ou gazon, à 5 ou à 11 : trouvez votre terrain de foot à Dakar et demandez votre créneau en quelques secondes.
            </p>
            <div className="anim-fade-up mt-8 flex flex-wrap justify-center gap-3 lg:justify-start" style={{ '--i': 3 }}>
              <Link className="rounded-full bg-[#b6f23a] px-7 py-3.5 text-sm font-bold text-[#0b0f0c] shadow-[0_10px_30px_-10px_#b6f23a] transition-colors hover:bg-[#9ad92a]" to="/terrains">
                Trouver un terrain
              </Link>
              <Link className="rounded-full border border-white/20 px-7 py-3.5 text-sm font-bold text-white transition-colors hover:border-white hover:bg-white hover:text-[#0b0f0c]" to="/carte">
                Voir la carte
              </Link>
            </div>
          </div>

          <div className="anim-fade-up relative mx-auto w-full max-w-xl" style={{ '--i': 2 }}>
            <PitchArt animated className="aspect-[16/11] rounded-[2rem] border border-white/10 shadow-[0_40px_120px_-30px_#b6f23a55]" />
            <FloatingCard className="-left-2 bottom-6 w-44 sm:-left-6" delay="0s">
              <p className="text-[10px] font-bold uppercase text-[#b6f23a]">Créneau libre</p>
              <p className="mt-1 font-display text-xl">20:00 – 21:00</p>
              <p className="text-[11px] text-white/60">Ce soir · Médina</p>
            </FloatingCard>
            <FloatingCard className="-right-2 top-6 hidden w-48 sm:block sm:-right-6" delay="1.2s">
              <p className="text-[10px] font-bold uppercase text-[#b6f23a]">Demande validée</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">Réservation confirmée <Icon className="size-4 text-[#b6f23a]" name="check" /></p>
              <p className="text-[11px] text-white/60">Par le gestionnaire</p>
            </FloatingCard>
            <FloatingCard className="-bottom-5 right-8 flex items-center gap-2 !p-2.5 pr-4" delay="2.4s">
              <span className="grid size-8 place-items-center rounded-full bg-[#25d366] text-[#0b0f0c]">
                <Icon className="size-5" name="whatsapp" strokeWidth={1.8} />
              </span>
              <span className="text-xs font-semibold">Paiement réglé sur WhatsApp</span>
            </FloatingCard>
          </div>
        </div>
      </section>

      <FeaturedTerrains />

      {/* ── Comment ça marche */}
      <section className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
        <Reveal className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wide text-[#b6f23a]">Comment ça marche</p>
          <h2 className="mt-1 font-display text-3xl font-semibold uppercase sm:text-4xl">Trois étapes, zéro paiement en ligne</h2>
        </Reveal>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal as="li" className="lift relative rounded-3xl border border-white/10 bg-white/[0.04] p-6" index={index} key={step.title}>
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-2xl bg-[#b6f23a]/15 text-[#b6f23a]"><Icon className="size-5" name={step.icon} strokeWidth={1.8} /></span>
                <span className="font-display text-4xl font-semibold text-white/10">0{index + 1}</span>
              </div>
              <h3 className="mt-5 font-heading text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/60">{step.text}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ── Appel à l'action */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-6 pt-6 sm:px-8">
        <Reveal className="relative overflow-hidden rounded-[2rem] border border-[#b6f23a]/25 bg-[linear-gradient(120deg,#b6f23a1f,#0b0f0c_60%)] px-6 py-10 text-center sm:px-12 sm:text-left">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className="font-display text-3xl font-semibold uppercase">Prêt pour le match ?</h2>
              <p className="mt-2 text-sm text-white/65">Repérez les terrains autour de vous et demandez votre créneau.</p>
            </div>
            <div className="flex w-full flex-wrap justify-center gap-3 sm:w-auto">
              <Link className="rounded-full bg-[#b6f23a] px-6 py-3 text-sm font-bold text-[#0b0f0c] hover:bg-[#9ad92a]" to="/carte">Ouvrir la carte</Link>
              <Link className="rounded-full border border-white/20 px-6 py-3 text-sm font-bold hover:bg-white/10" to="/inscription">Créer un compte</Link>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  )
}
