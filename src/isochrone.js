/**
 * Isochrone computation — modified Dijkstra that finds all nodes reachable
 * from an origin within a given time budget.
 *
 * Cost model is identical to router.js:
 *   first boarding: wait (headway/2)
 *   same line:      segment travel time + dwell
 *   line change:    transfer penalty + wait (headway/2) + segment travel + dwell
 */

import { paramsForLine, segmentTravelTimeS, expectedWaitS } from './simulation.js';

/**
 * Returns a Map<nodeId, timeS> for every node reachable within maxTimeS seconds.
 * The origin node itself is included with timeS = 0.
 */
export function computeIsochrone(network, originNodeId, params, maxTimeS) {
  const adj = network.buildAdjacency();

  // dist tracks the best known time to reach each (nodeId, lineId) state
  const dist    = new Map();  // stateKey -> timeS
  const visited = new Set();

  // best time to reach each node (regardless of line state)
  const nodeBest = new Map();  // nodeId -> timeS

  const startKey = stateKey(originNodeId, null);
  dist.set(startKey, 0);
  nodeBest.set(originNodeId, 0);

  // Naive priority queue — adequate for ~400-node graphs
  const pq = [{ id: originNodeId, cost: 0, currentLine: null, key: startKey }];

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const { id: u, cost: uCost, currentLine, key: uKey } = pq.shift();

    if (visited.has(uKey)) continue;
    visited.add(uKey);

    // Prune: if this node is already over budget, no point expanding
    if (uCost > maxTimeS) continue;

    for (const edge of (adj.get(u) ?? [])) {
      const { to, distanceM, lineId } = edge;
      const lp = paramsForLine(lineId, params);

      const isFirstBoarding = currentLine === null;
      const isTransfer      = currentLine !== null && lineId !== currentLine;

      let waitOrTransferTime = 0;
      if (isFirstBoarding) {
        waitOrTransferTime = expectedWaitS(lp.headwayMin);
      } else if (isTransfer) {
        waitOrTransferTime = params.transferPenaltyS + expectedWaitS(lp.headwayMin);
      }

      const segmentTimeS = segmentTravelTimeS(distanceM, lp) + lp.dwellTimeS;
      const newCost = uCost + waitOrTransferTime + segmentTimeS;

      // Skip if over the time budget
      if (newCost > maxTimeS) continue;

      const toKey = stateKey(to, lineId);
      if (visited.has(toKey)) continue;

      if (newCost < (dist.get(toKey) ?? Infinity)) {
        dist.set(toKey, newCost);
        // Track the best time per node (across all line states)
        if (newCost < (nodeBest.get(to) ?? Infinity)) {
          nodeBest.set(to, newCost);
        }
        pq.push({ id: to, cost: newCost, currentLine: lineId, key: toKey });
      }
    }
  }

  return nodeBest;
}

function stateKey(nodeId, lineId) {
  return `${encodeURIComponent(nodeId)}|${lineId ?? ''}`;
}
