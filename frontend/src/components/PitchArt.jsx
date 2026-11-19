/**
 * Illustration de terrain de foot vu du dessus, en SVG pur (aucune image externe à charger).
 * Sert d'image par défaut pour un terrain sans photo et de visuel sur l'accueil.
 */
export default function PitchArt({ className = '', label, animated = false }) {
  // « relative » seulement si l'appelant n'a pas déjà positionné le bloc (ex. « absolute inset-0 »),
  // sinon les deux classes se contrediraient et le dessin aurait une hauteur nulle.
  const positioning = /\b(absolute|fixed|sticky)\b/.test(className) ? '' : 'relative'

  return (
    <div className={`${positioning} overflow-hidden bg-[radial-gradient(120%_90%_at_50%_0%,#1f3a12_0%,#11200c_55%,#0b140a_100%)] ${className}`}>
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 250">
        {/* Bandes de pelouse */}
        {Array.from({ length: 8 }, (_, index) => (
          <rect fill={index % 2 ? '#ffffff05' : 'transparent'} height="250" key={index} width="50" x={index * 50} y="0" />
        ))}
        <g fill="none" stroke="#b6f23a" strokeOpacity="0.45" strokeWidth="2">
          <rect height="210" rx="4" width="360" x="20" y="20" />
          <line x1="200" x2="200" y1="20" y2="230" />
          <circle cx="200" cy="125" r="34" />
          <rect height="110" width="56" x="20" y="70" />
          <rect height="110" width="56" x="324" y="70" />
          <rect height="50" width="20" x="20" y="100" />
          <rect height="50" width="20" x="360" y="100" />
        </g>
        <circle cx="200" cy="125" fill="#b6f23a" fillOpacity="0.6" r="3" />
        {animated && (
          <circle fill="#f3f5ef" r="6">
            <animateMotion dur="7s" path="M90,170 C150,60 250,190 310,80 S170,40 90,170" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
      {label && (
        <span className="absolute bottom-3 left-3 rounded-full bg-[#0b0f0c]/70 px-2.5 py-1 text-[10px] font-semibold text-[#cfd6c9]">
          {label}
        </span>
      )}
    </div>
  )
}
