import { MapContainer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import MapTiles from './MapTiles.jsx'

// Même repère que sur la carte des terrains (style .terrain-pin dans app.css).
const terrainMarkerIcon = L.divIcon({
  className: 'terrain-pin',
  html: '<span></span>',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
})

/**
 * Petite carte de la fiche d'un terrain : centrée sur le terrain, avec son repère.
 * La molette ne zoome pas (sinon la page s'arrête de défiler au passage de la carte) ;
 * les boutons + / − et le pincement restent disponibles.
 */
export default function TerrainLocationMap({ terrain }) {
  const latitude = Number(terrain.latitude)
  const longitude = Number(terrain.longitude)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  const position = [latitude, longitude]

  return (
    <div className="relative isolate h-64 overflow-hidden rounded-3xl border border-white/10 bg-[#11160f] sm:h-80">
      <MapContainer center={position} className="h-full w-full bg-[#11160f]" scrollWheelZoom={false} zoom={16}>
        <MapTiles />
        <Marker icon={terrainMarkerIcon} position={position}>
          <Popup>
            <strong className="block text-sm text-white">{terrain.nom}</strong>
            <span className="mt-1 block text-xs text-[#a3ad9f]">{[terrain.adresse, terrain.quartier].filter(Boolean).join(' · ')}</span>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}
