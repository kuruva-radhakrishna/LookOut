const env = require("../config/env");

// Returns a GeoJSON Point or null. Uses Mapbox when a token is configured, otherwise OpenStreetMap Nominatim.
async function geocode(query) {
  try {
    if (env.mapboxToken) {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&access_token=${env.mapboxToken}`;
      const res = await fetch(url);
      const body = await res.json();
      return body.features?.[0]?.geometry || null;
    }
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "User-Agent": "LookOut/2.0 (stay booking demo)" } });
    const [hit] = await res.json();
    return hit ? { type: "Point", coordinates: [Number(hit.lon), Number(hit.lat)] } : null;
  } catch {
    return null; // a failed geocode should never block creating a listing
  }
}

module.exports = { geocode };
