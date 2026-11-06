import { Link } from 'react-router-dom'

const photo = (id, w = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=${w}`

const IMAGES = {
  hero: photo('1706675780107-7c43cc487928', 2000),
  court: photo('1711447395363-5595964fd7ab'),
  player: photo('1761225091881-0d3bda9f6d5a', 900),
  aerial: photo('1789476332262-3f9826198129', 900),
}

const features = [
  { title: 'Réservation rapide', text: 'Choisissez votre créneau, le gestionnaire confirme.' },
  { title: 'Carte interactive', text: 'Repérez les terrains autour de vous à Dakar.' },
  { title: 'Paiement suivi', text: 'Suivez vos réservations et paiements au même endroit.' },
]

function Glass({ className = '', children }) {
  return (
    <div className={`rounded-3xl border border-white/15 bg-white/10 p-4 text-left shadow-2xl backdrop-blur-md ${className}`}>
      {children}
    </div>
  )
}

export default function HomePage() {
  return (
    <main>
      <section className="relative -mt-[72px] overflow-hidden pt-[72px]">
        <img alt="" className="absolute inset-0 size-full object-cover opacity-50" src={IMAGES.hero} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0f0c]/50 via-[#0b0f0c]/70 to-[#0b0f0c]" />

        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-5 pb-16 pt-16 text-center sm:px-8 md:pt-24">
          <span className="rounded-full border border-[#b6f23a]/40 bg-[#b6f23a]/10 px-4 py-1.5 text-xs font-semibold text-[#b6f23a]">
            Dakar · Réservation de terrains
          </span>
          <h1 className="mt-6 max-w-3xl font-display text-5xl font-semibold uppercase leading-[1.05] sm:text-7xl">
            Jouez sur le <span className="text-[#b6f23a]">terrain</span> <br className="hidden sm:block" />comme jamais
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-white/65">
            Foot, basket, padel : trouvez le terrain parfait et réservez votre créneau en quelques secondes.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link className="rounded-full bg-[#b6f23a] px-7 py-3.5 text-sm font-bold text-[#0b0f0c] transition-colors hover:bg-[#9ad92a]" to="/terrains">
              Explorer ↗
            </Link>
            <Link className="rounded-full bg-white px-7 py-3.5 text-sm font-bold text-[#0b0f0c] transition-colors hover:bg-white/85" to="/carte">
              Voir la carte
            </Link>
          </div>

          <div className="relative mt-14 w-full max-w-4xl">
            <div className="overflow-hidden rounded-[2rem] border border-white/15 shadow-[0_40px_120px_-30px_#b6f23a55]">
              <img alt="Terrain éclairé de nuit" className="aspect-[16/8] w-full object-cover" src={IMAGES.court} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f0c]/70 via-transparent to-transparent" />
            </div>
            <Glass className="absolute -left-3 bottom-6 w-52 sm:-left-8">
              <p className="text-[11px] font-semibold uppercase text-[#b6f23a]">Créneau</p>
              <p className="mt-1 font-display text-xl">20:00 – 21:00</p>
              <p className="text-xs text-white/60">Disponible ce soir</p>
            </Glass>
            <Glass className="absolute -right-3 top-6 hidden w-48 sm:block md:-right-8">
              <p className="text-[11px] font-semibold uppercase text-[#b6f23a]">Confirmation</p>
              <p className="mt-1 text-sm font-semibold">Réservation validée ✓</p>
              <p className="text-xs text-white/60">Par le gestionnaire</p>
            </Glass>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-10 sm:px-8 md:grid-cols-[1fr_1fr_1.1fr]">
        <ul className="grid gap-4 md:col-span-1 md:grid-rows-3">
          {features.map((feature, index) => (
            <li className="rounded-3xl border border-white/10 bg-white/[0.04] p-5" key={feature.title}>
              <span className="font-display text-sm text-[#b6f23a]">0{index + 1}</span>
              <h2 className="mt-1 font-display text-xl uppercase">{feature.title}</h2>
              <p className="mt-1 text-sm text-white/55">{feature.text}</p>
            </li>
          ))}
        </ul>
        <img alt="Joueur de nuit" className="h-full min-h-72 w-full rounded-3xl object-cover" loading="lazy" src={IMAGES.player} />
        <img alt="Vue aérienne d'un stade" className="h-full min-h-72 w-full rounded-3xl object-cover" loading="lazy" src={IMAGES.aerial} />
      </section>
    </main>
  )
}
