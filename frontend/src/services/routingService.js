/*
 * Calcul d'itinéraire (OSRM, données OpenStreetMap).
 * Plusieurs serveurs publics par profil : si le premier ne répond pas, le suivant prend le relais.
 * Ce sont des serveurs gratuits à usage raisonnable : l'application ne recalcule l'itinéraire
 * que lorsque l'utilisateur s'écarte du tracé (voir CarteTerrainsPage).
 */
const SERVERS = {
  voiture: [
    'https://router.project-osrm.org/route/v1/driving',
    'https://routing.openstreetmap.de/routed-car/route/v1/driving',
  ],
  pied: [
    'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  ],
}

const TIMEOUT_MS = 10_000

async function fetchRoute(baseUrl, origin, destination) {
  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${baseUrl}/${coordinates}?overview=full&geometries=geojson`, { signal: controller.signal })
    const payload = await response.json().catch(() => ({}))

    if (payload.code === 'NoRoute') {
      const error = new Error('Aucun itinéraire trouvé entre votre position et ce terrain.')
      error.final = true
      throw error
    }
    if (!response.ok || payload.code !== 'Ok' || !payload.routes?.[0]) {
      throw new Error('Réponse invalide du serveur d’itinéraire.')
    }

    const route = payload.routes[0]
    return {
      coordinates: route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]),
      distance: route.distance,
      duration: route.duration,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {{lat: number, lng: number}} origin
 * @param {{lat: number, lng: number}} destination
 * @param {'voiture'|'pied'} mode
 */
export async function getRoute(origin, destination, mode = 'voiture') {
  const servers = SERVERS[mode] || SERVERS.voiture
  let lastError = null

  for (const server of servers) {
    try {
      return await fetchRoute(server, origin, destination)
    } catch (error) {
      if (error.final) throw error
      lastError = error
    }
  }

  const error = new Error('Les serveurs d’itinéraire ne répondent pas pour le moment. Réessayez, ou ouvrez le trajet dans Google Maps.')
  error.cause = lastError
  throw error
}

/** Lien de navigation Google Maps (ouvre l'application sur téléphone). */
export function googleMapsDirectionsUrl(destination, mode = 'voiture', origin = null) {
  const params = new URLSearchParams({
    api: '1',
    destination: `${destination.lat},${destination.lng}`,
    travelmode: mode === 'pied' ? 'walking' : 'driving',
  })
  if (origin) params.set('origin', `${origin.lat},${origin.lng}`)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
