import { useCallback, useEffect, useRef } from 'react'
import { MapContainer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'
import LockViewToBounds from './LockViewToBounds.jsx'
import MapTiles from './MapTiles.jsx'

const dakarBounds = [[14.55, -17.55], [14.85, -17.10]]
const DAKAR_CITY_CENTER = [14.705, -17.455]

const terrainMarkerIcon = L.divIcon({
  className: 'terrain-pin',
  html: '<span></span>',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
})

const destinationIcon = L.divIcon({
  className: 'destination-pin',
  html: '<span></span>',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
})

const userLocationIcon = L.divIcon({
  className: 'user-location-pin',
  html: '<span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

/**
 * Déplacements de la carte demandés par la page :
 *  - `centerRequest` ({ position, id }) : recentrage ponctuel (« Me localiser », « Recentrer ») ;
 *  - `follow` : la carte accompagne chaque nouvelle position (suivi / itinéraire) ;
 *  - `fitRoute` ({ coordinates, id }) : cadrer tout l'itinéraire au démarrage.
 * Un glissement manuel de la carte appelle `onManualMove` (la page met alors le suivi en pause).
 */
function MapController({ userPosition, follow, centerRequest, fitRoute, onManualMove }) {
  const map = useMap()

  useMapEvents({
    dragstart: () => onManualMove?.(),
  })

  useEffect(() => {
    if (!centerRequest?.position) return
    map.setView([centerRequest.position.lat, centerRequest.position.lng], Math.max(map.getZoom(), 16), { animate: true })
  }, [map, centerRequest])

  useEffect(() => {
    if (!fitRoute?.coordinates?.length) return
    // Nouvel itinéraire : on referme la bulle éventuelle et on cadre tout le trajet.
    map.closePopup()
    map.fitBounds(L.latLngBounds(fitRoute.coordinates), { padding: [48, 48], maxZoom: 17 })
  }, [map, fitRoute])

  useEffect(() => {
    if (follow && userPosition) map.panTo([userPosition.lat, userPosition.lng], { animate: true, duration: 0.6 })
  }, [map, follow, userPosition])

  return null
}

function UserLocationMarker({ position }) {
  if (!position) return null

  return (
    <Marker icon={userLocationIcon} position={[position.lat, position.lng]} zIndexOffset={1000}>
      <Popup>Votre position actuelle</Popup>
    </Marker>
  )
}

function MapBoundsReporter({ onBoundsChange }) {
  const map = useMap()

  const reportBounds = useCallback(() => {
    const bounds = map.getBounds()

    onBoundsChange?.({
      south: Number(bounds.getSouth().toFixed(6)),
      north: Number(bounds.getNorth().toFixed(6)),
      west: Number(bounds.getWest().toFixed(6)),
      east: Number(bounds.getEast().toFixed(6)),
    })
  }, [map, onBoundsChange])

  useMapEvents(onBoundsChange ? { moveend: reportBounds } : {})

  useEffect(() => {
    if (onBoundsChange) map.whenReady(reportBounds)
  }, [map, onBoundsChange, reportBounds])

  return null
}

function TerrainMarker({ terrain, selected, openPopupWhenSelected = true, onRouteRequest, terrainBasePath = '/terrains' }) {
  const map = useMap()
  const markerRef = useRef(null)
  const openedOnce = useRef(false)
  const photo = terrain.images?.find((image) => image.est_principale) || terrain.images?.[0]
  const latitude = Number(terrain.latitude)
  const longitude = Number(terrain.longitude)

  // Terrain sélectionné (lien « voir sur la carte ») : on zoome dessus puis on ouvre la bulle,
  // une seule fois et après le rendu (l'ouvrir pendant le rendu pouvait déclencher une boucle de mises à jour).
  useEffect(() => {
    if (!selected || openedOnce.current) return undefined
    openedOnce.current = true
    map.setView([latitude, longitude], Math.max(map.getZoom(), 15), { animate: false })
    if (!openPopupWhenSelected) return undefined
    let opened = false
    const frame = requestAnimationFrame(() => {
      opened = true
      markerRef.current?.openPopup()
    })
    return () => {
      // Annulé avant l'ouverture (démontage, double passage du mode strict) : on autorise un nouvel essai.
      // Une fois ouverte, la bulle ne se rouvre plus d'elle-même (ex. à l'arrêt d'un itinéraire).
      if (!opened) {
        cancelAnimationFrame(frame)
        openedOnce.current = false
      }
    }
  }, [selected, openPopupWhenSelected, map, latitude, longitude])

  return (
    <Marker icon={terrainMarkerIcon} position={[latitude, longitude]} ref={markerRef}>
      <Popup autoPanPadding={[24, 24]} maxWidth={260} minWidth={200}>
        <div className="w-[min(14rem,60vw)] overflow-hidden">
          {photo && <img alt={terrain.nom} className="mb-2 h-28 w-full rounded-lg object-cover" src={photo.url} />}
          <strong className="block text-sm text-white">{terrain.nom}</strong>
          <span className="mt-1 block text-xs text-[#a3ad9f]">
            {[terrain.quartier, terrain.commune?.nom].filter(Boolean).join(' · ')}
          </span>
          <span className="mt-1 block text-xs text-[#a3ad9f]">{[terrain.adresse, terrain.ville].filter(Boolean).join(' · ')}</span>
          <span className="mt-2 block text-xs font-bold text-[#b6f23a]">
            {Number(terrain.tarif_horaire).toLocaleString('fr-FR')} FCFA / h
          </span>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onRouteRequest && (
              <button
                className="inline-flex items-center gap-1.5 rounded-full bg-[#ff6b4a] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#f05a39]"
                onClick={() => {
                  map.closePopup()
                  onRouteRequest(terrain)
                }}
                type="button"
              >
                <Icon className="size-3.5" name="map-pin" />
                Itinéraire
              </button>
            )}
            <Link className="inline-flex items-center gap-1 text-xs font-bold text-[#b6f23a]" to={`${terrainBasePath}/${terrain.id}`}>
              Détails <Icon className="size-3.5" name="arrow-right" />
            </Link>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

export default function DakarMap({
  terrains,
  onBoundsChange,
  selectedTerrainId,
  userPosition = null,
  follow = false,
  centerRequest = null,
  fitRoute = null,
  onManualMove,
  navigation = null,
  openSelectedPopup = true,
  onRouteRequest,
  // Préfixe des fiches ouvertes depuis la bulle d'un terrain (/client/terrains dans l'espace client).
  terrainBasePath = '/terrains',
}) {
  return (
    <MapContainer
      // Vue initiale sur la ville (Plateau, Médina, Fann…), là où sont les terrains ; la zone autorisée
      // va jusqu'à Rufisque, son centre géométrique tomberait sur Thiaroye.
      center={DAKAR_CITY_CENTER}
      zoom={13}
      className="h-full w-full bg-[#11160f]"
      maxBoundsViscosity={1}
      scrollWheelZoom
    >
      {/* Pendant un itinéraire, la carte n'est plus limitée à Dakar (départ possible depuis l'extérieur). */}
      <LockViewToBounds bounds={dakarBounds} enabled={!navigation} />
      <MapTiles />
      <MapBoundsReporter onBoundsChange={onBoundsChange} />
      <MapController centerRequest={centerRequest} fitRoute={fitRoute} follow={follow} onManualMove={onManualMove} userPosition={userPosition} />

      {navigation?.route && (
        <>
          {/* Tracé complet estompé, partie restante en avant. */}
          <Polyline pathOptions={{ color: '#ff6b4a', opacity: 0.25, weight: 7 }} positions={navigation.route.coordinates} />
          <Polyline pathOptions={{ color: '#ff6b4a', opacity: 0.95, weight: 6 }} positions={navigation.remaining?.coordinates || navigation.route.coordinates} />
          {navigation.remaining?.offRoute > 15 && userPosition && navigation.remaining.coordinates[0] && (
            // Écart entre la position réelle et le tracé : liaison en pointillés.
            <Polyline pathOptions={{ color: '#ff6b4a', dashArray: '4 8', weight: 3 }} positions={[[userPosition.lat, userPosition.lng], navigation.remaining.coordinates[0]]} />
          )}
        </>
      )}
      {navigation?.destination && (
        <Marker icon={destinationIcon} position={[navigation.destination.lat, navigation.destination.lng]} zIndexOffset={900} />
      )}

      <UserLocationMarker position={userPosition} />
      {terrains.map((terrain) => (
        <TerrainMarker
          key={terrain.id}
          onRouteRequest={onRouteRequest}
          openPopupWhenSelected={openSelectedPopup}
          terrainBasePath={terrainBasePath}
          selected={String(terrain.id) === String(selectedTerrainId)}
          terrain={terrain}
        />
      ))}
    </MapContainer>
  )
}
