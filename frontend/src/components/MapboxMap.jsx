import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAPBOX_TOKEN, circlePolygon } from '../lib/geo'

const ACCENT = '#e4572e'

// Mapbox GL map: approximate area for the listing, plus the guest's position and route when known.
export default function MapboxMap({ coordinates, label, me, route }) {
  // Depend on the numbers, not the array: the parent re-creates the array on every reload (e.g. after a review is
  // posted), and rebuilding the whole map for an identical position is wasteful and races the effect below.
  const [lng, lat] = coordinates
  const pos = useMemo(() => [lng, lat], [lng, lat])
  const el = useRef(null)
  const mapRef = useRef(null)
  const meMarker = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({ container: el.current, style: 'mapbox://styles/mapbox/streets-v12', center: pos, zoom: 10.5, cooperativeGestures: true })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      map.addSource('area', { type: 'geojson', data: circlePolygon(pos, 1.5) })
      map.addLayer({ id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': ACCENT, 'fill-opacity': 0.2 } })
      map.addLayer({ id: 'area-line', type: 'line', source: 'area', paint: { 'line-color': ACCENT, 'line-width': 2 } })
      map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#14213d', 'line-width': 4, 'line-opacity': 0.85 } })
      setReady(true)
    })
    new mapboxgl.Marker({ color: ACCENT }).setLngLat(pos).setPopup(new mapboxgl.Popup({ offset: 24 }).setText(`${label} (approximate area)`)).addTo(map)
    return () => {
      setReady(false)
      map.remove()
    }
  }, [pos, label])

  useEffect(() => {
    const map = mapRef.current
    // `ready` can be stale for a moment when the map was just rebuilt, so also check the style really has its sources
    if (!ready || !map || !map.getSource('route')) return
    meMarker.current?.remove()
    meMarker.current = null
    const line = me ? (route?.coordinates?.length ? route.coordinates : [me, pos]) : null
    map.getSource('route').setData(line ? { type: 'Feature', geometry: { type: 'LineString', coordinates: line } } : { type: 'FeatureCollection', features: [] })
    if (me) {
      meMarker.current = new mapboxgl.Marker({ color: '#14213d' }).setLngLat(me).setPopup(new mapboxgl.Popup({ offset: 24 }).setText('You are here')).addTo(map)
      const bounds = line.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(line[0], line[0]))
      map.fitBounds(bounds, { padding: 60, duration: 800 })
    } else {
      map.flyTo({ center: pos, zoom: 10.5 })
    }
  }, [ready, me, route, pos])

  return <div ref={el} className="map" role="img" aria-label={`Map of ${label}`} />
}
