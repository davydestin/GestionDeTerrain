/*
 * Petits calculs géographiques pour le suivi d'itinéraire (distances en mètres).
 * Les points sont des tableaux [latitude, longitude] (format Leaflet).
 */
const EARTH_RADIUS = 6_371_000
const toRad = (degrees) => (degrees * Math.PI) / 180

export function distanceMeters([lat1, lng1], [lat2, lng2]) {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Projection plane locale (suffisante à l'échelle d'une ville) : mètres autour d'un point de référence.
function project([lat, lng], refLat) {
  const x = toRad(lng) * EARTH_RADIUS * Math.cos(toRad(refLat))
  const y = toRad(lat) * EARTH_RADIUS
  return [x, y]
}

/**
 * Point du tracé le plus proche d'une position.
 * @returns {{ distance: number, segment: number, ratio: number }} distance au tracé, segment concerné et position sur ce segment (0..1)
 */
export function closestPointOnRoute(position, route) {
  let best = { distance: Infinity, segment: 0, ratio: 0 }
  const [px, py] = project(position, position[0])

  for (let index = 0; index < route.length - 1; index++) {
    const [ax, ay] = project(route[index], position[0])
    const [bx, by] = project(route[index + 1], position[0])
    const dx = bx - ax
    const dy = by - ay
    const lengthSquared = dx * dx + dy * dy
    const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
    const distance = Math.hypot(px - (ax + ratio * dx), py - (ay + ratio * dy))
    if (distance < best.distance) best = { distance, segment: index, ratio }
  }

  return best
}

/** Partie du tracé restant à parcourir depuis la position (commence au point projeté sur le tracé). */
export function remainingRoute(position, route) {
  if (route.length < 2) return { coordinates: route, distance: 0, offRoute: 0 }

  const { distance: offRoute, segment, ratio } = closestPointOnRoute(position, route)
  const [aLat, aLng] = route[segment]
  const [bLat, bLng] = route[segment + 1]
  const start = [aLat + (bLat - aLat) * ratio, aLng + (bLng - aLng) * ratio]
  const coordinates = [start, ...route.slice(segment + 1)]

  let distance = 0
  for (let index = 0; index < coordinates.length - 1; index++) distance += distanceMeters(coordinates[index], coordinates[index + 1])

  return { coordinates, distance, offRoute }
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`
  return `${(meters / 1000).toLocaleString('fr-FR', { maximumFractionDigits: meters < 10_000 ? 1 : 0 })} km`
}

export function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`
}
