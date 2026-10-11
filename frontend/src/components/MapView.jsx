import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Shows an approximate area (not a pin), matching "exact location is shared after booking".
export default function MapView({ coordinates, label }) {
  const el = useRef(null)

  useEffect(() => {
    if (!coordinates?.length || !el.current) return
    const [lng, lat] = coordinates
    const map = L.map(el.current, { scrollWheelZoom: false }).setView([lat, lng], 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    L.circle([lat, lng], { radius: 1500, color: '#e4572e', fillColor: '#e4572e', fillOpacity: 0.2, weight: 2 })
      .bindTooltip(label || 'Approximate area')
      .addTo(map)
    return () => map.remove()
  }, [coordinates, label])

  if (!coordinates?.length) return <p className="muted">Map unavailable for this listing.</p>
  return <div ref={el} className="map" role="img" aria-label={`Map of ${label}`} />
}
