import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, useMapEvents } from 'react-leaflet'
import LockViewToBounds from './LockViewToBounds.jsx'
import MapTiles from './MapTiles.jsx'
import { readJson, reverseGeocode, searchPlaces } from '../services/api.js'
import Icon from './Icon.jsx'

/*
 * Sélecteur de position « façon VTC » :
 *  - le repère reste fixe au centre, c'est la carte qu'on déplace en dessous ;
 *  - quand la carte s'arrête, la position est transmise au parent et l'adresse
 *    correspondante est cherchée (géocodage inverse, avec anti-rebond) ;
 *  - une barre de recherche et un bouton « Ma position » amènent la carte au bon endroit.
 */

const DAKAR_BOUNDS = [[14.55, -17.55], [14.85, -17.10]]
const DAKAR_CENTER = { lat: 14.6928, lng: -17.4467 }
const DEFAULT_ZOOM = 13
const PLACE_ZOOM = 17
const REVERSE_DELAY_MS = 650
const REVERSE_RETRY_DELAY_MS = 2500

function insideDakar({ lat, lng }) {
  const [[south, west], [north, east]] = DAKAR_BOUNDS
  return lat >= south && lat <= north && lng >= west && lng <= east
}

// Clé de position arrondie au mètre près : sert à associer une adresse à une position.
function positionKey(position) {
  return position ? `${position.lat.toFixed(5)},${position.lng.toFixed(5)}` : null
}

function MapEvents({ mapRef, onReady, onMoveStart, onMoveEnd }) {
  const map = useMapEvents({
    movestart: onMoveStart,
    moveend: () => onMoveEnd(map.getCenter()),
    // Sur ordinateur, un clic amène directement le point cliqué sous le repère.
    click: (event) => map.panTo(event.latlng),
  })

  // react-leaflet crée la carte après le premier rendu du parent : on prévient le parent quand elle existe.
  useEffect(() => {
    mapRef.current = map
    onReady()
  }, [map, mapRef, onReady])

  return null
}

export default function LocationPicker({ value, onChange, onAddressResolved }) {
  const mapRef = useRef(null)
  const lastEmittedKey = useRef(undefined)
  const suppressMoveEnd = useRef(false)
  const knownAddress = useRef(null)
  const reverseTimer = useRef(null)
  const requestId = useRef(0)
  const onAddressResolvedRef = useRef(onAddressResolved)

  const [mapReady, setMapReady] = useState(false)
  const handleMapReady = useCallback(() => setMapReady(true), [])
  const [moving, setMoving] = useState(false)
  const [centerInside, setCenterInside] = useState(true)
  const [resolved, setResolved] = useState({ key: null, data: null, error: '' })
  const [resolvingKey, setResolvingKey] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    onAddressResolvedRef.current = onAddressResolved
  }, [onAddressResolved])

  useEffect(() => () => clearTimeout(reverseTimer.current), [])

  const lookupAddress = useCallback((position) => {
    clearTimeout(reverseTimer.current)
    const key = positionKey(position)

    // Adresse déjà connue (choisie dans les résultats de recherche) : pas d'appel réseau.
    if (knownAddress.current?.key === key) {
      const data = knownAddress.current.data
      requestId.current += 1
      setResolvingKey(null)
      setResolved({ key, data, error: '' })
      onAddressResolvedRef.current?.(data)
      return
    }

    // Affiché tout de suite (et non après l'anti-rebond) pour ne jamais montrer « adresse non trouvée » à tort.
    const id = ++requestId.current
    setResolvingKey(key)

    const attempt = async (retriesLeft) => {
      try {
        const payload = await readJson(await reverseGeocode(position.lat, position.lng), 'Adresse introuvable.')
        if (id !== requestId.current) return
        setResolved({ key, data: payload.result, error: '' })
        setResolvingKey(null)
        onAddressResolvedRef.current?.(payload.result)
      } catch (requestError) {
        if (id !== requestId.current) return

        // Service d'adresses momentanément indisponible (503) : nouvel essai discret avant d'afficher l'erreur.
        if (requestError.status === 503 && retriesLeft > 0) {
          reverseTimer.current = setTimeout(() => attempt(retriesLeft - 1), REVERSE_RETRY_DELAY_MS)
          return
        }

        setResolved({ key, data: null, error: requestError.message })
        setResolvingKey(null)
      }
    }

    reverseTimer.current = setTimeout(() => attempt(1), REVERSE_DELAY_MS)
  }, [])

  // Le parent change la position (édition d'un terrain, réinitialisation) : on recentre sans réémettre.
  useEffect(() => {
    const map = mapRef.current
    const key = positionKey(value)
    if (!mapReady || !map || key === lastEmittedKey.current) return

    lastEmittedKey.current = key
    suppressMoveEnd.current = true
    if (value) map.setView([value.lat, value.lng], Math.max(map.getZoom(), PLACE_ZOOM), { animate: false })
    else map.setView([DAKAR_CENTER.lat, DAKAR_CENTER.lng], DEFAULT_ZOOM, { animate: false })
    suppressMoveEnd.current = false

    if (value) lookupAddress(value)
  }, [value, lookupAddress, mapReady])

  function handleMoveStart() {
    setMoving(true)
    clearTimeout(reverseTimer.current)
  }

  function handleMoveEnd(center) {
    const position = { lat: center.lat, lng: center.lng }
    const inside = insideDakar(position)
    setMoving(false)
    setCenterInside(inside)

    if (suppressMoveEnd.current) return

    const next = inside ? position : null
    // Un redimensionnement de la fenêtre déclenche aussi « moveend » sans changer la position : on l'ignore.
    if (positionKey(next) === lastEmittedKey.current) return
    lastEmittedKey.current = positionKey(next)
    onChange(next)
    if (next) lookupAddress(next)
  }

  function flyTo(position) {
    mapRef.current?.flyTo([position.lat, position.lng], PLACE_ZOOM, { duration: 0.8 })
  }

  async function search() {
    const text = query.trim()
    if (text.length < 3) {
      setSearchError('Tapez au moins 3 caractères.')
      return
    }

    setSearching(true)
    setSearchError('')
    setResults([])

    try {
      const payload = await readJson(await searchPlaces(text), 'Recherche impossible.')
      const places = payload.results || []
      setResults(places)
      if (places.length === 1) choosePlace(places[0])
    } catch (requestError) {
      setSearchError(requestError.message)
    } finally {
      setSearching(false)
    }
  }

  function choosePlace(place) {
    const position = { lat: place.latitude, lng: place.longitude }
    knownAddress.current = { key: positionKey(position), data: place }
    setResults([])
    setQuery('')
    flyTo(position)
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setSearchError('La géolocalisation n’est pas disponible sur cet appareil.')
      return
    }

    setLocating(true)
    setSearchError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        const position = { lat: coords.latitude, lng: coords.longitude }
        if (!insideDakar(position)) {
          setSearchError('Votre position actuelle est en dehors de Dakar.')
          return
        }
        flyTo(position)
      },
      () => {
        setLocating(false)
        setSearchError('Impossible d’obtenir votre position. Autorisez la localisation dans le navigateur.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }

  const currentKey = positionKey(value)
  const address = resolved.key === currentKey ? resolved.data : null
  const addressError = resolved.key === currentKey ? resolved.error : ''
  const resolving = moving || (resolvingKey !== null && resolvingKey === currentKey)
  const addressLine = address
    ? address.adresse || address.display_name?.split(',')[0] || 'Lieu sans nom'
    : null
  const areaLine = address
    ? [address.quartier, address.commune && address.commune !== address.quartier ? address.commune : null, 'Dakar'].filter(Boolean).join(' · ')
    : null
  const outside = !moving && !centerInside

  return (
    <div className="relative h-[420px] overflow-hidden rounded-xl sm:h-[460px]">
      <MapContainer
        center={value ? [value.lat, value.lng] : [DAKAR_CENTER.lat, DAKAR_CENTER.lng]}
        className="h-full w-full bg-[#11160f]"
        doubleClickZoom="center"
        maxBounds={DAKAR_BOUNDS}
        maxBoundsViscosity={1}
        scrollWheelZoom="center"
        touchZoom="center"
        zoom={value ? PLACE_ZOOM : DEFAULT_ZOOM}
        zoomControl={false}
      >
        <LockViewToBounds bounds={DAKAR_BOUNDS} />
        <MapTiles />
        <MapEvents mapRef={mapRef} onMoveEnd={handleMoveEnd} onMoveStart={handleMoveStart} onReady={handleMapReady} />
      </MapContainer>

      {/* Repère fixe : la pointe désigne exactement le centre de la carte. */}
      <span aria-hidden="true" className={`picker-pin-shadow${moving ? ' is-lifted' : ''}`} />
      <span aria-hidden="true" className={`picker-pin${moving ? ' is-lifted' : ''}${outside ? ' is-outside' : ''}`}>
        <span className="picker-pin-head" />
        <span className="picker-pin-stem" />
      </span>

      {/* Barre de recherche */}
      <div className="absolute inset-x-3 top-3 z-[1000]">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0b0f0c]/95 p-1.5 shadow-lg backdrop-blur">
          <input
            aria-label="Rechercher un lieu à Dakar"
            className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // Le composant est dans le <form> du terrain : Entrée lance la recherche, pas l'enregistrement.
              if (event.key === 'Enter') {
                event.preventDefault()
                search()
              }
              if (event.key === 'Escape') setResults([])
            }}
            placeholder={addressLine ? `${addressLine} — chercher un autre lieu…` : 'Rechercher un lieu, une rue, un quartier…'}
            value={query}
          />
          <button
            className="h-9 shrink-0 rounded-xl bg-[#b6f23a] px-3 text-xs font-bold text-[#0b0f0c] disabled:opacity-60"
            disabled={searching}
            onClick={search}
            type="button"
          >
            {searching ? '…' : 'Chercher'}
          </button>
        </div>

        {results.length > 1 && (
          <ul className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-[#0b0f0c]/95 p-1 shadow-lg backdrop-blur" role="listbox">
            {results.map((place) => (
              <li key={`${place.latitude}-${place.longitude}`}>
                <button
                  className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/10"
                  onClick={() => choosePlace(place)}
                  type="button"
                >
                  <span className="block text-xs font-semibold text-white">{place.adresse || place.display_name?.split(',')[0]}</span>
                  <span className="block truncate text-[11px] text-[#88927f]">{place.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {searchError && (
          <p className="mt-2 rounded-xl bg-[#0b0f0c]/95 px-3 py-2 text-xs text-[#ff9b84]" role="alert">{searchError}</p>
        )}
      </div>

      {/* Commandes de carte */}
      <div className="absolute right-3 top-1/2 z-[1000] flex -translate-y-1/2 flex-col gap-2">
        <button aria-label="Zoomer" className="picker-control" onClick={() => mapRef.current?.zoomIn()} type="button"><Icon className="size-4" name="plus" /></button>
        <button aria-label="Dézoomer" className="picker-control" onClick={() => mapRef.current?.zoomOut()} type="button"><Icon className="size-4" name="minus" /></button>
        <button aria-label="Ma position" className="picker-control" disabled={locating} onClick={locateMe} title="Ma position" type="button">
          <Icon className={`size-4 ${locating ? 'animate-pulse' : ''}`} name="locate" />
        </button>
      </div>

      {/* Carte d'adresse sous le repère */}
      <div className="absolute inset-x-3 bottom-3 z-[1000] rounded-2xl border border-white/10 bg-[#0b0f0c]/95 px-4 py-3 shadow-lg backdrop-blur" aria-live="polite">
        {outside ? (
          <p className="text-xs font-semibold text-[#ff9b84]">Hors du périmètre de Dakar — déplacez la carte vers la ville.</p>
        ) : moving ? (
          <p className="text-xs text-[#cfd6c9]">Relâchez pour placer le terrain ici…</p>
        ) : !value ? (
          <p className="text-xs text-[#cfd6c9]">
            Déplacez la carte pour placer le terrain sous le repère, cherchez un lieu ou utilisez <strong>Ma position</strong>.
          </p>
        ) : resolving ? (
          <p className="text-xs text-[#cfd6c9]">Recherche de l’adresse…</p>
        ) : (
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#b6f23a]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{addressLine || 'Position sélectionnée'}</p>
              <p className={`text-[11px] ${addressError ? 'text-[#ff9b84]' : 'truncate text-[#88927f]'}`}>
                {addressError || areaLine || 'Adresse non trouvée, complétez-la dans le formulaire.'}
                {' · '}
                {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
              </p>
            </div>
            {addressError && (
              <button className="ml-auto shrink-0 rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold text-[#cfd6c9] hover:bg-white/10" onClick={() => lookupAddress(value)} type="button">
                Réessayer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
