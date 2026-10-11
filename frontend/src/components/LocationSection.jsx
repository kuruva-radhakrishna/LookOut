import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Car, Loader2, LocateFixed, Navigation, Ruler } from 'lucide-react'
import LeafletMap from './LeafletMap'
import { MAPBOX_TOKEN, fetchRoute, fmtDuration, fmtKm, haversineKm } from '../lib/geo'

const MapboxMap = lazy(() => import('./MapboxMap')) // keeps the ~1.5 MB map library out of the main bundle

const GEO_ERRORS = {
  1: 'Location permission was denied. Allow it in your browser to see the distance.',
  2: "We couldn't work out your location. Try again.",
  3: 'Finding your location timed out. Try again.',
}

export default function LocationSection({ coordinates, label }) {
  const [me, setMe] = useState(null)
  const [route, setRoute] = useState(null)
  const [status, setStatus] = useState('idle') // idle | locating | routing | done | error
  const [error, setError] = useState('')
  const abort = useRef(null)

  useEffect(() => () => abort.current?.abort(), [])

  const straightKm = useMemo(() => (me && coordinates ? haversineKm(me, coordinates) : null), [me, coordinates])

  if (!coordinates?.length) return <p className="muted">Map unavailable for this listing.</p>

  function locate() {
    if (!navigator.geolocation) {
      setError("Your browser doesn't support location.")
      return setStatus('error')
    }
    setStatus('locating')
    setError('')
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const here = [coords.longitude, coords.latitude]
        setMe(here)
        setRoute(null)
        setStatus('routing')
        abort.current?.abort()
        abort.current = new AbortController()
        try {
          setRoute(await fetchRoute(here, coordinates, abort.current.signal))
          setStatus('done')
        } catch {
          /* aborted */
        }
      },
      (err) => {
        setError(GEO_ERRORS[err.code] || GEO_ERRORS[2])
        setStatus('error')
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    )
  }

  function clear() {
    abort.current?.abort()
    setMe(null)
    setRoute(null)
    setStatus('idle')
  }

  const busy = status === 'locating' || status === 'routing'
  const MapComponent = MAPBOX_TOKEN ? MapboxMap : LeafletMap

  return (
    <div>
      <div className="distance-bar">
        {!me ? (
          <button className="btn btn-ghost" onClick={locate} disabled={busy}>
            {busy ? <Loader2 className="spin" size={16} /> : <LocateFixed size={16} />}
            {status === 'locating' ? 'Finding you…' : 'Show distance from my location'}
          </button>
        ) : (
          <>
            <div className="distance-stats" aria-live="polite">
              <span>
                <Ruler size={16} /> <strong>{fmtKm(straightKm)}</strong> <span className="muted">in a straight line</span>
              </span>
              {status === 'routing' && (
                <span className="muted">
                  <Loader2 className="spin" size={14} /> Calculating drive…
                </span>
              )}
              {route && (
                <span>
                  <Car size={16} /> <strong>{fmtKm(route.km)}</strong> <span className="muted">by road · about</span> <strong>{fmtDuration(route.seconds)}</strong>
                </span>
              )}
              {status === 'done' && !route && MAPBOX_TOKEN && <span className="muted">No drivable route found from here (try flights or trains).</span>}
            </div>
            <button className="link-btn" onClick={clear}>
              Clear
            </button>
          </>
        )}
      </div>
      {status === 'error' && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!me && status !== 'error' && (
        <p className="hint">
          <Navigation size={12} /> Your location stays in your browser{MAPBOX_TOKEN ? '; it is only sent to Mapbox to calculate the drive.' : '.'}
        </p>
      )}

      <Suspense fallback={<div className="map skeleton" />}>
        <MapComponent coordinates={coordinates} label={label} me={me} route={route} />
      </Suspense>
    </div>
  )
}
