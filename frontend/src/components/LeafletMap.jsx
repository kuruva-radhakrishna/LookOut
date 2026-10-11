import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Token-free fallback (OpenStreetMap tiles) used when VITE_MAPBOX_TOKEN isn't set. Same props as MapboxMap.
export default function LeafletMap({ coordinates, label, me, route }) {
  const el = useRef(null)
  const map = useRef(null)
  const overlay = useRef(null)

  useEffect(() => {
    const [lng, lat] = coordinates
    const m = L.map(el.current, { scrollWheelZoom: false }).setView([lat, lng], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    L.circle([lat, lng], { radius: 1500, color: '#e4572e', fillColor: '#e4572e', fillOpacity: 0.2, weight: 2 })
      .bindTooltip(`${label} (approximate area)`)
      .addTo(m)
    overlay.current = L.layerGroup().addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [coordinates, label])

  useEffect(() => {
    const m = map.current
    if (!m) return
    overlay.current.clearLayers()
    const [lng, lat] = coordinates
    if (!me) {
      m.setView([lat, lng], 11)
      return
    }
    const line = (route?.coordinates?.length ? route.coordinates : [me, coordinates]).map(([x, y]) => [y, x])
    L.polyline(line, { color: '#14213d', weight: 4, opacity: 0.85, dashArray: route ? undefined : '8 8' }).addTo(overlay.current)
    L.circleMarker([me[1], me[0]], { radius: 8, color: '#fff', weight: 3, fillColor: '#14213d', fillOpacity: 1 }).bindTooltip('You are here').addTo(overlay.current)
    m.fitBounds(L.latLngBounds(line), { padding: [40, 40] })
  }, [me, route, coordinates])

  return <div ref={el} className="map" role="img" aria-label={`Map of ${label}`} />
}
