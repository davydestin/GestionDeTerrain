import { readJson } from '../../services/api.js'

export const readResponse = (response) => readJson(response)

export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('fr-FR')} FCFA`
}

export function formatDateTime(value) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function primaryImage(terrain) {
  return terrain?.images?.find((image) => image.est_principale) || terrain?.images?.[0] || null
}

/** Ce qu'il manque pour qu'un terrain soit réservable par les clients. */
export function readinessChecklist(terrain) {
  return [
    { key: 'position', label: 'Placé sur la carte', done: Boolean(terrain.latitude && terrain.longitude), tab: 'informations' },
    { key: 'photos', label: 'Au moins une photo', done: (terrain.images?.length || 0) > 0, tab: 'photos' },
    { key: 'horaires', label: 'Horaires d’ouverture', done: (terrain.horaires_actifs_count || 0) > 0, tab: 'horaires' },
    { key: 'statut', label: 'En ligne (visible par les clients)', done: terrain.statut === 'ACTIF', tab: null },
  ]
}
