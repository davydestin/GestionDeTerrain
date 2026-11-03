import { useCallback, useEffect, useRef } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { Link } from 'react-router-dom'

const dakarBounds = [[14.55, -17.55], [14.85, -17.10]]

const terrainMarkerIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIconRetina,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

function MapBoundsReporter({ onBoundsChange }) {
  const map = useMap()

  const reportBounds = useCallback(() => {
    const bounds = map.getBounds()

    onBoundsChange({
      south: Number(bounds.getSouth().toFixed(6)),
      north: Number(bounds.getNorth().toFixed(6)),
      west: Number(bounds.getWest().toFixed(6)),
      east: Number(bounds.getEast().toFixed(6)),
    })
  }, [map, onBoundsChange])

  useMapEvents({ moveend: reportBounds })

  useEffect(() => {
    map.whenReady(reportBounds)
  }, [map, onBoundsChange])

  return null
}

function TerrainMarker({ terrain, selected }) {
  const markerRef = useRef(null)
  const photo = terrain.images?.find((image) => image.est_principale) || terrain.images?.[0]

  useEffect(() => {
    if (selected) markerRef.current?.openPopup()
  }, [selected])

  return (
    <Marker
      icon={terrainMarkerIcon}
      position={[Number(terrain.latitude), Number(terrain.longitude)]}
      ref={markerRef}
    >
      <Popup minWidth={220}>
        <div className="w-56 overflow-hidden rounded-sm">
          {photo && <img alt={terrain.nom} className="mb-2 h-28 w-full object-cover" src={photo.url} />}
          <strong className="block text-sm">{terrain.nom}</strong>
          <span className="mt-1 block text-xs text-[#66736a]">
            {[terrain.quartier, terrain.commune?.nom].filter(Boolean).join(' · ')}
          </span>
          <span className="mt-2 block text-xs font-bold text-[#2f7259]">
            {Number(terrain.tarif_horaire).toLocaleString('fr-FR')} FCFA / h
          </span>
          <Link className="mt-2 inline-block text-xs font-bold text-[#2f7259]" to={`/terrains/${terrain.id}`}>
            Détails du terrain →
          </Link>
        </div>
      </Popup>
    </Marker>
  )
}

export default function DakarMap({ terrains, onBoundsChange, selectedTerrainId }) {
  return (
    <MapContainer
      bounds={dakarBounds}
      className="h-full min-h-[480px] w-full"
      maxBounds={dakarBounds}
      maxBoundsViscosity={0.75}
      scrollWheelZoom
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        maxZoom={19}
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapBoundsReporter onBoundsChange={onBoundsChange} />
      {terrains.map((terrain) => (
        <TerrainMarker
          key={terrain.id}
          selected={String(terrain.id) === String(selectedTerrainId)}
          terrain={terrain}
        />
      ))}
    </MapContainer>
  )
}
