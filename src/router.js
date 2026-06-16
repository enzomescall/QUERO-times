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
  const dist    = new Map();  // stateKey(nodeId, currentLine) -> best time (seconds)
  const prev    = new Map();  // stateKey -> { prevKey, from, edge, isTransfer, segmentTimeS }
  const visited = new Set();

  const startKey = stateKey(originNodeId, null);
  dist.set(startKey, 0);

  // Naive priority queue — adequate for ~400-node graphs
  const pq = [{ id: originNodeId, cost: 0, currentLine: null, key: startKey }];
  let bestDestKey = null;

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const { id: u, cost: uCost, currentLine, key: uKey } = pq.shift();

    if (visited.has(uKey)) continue;
    visited.add(uKey);
    if (u === destNodeId) { bestDestKey = uKey; break; }

    for (const edge of (adj.get(u) ?? [])) {
      const { to, distanceM, lineId } = edge;
      const lp = paramsForLine(lineId, params);

      const isFirstBoarding = currentLine === null;
      const isTransfer = currentLine !== null && lineId !== currentLine;

      let waitOrTransferTime = 0;
      if (isFirstBoarding) {
        waitOrTransferTime = expectedWaitS(lp.headwayMin);
      } else if (isTransfer) {
        waitOrTransferTime = params.transferPenaltyS + expectedWaitS(lp.headwayMin);
      }

      const segmentTimeS = segmentTravelTimeS(distanceM, lp) + lp.dwellTimeS;
      const newCost = uCost + waitOrTransferTime + segmentTimeS;
      const toKey = stateKey(to, lineId);

      if (visited.has(toKey)) continue;
      if (newCost < (dist.get(toKey) ?? Infinity)) {
        dist.set(toKey, newCost);
        prev.set(toKey, { prevKey: uKey, from: u, edge, isTransfer, segmentTimeS });
        pq.push({ id: to, cost: newCost, currentLine: lineId, key: toKey });
      }
    }
  }

  if (!bestDestKey) return null;

  // Reconstruct edge trace
  const path      = [];
  const edgeTrace = [];
  let curKey = bestDestKey;
  while (curKey !== startKey) {
    const p = prev.get(curKey);
    path.unshift(nodeIdFromStateKey(curKey));
    edgeTrace.unshift(p);
    curKey = p.prevKey;
  }
  path.unshift(originNodeId);

  return {
    totalTimeS:   dist.get(bestDestKey),
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
  let lineTimeS    = 0;

  for (let i = 0; i < edgeTrace.length; i++) {
    const { edge, isTransfer, segmentTimeS } = edgeTrace[i];
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
    lineTimeS += segmentTimeS;

    const isLastEdge  = i === edgeTrace.length - 1;
    const lineChanges = isLastEdge || edgeTrace[i + 1]?.isTransfer;

    if (lineChanges) {
      const fromNode  = network.nodes.get(path[lineStartIdx]);

      steps.push({
        type: 'ride',
        description: `${lineLabel(edge.lineId)}: ${fromNode.name ?? 'partida'} → ${nextNode.name ?? 'chegada'}`,
        timeS:     lineTimeS,
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
      lineTimeS    = 0;
    }
  }

  return steps;
}

function stateKey(nodeId, lineId) {
  return `${encodeURIComponent(nodeId)}|${lineId ?? ''}`;
}

function nodeIdFromStateKey(key) {
  return decodeURIComponent(key.split('|')[0]);
}

function lineLabel(lineId) {
  return /^[A-Ea-e]$/.test(String(lineId))
    ? `Trem Expresso ${lineId.toUpperCase()}`
    : `Linha ${lineId}`;
}
