export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

const R = 6371 // km

/** Great-circle distance between two [lng, lat] points. */
export function haversineKm([lng1, lat1], [lng2, lat2]) {
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export const fmtKm = (km) => (km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString('en-IN')} km`)

export function fmtDuration(seconds) {
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Driving route via Mapbox Directions. Resolves to null when there is no token or no drivable route. */
export async function fetchRoute(from, to, signal) {
  if (!MAPBOX_TOKEN) return null
  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}` +
      `?geometries=geojson&overview=simplified&access_token=${MAPBOX_TOKEN}`
    const res = await fetch(url, { signal })
    const data = await res.json()
    const r = data.routes?.[0]
    return data.code === 'Ok' && r ? { km: r.distance / 1000, seconds: r.duration, coordinates: r.geometry.coordinates } : null
  } catch (err) {
    if (err.name === 'AbortError') throw err
    return null
  }
}

/** Approximate circle as a GeoJSON polygon (used to show an area, not an exact pin). */
export function circlePolygon([lng, lat], radiusKm, steps = 64) {
  const ring = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI
    const dLat = (radiusKm / R) * Math.cos(t)
    const dLng = ((radiusKm / R) * Math.sin(t)) / Math.cos((lat * Math.PI) / 180)
    ring.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } }
}
