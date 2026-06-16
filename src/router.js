/**
 * Dijkstra-based router over the TransitNetwork graph.
 * Returns a RouteResult with step-by-step instructions and time breakdown.
 */

import { segmentTravelTimeS, expectedWaitS, walkTimeS } from './simulation.js';

/**
 * @param {TransitNetwork} network
 * @param {string} originNodeId
 * @param {string} destNodeId
 * @param {object} params - simulation parameters
 * @returns {RouteResult | null}
 */
export function findRoute(network, originNodeId, destNodeId, params) {
  if (originNodeId === destNodeId) {
    return { totalTimeS: 0, steps: [], path: [originNodeId] };
  }

  const adj = network.buildAdjacency();
  const dist = new Map();   // nodeId -> best time in seconds
  const prev = new Map();   // nodeId -> { nodeId, edge }
  const visited = new Set();

  for (const id of network.nodes.keys()) dist.set(id, Infinity);
  dist.set(originNodeId, 0);

  // Min-heap via naive priority queue (sufficient for MVP graph sizes)
  const pq = [{ id: originNodeId, cost: 0, currentLine: null }];

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const { id: u, cost: uCost, currentLine } = pq.shift();

    if (visited.has(u)) continue;
    visited.add(u);

    if (u === destNodeId) break;

    for (const edge of (adj.get(u) ?? [])) {
      const { to, distanceM, lineId } = edge;
      if (visited.has(to)) continue;

      // Time for this segment
      let segTime = segmentTravelTimeS(distanceM, params);

      // Add dwell time at arrival station
      segTime += params.dwellTimeS;

      // Add transfer penalty if switching lines
      const isTransfer = currentLine !== null && lineId !== currentLine;
      if (isTransfer) {
        segTime += params.transferPenaltyS;
        // Wait for next train on the new line
        segTime += expectedWaitS(params.headwayMin);
      }

      const newCost = uCost + segTime;
      if (newCost < dist.get(to)) {
        dist.set(to, newCost);
        prev.set(to, { from: u, edge, isTransfer });
        pq.push({ id: to, cost: newCost, currentLine: lineId });
      }
    }
  }

  if (dist.get(destNodeId) === Infinity) return null;

  // Reconstruct path
  const path = [];
  const edgeTrace = [];
  let cur = destNodeId;
  while (cur !== originNodeId) {
    const p = prev.get(cur);
    path.unshift(cur);
    edgeTrace.unshift(p);
    cur = p.from;
  }
  path.unshift(originNodeId);

  // Build steps
  const steps = buildSteps(network, path, edgeTrace, params);

  return {
    totalTimeS: dist.get(destNodeId),
    steps,
    path,
    pathCoords: path.map(id => {
      const n = network.nodes.get(id);
      return [n.lat, n.lng];
    }),
  };
}

function buildSteps(network, path, edgeTrace, params) {
  if (path.length < 2) return [];

  const steps = [];
  let currentLine = null;
  let lineStartIdx = 0;
  let lineDistM = 0;

  for (let i = 0; i < edgeTrace.length; i++) {
    const { edge, isTransfer } = edgeTrace[i];
    const node = network.nodes.get(path[i]);
    const nextNode = network.nodes.get(path[i + 1]);

    if (i === 0) {
      // Initial wait for first train
      steps.push({
        type: 'wait',
        description: `Aguardar trem (${edge.lineId}) em ${node.name ?? 'estação de origem'}`,
        timeS: expectedWaitS(params.headwayMin),
        lineId: edge.lineId,
        lineColor: edge.lineColor,
      });
      currentLine = edge.lineId;
      lineStartIdx = i;
    }

    lineDistM += edge.distanceM;

    const isLastEdge = i === edgeTrace.length - 1;
    const lineChanges = isLastEdge || edgeTrace[i + 1]?.isTransfer;

    if (lineChanges) {
      const travelTime = segmentTravelTimeS(lineDistM, params);
      const fromNode = network.nodes.get(path[lineStartIdx]);
      steps.push({
        type: 'ride',
        description: `Viajar via ${edge.lineId}: ${fromNode.name ?? 'partida'} → ${nextNode.name ?? 'chegada'}`,
        timeS: travelTime + params.dwellTimeS * (i - lineStartIdx + 1),
        distanceM: lineDistM,
        lineId: edge.lineId,
        lineColor: edge.lineColor,
      });

      if (!isLastEdge) {
        steps.push({
          type: 'transfer',
          description: `Baldeação em ${nextNode.name ?? 'estação'} para ${edgeTrace[i + 1].edge.lineId}`,
          timeS: params.transferPenaltyS + expectedWaitS(params.headwayMin),
        });
      }

      currentLine = isLastEdge ? null : edgeTrace[i + 1]?.edge.lineId;
      lineStartIdx = i + 1;
      lineDistM = 0;
    }
  }

  return steps;
}
