/**
 * Converts edge distance into travel time using kinematic simulation.
 *
 * Model:
 *  1. Acceleration phase: 0 → v_max at constant acceleration `a`
 *  2. Cruise at v_max (if segment is long enough)
 *  3. Deceleration phase: v_max → 0 at `a`
 *
 * All time values returned in seconds unless noted.
 */

/** Express lines use lettered identifiers (A–E). */
export function isExpressLine(lineId) {
  return /^[A-Ea-e]$/.test(String(lineId));
}

/**
 * Pick the right speed/headway/dwell params for a given line.
 * Values come from the sidebar inputs (already loaded with GeoJSON defaults).
 */
export function paramsForLine(lineId, params) {
  return isExpressLine(lineId)
    ? {
        trainSpeedKph: params.expressSpeedKph,
        accelMs2:      params.accelMs2,
        dwellTimeS:    params.expressDwellTimeS,
        headwayMin:    params.expressHeadwayMin,
      }
    : {
        trainSpeedKph: params.trainSpeedKph,
        accelMs2:      params.accelMs2,
        dwellTimeS:    params.dwellTimeS,
        headwayMin:    params.headwayMin,
      };
}

export function segmentTravelTimeS(distanceM, lineParams) {
  const { trainSpeedKph, accelMs2 } = lineParams;
  const vMax = trainSpeedKph / 3.6; // m/s

  const accelDist      = (vMax * vMax) / (2 * accelMs2);
  const totalAccelDist = 2 * accelDist;

  if (distanceM <= totalAccelDist) {
    const peakV = Math.sqrt(distanceM * accelMs2);
    return 2 * (peakV / accelMs2);
  }

  const accelTime  = vMax / accelMs2;
  const cruiseTime = (distanceM - totalAccelDist) / vMax;
  return 2 * accelTime + cruiseTime;
}

/** Expected wait at a station = headway / 2 (uniform random arrival). */
export function expectedWaitS(headwayMin) {
  return (headwayMin * 60) / 2;
}

export function walkTimeS(distanceM, walkSpeedKph) {
  return distanceM / (walkSpeedKph / 3.6);
}

/** Format seconds as "Xh Ymin" or "Ymin Zs". */
export function formatDuration(totalSeconds) {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${sec}s`;
  return `${sec}s`;
}
