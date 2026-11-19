import { useEffect, useRef, useState } from 'react'
import { distanceMeters, remainingRoute } from '../../services/geo.js'
import { getRoute } from '../../services/routingService.js'

const ARRIVAL_RADIUS_M = 40 // « Vous êtes arrivé » sous cette distance du terrain
const OFF_ROUTE_M = 50 // au-delà, on considère que l'utilisateur a quitté le tracé
const REROUTE_MIN_INTERVAL_MS = 15_000 // serveurs d'itinéraire gratuits : pas plus d'un recalcul toutes les 15 s
const WATCH_OPTIONS = { enableHighAccuracy: true, timeout: 15_000, maximumAge: 3_000 }

function describeLocationError(error) {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'La localisation exige une connexion sécurisée (HTTPS). Ouvrez le site en https ou sur localhost.'
  }
  const messages = {
    1: 'Autorisez la localisation dans votre navigateur pour suivre l’itinéraire.',
    2: 'Votre position est momentanément indisponible (GPS ou réseau).',
    3: 'La recherche de votre position a pris trop de temps. Réessayez.',
  }
  return messages[error?.code] || error?.message || 'Impossible de récupérer votre position.'
}

const toPosition = (geo) => ({ lat: geo.coords.latitude, lng: geo.coords.longitude, accuracy: geo.coords.accuracy })

/** Distance et durée restantes, heure d'arrivée estimée (calculées à chaque position, pas pendant le rendu). */
function computeProgress(position, route) {
  if (!position || !route) return null
  const remaining = remainingRoute([position.lat, position.lng], route.coordinates)
  const secondsPerMeter = route.distance > 0 ? route.duration / route.distance : 0
  const seconds = remaining.distance * secondsPerMeter
  return { remaining, seconds, arrival: new Date(Date.now() + seconds * 1000) }
}

function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('La géolocalisation n’est pas disponible sur ce navigateur.'))
      return
    }
    navigator.geolocation.getCurrentPosition((geo) => resolve(toPosition(geo)), reject, { enableHighAccuracy: true, timeout: 12_000, maximumAge: 10_000 })
  })
}

/**
 * Localisation, suivi de position et itinéraire guidé vers un terrain.
 *
 * Statuts de l'itinéraire : localisation → calcul → apercu (tracé affiché, guidage pas encore lancé)
 * → guidage (la carte suit) ; recalcul si l'utilisateur quitte le tracé ; arrive ; erreur.
 */
export default function useRouteNavigation() {
  const [userPosition, setUserPosition] = useState(null)
  const [tracking, setTracking] = useState(false) // « Suivre ma position » (hors itinéraire)
  const [follow, setFollow] = useState(false) // la carte accompagne la position
  const [centerRequest, setCenterRequest] = useState(null)
  const [fitRoute, setFitRoute] = useState(null)
  const [navigation, setNavigation] = useState(null)
  const [error, setError] = useState('')
  const [mode, setModeState] = useState('voiture')
  const [progress, setProgress] = useState(null)

  const watchId = useRef(null)
  const navigationRef = useRef(null)
  const reroutingRef = useRef(false)
  const trackingRef = useRef(false)

  useEffect(() => {
    navigationRef.current = navigation
  }, [navigation])

  useEffect(() => {
    trackingRef.current = tracking
  }, [tracking])

  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current)
  }, [])

  function stopWatch() {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }

  async function computeRoute(origin, nav, status) {
    reroutingRef.current = true
    setNavigation((current) => (current?.id === nav.id ? { ...current, status, error: '' } : current))

    try {
      const route = await getRoute(origin, nav.destination, nav.mode)
      if (navigationRef.current?.id !== nav.id) return
      // Guidage déjà lancé : on y reste ; sinon on montre d'abord l'aperçu du tracé.
      setNavigation((current) => (current?.id === nav.id
        ? { ...current, route, status: current.started ? 'guidage' : 'apercu', routedAt: Date.now(), error: '' }
        : current))
      navigationRef.current = { ...navigationRef.current, route, routedAt: Date.now() }
      setProgress(computeProgress(origin, route))
      if (status === 'calcul') {
        setFitRoute({ coordinates: [[origin.lat, origin.lng], ...route.coordinates], id: Date.now() })
      }
    } catch (routeError) {
      setNavigation((current) => (current?.id === nav.id ? { ...current, status: 'erreur', error: routeError.message } : current))
    } finally {
      reroutingRef.current = false
    }
  }

  // Appelé à chaque nouvelle position GPS (événement, pas un effet React).
  function handlePosition(geo) {
    const position = toPosition(geo)
    setUserPosition(position)
    setError('')

    const nav = navigationRef.current
    if (!nav?.route || nav.status === 'arrive') return

    if (distanceMeters([position.lat, position.lng], [nav.destination.lat, nav.destination.lng]) <= ARRIVAL_RADIUS_M) {
      setNavigation((current) => (current?.id === nav.id ? { ...current, status: 'arrive' } : current))
      setFollow(false)
      return
    }

    const nextProgress = computeProgress(position, nav.route)
    setProgress(nextProgress)
    const canReroute = !reroutingRef.current && Date.now() - (nav.routedAt || 0) > REROUTE_MIN_INTERVAL_MS
    if (nextProgress.remaining.offRoute > OFF_ROUTE_M && canReroute) computeRoute(position, nav, 'recalcul')
  }

  function ensureWatch() {
    if (watchId.current !== null || !navigator.geolocation) return
    watchId.current = navigator.geolocation.watchPosition(handlePosition, (watchError) => {
      setError(describeLocationError(watchError))
    }, WATCH_OPTIONS)
  }

  async function locate() {
    setError('')
    try {
      const position = await currentPosition()
      setUserPosition(position)
      setCenterRequest({ position, id: Date.now() })
    } catch (locationError) {
      setError(describeLocationError(locationError))
    }
  }

  function toggleTracking() {
    if (tracking) {
      setTracking(false)
      setFollow(false)
      if (!navigationRef.current) stopWatch()
      return
    }
    if (!navigator.geolocation) {
      setError('La géolocalisation n’est pas disponible sur ce navigateur.')
      return
    }
    setError('')
    ensureWatch()
    setTracking(true)
    setFollow(true)
  }

  async function start(terrain, travelMode = mode) {
    const nav = {
      id: Date.now(),
      terrain,
      destination: { lat: Number(terrain.latitude), lng: Number(terrain.longitude) },
      mode: travelMode,
      status: 'localisation',
      route: null,
      started: false,
      error: '',
    }
    setNavigation(nav)
    navigationRef.current = nav
    setFollow(false)
    setError('')

    try {
      const origin = await currentPosition()
      setUserPosition(origin)
      ensureWatch()
      await computeRoute(origin, nav, 'calcul')
    } catch (locationError) {
      setNavigation((current) => (current?.id === nav.id ? { ...current, status: 'erreur', error: describeLocationError(locationError) } : current))
    }
  }

  /** Lance le guidage : la carte suit la position jusqu'à l'arrivée. */
  function beginGuidance() {
    setNavigation((current) => (current ? { ...current, started: true, status: current.status === 'apercu' ? 'guidage' : current.status } : current))
    setFollow(true)
    if (userPosition) setCenterRequest({ position: userPosition, id: Date.now() })
  }

  function stop() {
    setNavigation(null)
    navigationRef.current = null
    setFitRoute(null)
    setProgress(null)
    setFollow(trackingRef.current)
    if (!trackingRef.current) stopWatch()
  }

  function setMode(nextMode) {
    setModeState(nextMode)
    const nav = navigationRef.current
    if (nav) start(nav.terrain, nextMode)
  }

  function retry() {
    const nav = navigationRef.current
    if (nav) start(nav.terrain, nav.mode)
  }

  function recenter() {
    setFollow(true)
    if (userPosition) setCenterRequest({ position: userPosition, id: Date.now() })
  }

  return {
    userPosition,
    tracking,
    follow,
    centerRequest,
    fitRoute,
    navigation,
    progress: navigation ? progress : null,
    error,
    mode,
    locate,
    toggleTracking,
    start,
    beginGuidance,
    stop,
    setMode,
    retry,
    recenter,
    pauseFollow: () => setFollow(false),
  }
}
