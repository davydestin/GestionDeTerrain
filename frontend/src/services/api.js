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

  if (options.body && !headers.has('Content-Type')) {
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

export function getManagerCommunes() {
  return apiRequest('/api/gestionnaire/communes')
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

export function createPayment(reservationId, details) {
  return apiRequest(`/api/client/reservations/${reservationId}/paiements`, {
    method: 'POST',
    body: JSON.stringify(details),
  })
}

export function updateProfile(details) {
  return apiRequest('/api/user', {
    method: 'PATCH',
    body: JSON.stringify(details),
  })
}