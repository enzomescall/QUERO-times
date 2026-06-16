/**
 * Converts edge distance into travel time using kinematic simulation.
 *
 * Model:
 *  1. Acceleration phase: 0 → v_max at constant acceleration `a`
 *  2. Cruise at v_max (if segment is long enough)
 *  3. Deceleration phase: v_max → 0 at `a`
 *  4. Dwell time at destination station
 *
 * All time values returned in seconds unless noted.
 */

export function segmentTravelTimeS(distanceM, params) {
  const { trainSpeedKph, accelMs2 } = params;
  const vMax = trainSpeedKph / 3.6; // m/s

  // Distance needed to reach v_max and brake to 0
  const accelDist = (vMax * vMax) / (2 * accelMs2);
  const totalAccelDist = 2 * accelDist;

  let timeS;
  if (distanceM <= totalAccelDist) {
    // Never reaches v_max — triangle profile
    const peakV = Math.sqrt(distanceM * accelMs2);
    timeS = 2 * (peakV / accelMs2);
  } else {
    const accelTime = vMax / accelMs2;
    const cruiseDist = distanceM - totalAccelDist;
    const cruiseTime = cruiseDist / vMax;
    timeS = 2 * accelTime + cruiseTime;
  }

  return timeS;
}

/**
 * Estimate waiting time at a station given headway.
 * We assume a passenger arrives at a random point in the headway cycle,
 * so expected wait = headway / 2.
 */
export function expectedWaitS(headwayMin) {
  return (headwayMin * 60) / 2;
}

/** Walking time for a given distance */
export function walkTimeS(distanceM, walkSpeedKph) {
  return distanceM / (walkSpeedKph / 3.6);
}

/** Format seconds as "Xh Ymin" or "Ymin Zs" */
export function formatDuration(totalSeconds) {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${sec}s`;
  return `${sec}s`;
}
