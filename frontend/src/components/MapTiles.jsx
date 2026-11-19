import { useRef, useState } from 'react'
import { TileLayer } from 'react-leaflet'

/*
 * Fond de carte avec bascule automatique.
 * Certains réseaux coupent le HTTP/3 (QUIC) utilisé par les tuiles OpenStreetMap
 * (erreurs ERR_QUIC_PROTOCOL_ERROR) : après quelques échecs, on passe sur CARTO,
 * un fond OSM servi par un autre réseau. Le style sombre est appliqué en CSS
 * (.leaflet-tile-pane) et convient aux deux fonds clairs.
 */
const PROVIDERS = [
  {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; contributeurs OpenStreetMap',
    maxZoom: 19,
  },
  {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; contributeurs OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  },
]

const ERRORS_BEFORE_FALLBACK = 4

export default function MapTiles() {
  const [providerIndex, setProviderIndex] = useState(0)
  const errorCount = useRef(0)
  const provider = PROVIDERS[providerIndex]

  function handleTileError() {
    if (providerIndex >= PROVIDERS.length - 1) return
    errorCount.current += 1

    if (errorCount.current >= ERRORS_BEFORE_FALLBACK) {
      errorCount.current = 0
      setProviderIndex((index) => Math.min(index + 1, PROVIDERS.length - 1))
    }
  }

  return (
    <TileLayer
      attribution={provider.attribution}
      eventHandlers={{ tileerror: handleTileError }}
      key={provider.url}
      maxZoom={provider.maxZoom}
      subdomains={provider.subdomains || 'abc'}
      url={provider.url}
    />
  )
}
