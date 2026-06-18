/**
 * Real-world travel time comparisons via OSRM public routing API.
 * Used to show the delta between QUERO and current-day driving times.
 */

const OSRM = 'https://router.project-osrm.org/route/v1';

/**
 * Fetch driving time in seconds between two lat/lng points.
 * Uses the OSRM public demo server — no API key required.
 * Throws on network error or if OSRM returns no route.
 */
export async function fetchDrivingTimeS(oLat, oLng, dLat, dLng) {
  const url = `${OSRM}/driving/${oLng},${oLat};${dLng},${dLat}?overview=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('OSRM: no route found');
  return data.routes[0].duration;
}
