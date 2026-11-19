const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

function getXsrfToken() {
  const cookie = document.cookie
    .split('; ')
    .find((value) => value.startsWith('XSRF-TOKEN='))

  return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : null
}

export async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const headers = new Headers(options.headers)

  headers.set('Accept', 'application/json')

  // Pour un FormData (envoi de photos), le navigateur pose lui-même le multipart et sa frontière.
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = getXsrfToken()

    if (token) {
      headers.set('X-XSRF-TOKEN', token)
    }
  }

  return fetch(`${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  })
}

/**
 * Lit la réponse JSON de l'API ; en cas d'erreur, lève une Error portant
 * le premier message de validation Laravel, sinon `message`, sinon le message par défaut.
 */
export async function readJson(response, fallbackMessage = 'Une erreur est survenue.') {
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const validationMessage = Object.values(payload.errors || {}).flat()[0]
    const error = new Error(validationMessage || payload.message || fallbackMessage)
    error.status = response.status
    error.errors = payload.errors || {}
    throw error
  }

  return payload
}

export async function initializeCsrf() {
  const response = await apiRequest('/sanctum/csrf-cookie')

  if (!response.ok) {
    throw new Error('Impossible d’initialiser la session CSRF.')
  }
}

export function roleData(role) {
  const endpoints = {
    CLIENT: '/api/client/reservations',
    GESTIONNAIRE: '/api/gestionnaire/terrains',
    ADMINISTRATEUR: '/api/admin/users',
  }

  const endpoint = endpoints[role]

  if (!endpoint) {
    throw new Error('Rôle utilisateur inconnu.')
  }

  return apiRequest(endpoint)
}

export function updateUserRole(userId, role) {
  return apiRequest(`/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

export function createAdminUser(details) {
  return apiRequest('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(details),
  })
}

export function updateAdminUser(userId, details) {
  return apiRequest(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(details),
  })
}

export function deleteAdminUser(userId) {
  return apiRequest(`/api/admin/users/${userId}`, { method: 'DELETE' })
}

export function getManagerCommunes() {
  return apiRequest('/api/gestionnaire/communes')
}

// Recherche en texte libre (barre de recherche de la carte), limitée à Dakar.
export function searchPlaces(text) {
  return apiRequest('/api/gestionnaire/geocode', {
    method: 'POST',
    body: JSON.stringify({ q: text }),
  })
}

// Position du repère → adresse lisible (rue, quartier, commune).
export function reverseGeocode(latitude, longitude) {
  return apiRequest(`/api/gestionnaire/geocode/reverse?${toQueryString({ latitude, longitude })}`)
}

// ───────────── Espace gestionnaire : terrains, photos, horaires, indisponibilités

export function getManagedTerrains(filters = {}) {
  return apiRequest(`/api/gestionnaire/terrains?${toQueryString(filters)}`)
}

export function getManagedTerrain(terrainId) {
  return apiRequest(`/api/gestionnaire/terrains/${terrainId}`)
}

export function deleteTerrain(terrainId) {
  return apiRequest(`/api/gestionnaire/terrains/${terrainId}`, { method: 'DELETE' })
}

export function uploadTerrainImages(terrainId, files) {
  const body = new FormData()
  files.forEach((file) => body.append('images[]', file))

  return apiRequest(`/api/gestionnaire/terrains/${terrainId}/images`, { method: 'POST', body })
}

export function setPrimaryTerrainImage(terrainId, imageId) {
  return apiRequest(`/api/gestionnaire/terrains/${terrainId}/images/${imageId}/principal`, { method: 'PATCH' })
}

export function deleteTerrainImage(terrainId, imageId) {
  return apiRequest(`/api/gestionnaire/terrains/${terrainId}/images/${imageId}`, { method: 'DELETE' })
}

export function getTerrainHoraires(terrainId) {
  return apiRequest(`/api/gestionnaire/terrains/${terrainId}/horaires`)
}

export function createTerrainHoraire(terrainId, details) {
  return apiRequest(`/api/gestionnaire/terrains/${terrainId}/horaires`, {
    method: 'POST',
    body: JSON.stringify(details),
  })
}

export function updateTerrainHoraire(terrainId, horaireId, details) {
  return apiRequest(`/api/gestionnaire/terrains/${terrainId}/horaires/${horaireId}`, {
    method: 'PUT',
    body: JSON.stringify(details),
  })
}

export function deleteTerrainHoraire(terrainId, horaireId) {
  return apiRequest(`/api/gestionnaire/terrains/${terrainId}/horaires/${horaireId}`, { method: 'DELETE' })
}

export function getTerrainIndisponibilites(terrainId) {
  return apiRequest(`/api/gestionnaire/terrains/${terrainId}/indisponibilites`)
}

export function createTerrainIndisponibilite(terrainId, details) {
  return apiRequest(`/api/gestionnaire/terrains/${terrainId}/indisponibilites`, {
    method: 'POST',
    body: JSON.stringify(details),
  })
}

export function deleteTerrainIndisponibilite(terrainId, indisponibiliteId) {
  return apiRequest(`/api/gestionnaire/terrains/${terrainId}/indisponibilites/${indisponibiliteId}`, { method: 'DELETE' })
}

export function updateTerrain(terrainId, details) {
  return apiRequest(`/api/gestionnaire/terrains/${terrainId}`, {
    method: 'PATCH',
    body: JSON.stringify(details),
  })
}

export function createTerrain(details) {
  return apiRequest('/api/gestionnaire/terrains', {
    method: 'POST',
    body: JSON.stringify(details),
  })
}

export function getAdminUsers(filters = {}) {
  const query = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) {
      query.set(key, value)
    }
  })

  return apiRequest(`/api/admin/users?${query.toString()}`)
}

// Journal d'audit (lecture seule) : search, categorie, action, role, du, au (AAAA-MM-JJ), page.
export function getAuditLog(filters = {}) {
  return apiRequest(`/api/admin/journal?${toQueryString(filters)}`)
}

// Logs techniques Laravel (lecture seule) : fichier, niveau, environnement, search, page.
export function getAdminLogs(filters = {}) {
  return apiRequest(`/api/admin/logs?${toQueryString(filters)}`)
}

function toQueryString(params) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) {
      query.set(key, value)
    }
  })

  return query.toString()
}

export function getPublicTerrains(filters = {}) {
  return apiRequest(`/api/terrains?${toQueryString(filters)}`)
}

// Accueil : tous les terrains (même pour un gestionnaire), avec `est_a_moi` pour les siens.
export function getFeaturedTerrains() {
  return apiRequest('/api/terrains/a-la-une')
}

export function getMapTerrains(params = {}) {
  return apiRequest(`/api/terrains/map?${toQueryString(params)}`)
}

export function getNearbyTerrains(params) {
  return apiRequest(`/api/terrains/nearby?${toQueryString(params)}`)
}

export function getPublicTerrain(terrainId) {
  return apiRequest(`/api/terrains/${terrainId}`)
}

export function getCommunes() {
  return apiRequest('/api/communes')
}

export function getTerrainAvailability(terrainId, date) {
  return apiRequest(`/api/terrains/${terrainId}/disponibilites?${toQueryString({ date })}`)
}

export function createReservation(details) {
  return apiRequest('/api/client/reservations', {
    method: 'POST',
    body: JSON.stringify(details),
  })
}

export function cancelReservation(reservationId) {
  return apiRequest(`/api/client/reservations/${reservationId}/annuler`, { method: 'POST' })
}

// ───────────── Notifications (cloche de l'en-tête)

export function getNotifications() {
  return apiRequest('/api/notifications')
}

export function markNotificationRead(notificationId) {
  return apiRequest(`/api/notifications/${notificationId}/lu`, { method: 'PATCH' })
}

export function markAllNotificationsRead() {
  return apiRequest('/api/notifications/lu', { method: 'PATCH' })
}

// ───────────── Demandes de réservation reçues par le gestionnaire
// Pas de paiement dans l'application : après validation, le gestionnaire écrit au client sur WhatsApp.

export function getManagedReservations(filters = {}) {
  return apiRequest(`/api/gestionnaire/reservations?${toQueryString(filters)}`)
}

export function confirmReservation(reservationId) {
  return apiRequest(`/api/gestionnaire/reservations/${reservationId}/confirmer`, { method: 'POST' })
}

export function refuseReservation(reservationId, motif) {
  return apiRequest(`/api/gestionnaire/reservations/${reservationId}/refuser`, {
    method: 'POST',
    body: JSON.stringify({ motif: motif || null }),
  })
}

/** etat : 'DISPONIBLE' | 'INDISPONIBLE' ; sans `jusqu_au`, INDISPONIBLE masque le terrain jusqu'à nouvel ordre. */
export function setTerrainAvailability(terrainId, details) {
  return apiRequest(`/api/gestionnaire/terrains/${terrainId}/disponibilite`, {
    method: 'PUT',
    body: JSON.stringify(details),
  })
}

export function updateProfile(details) {
  return apiRequest('/api/user', {
    method: 'PATCH',
    body: JSON.stringify(details),
  })
}
