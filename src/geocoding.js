/**
 * Geocoding via Nominatim (OpenStreetMap).
 * Rate-limited to 1 request/second per OSM usage policy.
 */

const BASE = 'https://nominatim.openstreetmap.org';
const HEADERS = { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' };

// Bias results toward Rio de Janeiro metro area
const VIEWBOX = '-43.8,-23.1,-42.8,-22.7'; // W,S,E,N

let lastRequestTime = 0;

async function throttle() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1100) await new Promise(r => setTimeout(r, 1100 - elapsed));
  lastRequestTime = Date.now();
}

/**
 * Search for addresses matching a query string.
 * @returns {Array<{lat, lng, displayName}>}
 */
export async function searchAddress(query) {
  await throttle();
  const url = new URL(`${BASE}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('viewbox', VIEWBOX);
  url.searchParams.set('bounded', '0');
  url.searchParams.set('countrycodes', 'br');

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);

  const data = await res.json();
  return data.map(r => ({
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    displayName: r.display_name,
  }));
}

/**
 * Reverse geocode a lat/lng to a human-readable address.
 */
export async function reverseGeocode(lat, lng) {
  await throttle();
  const url = new URL(`${BASE}/reverse`);
  url.searchParams.set('lat', lat);
  url.searchParams.set('lon', lng);
  url.searchParams.set('format', 'jsonv2');

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Nominatim reverse error: ${res.status}`);
  const data = await res.json();
  return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
