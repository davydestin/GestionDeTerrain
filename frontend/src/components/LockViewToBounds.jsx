import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/*
 * Garde la vue à l'intérieur d'une zone (Dakar), sans jamais la dépasser.
 *
 * Sans cela, sur un grand écran, la vue d'ensemble déborde de Dakar : Leaflet la recentre
 * en permanence, et une bulle ouverte la redéplace pour rester visible → la carte « boucle ».
 * On fixe donc le zoom minimal au niveau où la vue tient entièrement dans la zone,
 * recalculé à chaque redimensionnement (rotation du téléphone, fenêtre agrandie…).
 *
 * `enabled = false` lève la contrainte (ex. itinéraire depuis une position hors de Dakar).
 */
export default function LockViewToBounds({ bounds, enabled = true }) {
  const map = useMap()

  useEffect(() => {
    if (!enabled) {
      map.setMaxBounds(null)
      map.setMinZoom(3)
      return undefined
    }

    const lock = () => {
      const minZoom = map.getBoundsZoom(bounds, true)
      map.setMinZoom(minZoom)
      if (map.getZoom() < minZoom) map.setZoom(minZoom, { animate: false })
    }

    map.setMaxBounds(bounds)
    lock()
    map.on('resize', lock)
    return () => {
      map.off('resize', lock)
    }
  }, [map, bounds, enabled])

  return null
}
