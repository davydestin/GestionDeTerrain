import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f1f2eb] px-5 py-8 text-[#202b25] sm:px-10">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between border-b border-[#dfe3db] pb-5">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">GT</span>
          <span>Gestion de terrain</span>
        </div>
        <nav className="flex items-center gap-3" aria-label="Compte">
          <Link className="hidden rounded px-3 py-2 text-sm font-semibold text-[#3a463f] hover:bg-[#e7ebe3] sm:inline-flex" to="/terrains">
            Terrains
          </Link>
          <Link className="hidden rounded px-3 py-2 text-sm font-semibold text-[#3a463f] hover:bg-[#e7ebe3] sm:inline-flex" to="/carte">
            Carte
          </Link>
          <Link className="rounded px-3 py-2 text-sm font-semibold text-[#3a463f] hover:bg-[#e7ebe3]" to="/connexion">
            Connexion
          </Link>
          <Link className="rounded bg-[#2f7259] px-4 py-2 text-sm font-bold text-white hover:bg-[#255e48]" to="/inscription">
            Créer un compte
          </Link>
        </nav>
      </header>
      <section className="mx-auto grid min-h-[72vh] w-full max-w-6xl content-center gap-8 py-16 md:grid-cols-[1.2fr_0.8fr] md:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase text-[#2f7259]">Dakar · Réservation de terrains</p>
          <h1 className="mt-4 max-w-2xl font-['Space_Grotesk'] text-4xl font-semibold leading-tight sm:text-5xl">
            Trouvez votre prochain terrain.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-[#66736a]">
            Consultez les terrains disponibles et gérez vos réservations depuis un seul espace.
          </p>
          <Link className="mt-7 inline-flex rounded bg-[#2f7259] px-5 py-3 text-sm font-bold text-white hover:bg-[#255e48]" to="/terrains">
            Explorer les terrains
          </Link>
        </div>
        <div className="relative hidden aspect-[4/3] overflow-hidden rounded-lg border border-[#dfe3db] bg-[#193b30] md:block">
          <div className="absolute inset-[10%] border border-white/20" />
          <div className="absolute inset-y-[10%] left-1/2 border-l border-white/20" />
          <div className="absolute left-1/2 top-1/2 aspect-square w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
          <div className="absolute inset-y-[31%] left-[10%] w-[18%] border-y border-r border-white/20" />
          <div className="absolute inset-y-[31%] right-[10%] w-[18%] border-y border-l border-white/20" />
          <span className="absolute bottom-5 left-5 text-xs font-semibold text-white/70">Terrains de Dakar</span>
        </div>
      </section>
    </main>
  )
}