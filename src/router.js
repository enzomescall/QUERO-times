/**
 * Dijkstra-based router over the TransitNetwork graph.
 * Returns a RouteResult with step-by-step instructions, timing, and
 * per-segment path geometry (following actual track coordinates).
 */

import { segmentTravelTimeS, expectedWaitS, paramsForLine } from './simulation.js';

export function findRoute(network, originNodeId, destNodeId, params) {
  if (originNodeId === destNodeId) {
    return { totalTimeS: 0, steps: [], pathSegments: [] };
  }

  const adj = network.buildAdjacency();
  const dist    = new Map();  // nodeId -> best time (seconds)
  const prev    = new Map();  // nodeId -> { from, edge, isTransfer }
  const visited = new Set();

  for (const id of network.nodes.keys()) dist.set(id, Infinity);
  dist.set(originNodeId, 0);

  // Naive priority queue — adequate for ~400-node graphs
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

      const lp = paramsForLine(lineId, params);

      let segTime = segmentTravelTimeS(distanceM, lp) + lp.dwellTimeS;

      const isTransfer = currentLine !== null && lineId !== currentLine;
      if (isTransfer) {
        segTime += params.transferPenaltyS + expectedWaitS(lp.headwayMin);
      }

      const newCost = uCost + segTime;
      if (newCost < (dist.get(to) ?? Infinity)) {
        dist.set(to, newCost);
        prev.set(to, { from: u, edge, isTransfer });
        pq.push({ id: to, cost: newCost, currentLine: lineId });
      }
    }
  }

  if ((dist.get(destNodeId) ?? Infinity) === Infinity) return null;

  // Reconstruct edge trace
  const path      = [];
  const edgeTrace = [];
  let cur = destNodeId;
  while (cur !== originNodeId) {
    const p = prev.get(cur);
    path.unshift(cur);
    edgeTrace.unshift(p);
    cur = p.from;
  }
  path.unshift(originNodeId);

  return {
    totalTimeS:   dist.get(destNodeId),
    steps:        buildSteps(network, path, edgeTrace, params),
    pathSegments: buildPathSegments(edgeTrace),
  };
}

// ── Path geometry ──────────────────────────────────────────────────────────

/**
 * Merge edge geometries into contiguous colored segments.
 * Consecutive edges on the same line are merged into one segment.
 * Returns [{lineId, lineColor, coords: [[lat,lng],...]}]
 */
function buildPathSegments(edgeTrace) {
  const segments = [];
  let current = null;

  for (const { edge } of edgeTrace) {
    const edgeCoords = edge.coords ?? [];

    if (!current || current.lineId !== edge.lineId) {
      current = { lineId: edge.lineId, lineColor: edge.lineColor, coords: [] };
      segments.push(current);
    }

    // Append, skipping the first coord if it duplicates the last already stored
    const skip = current.coords.length > 0 ? 1 : 0;
    current.coords.push(...edgeCoords.slice(skip));
  }

  return segments;
}

// ── Step descriptions ──────────────────────────────────────────────────────

function buildSteps(network, path, edgeTrace, params) {
  if (path.length < 2) return [];

  const steps = [];
  let currentLine  = null;
  let lineStartIdx = 0;
  let lineDistM    = 0;

  for (let i = 0; i < edgeTrace.length; i++) {
    const { edge, isTransfer } = edgeTrace[i];
    const node     = network.nodes.get(path[i]);
    const nextNode = network.nodes.get(path[i + 1]);

    if (i === 0) {
      const lp = paramsForLine(edge.lineId, params);
      steps.push({
        type: 'wait',
        description: `Aguardar ${lineLabel(edge.lineId)} em ${node.name ?? 'estação de origem'}`,
        timeS: expectedWaitS(lp.headwayMin),
        lineId:    edge.lineId,
        lineColor: edge.lineColor,
      });
      currentLine  = edge.lineId;
      lineStartIdx = i;
    }

    lineDistM += edge.distanceM;

    const isLastEdge  = i === edgeTrace.length - 1;
    const lineChanges = isLastEdge || edgeTrace[i + 1]?.isTransfer;

    if (lineChanges) {
      const lp        = paramsForLine(edge.lineId, params);
      const stopCount = i - lineStartIdx + 1;
      const travelTime = segmentTravelTimeS(lineDistM, lp) + lp.dwellTimeS * stopCount;
      const fromNode  = network.nodes.get(path[lineStartIdx]);

      steps.push({
        type: 'ride',
        description: `${lineLabel(edge.lineId)}: ${fromNode.name ?? 'partida'} → ${nextNode.name ?? 'chegada'}`,
        timeS:     travelTime,
        distanceM: lineDistM,
        lineId:    edge.lineId,
        lineColor: edge.lineColor,
      });

      if (!isLastEdge) {
        const nextLp = paramsForLine(edgeTrace[i + 1].edge.lineId, params);
        steps.push({
          type: 'transfer',
          description: `Baldeação em ${nextNode.name ?? 'estação'} para ${lineLabel(edgeTrace[i + 1].edge.lineId)}`,
          timeS: params.transferPenaltyS + expectedWaitS(nextLp.headwayMin),
        });
      }

      currentLine  = isLastEdge ? null : edgeTrace[i + 1]?.edge.lineId;
      lineStartIdx = i + 1;
      lineDistM    = 0;
    }
  }

  return steps;
}

function lineLabel(lineId) {
  return /^[A-Ea-e]$/.test(String(lineId))
    ? `Trem Expresso ${lineId.toUpperCase()}`
    : `Linha ${lineId}`;
}
