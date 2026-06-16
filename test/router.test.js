import test from 'node:test';
import assert from 'node:assert/strict';
import { findRoute } from '../src/router.js';

function makeNetwork(nodes, edges) {
  return {
    nodes: new Map(nodes.map(node => [node.id, { name: node.id, lat: 0, lng: 0, lines: new Set(), ...node }])),
    edges,
    buildAdjacency() {
      const adj = new Map(nodes.map(node => [node.id, []]));
      for (const edge of edges) adj.get(edge.from).push(edge);
      return adj;
    },
  };
}

const params = {
  trainSpeedKph: 60,
  dwellTimeS: 0,
  headwayMin: 10,
  expressSpeedKph: 60,
  expressDwellTimeS: 0,
  expressHeadwayMin: 10,
  accelMs2: 1000,
  transferPenaltyS: 0,
};

test('route total includes the first expected wait shown in steps', () => {
  const network = makeNetwork(
    [{ id: 'A' }, { id: 'B' }],
    [{ from: 'A', to: 'B', distanceM: 1000, lineId: '1', lineColor: '#0a7a3c', coords: [[0, 0], [0, 1]] }],
  );

  const route = findRoute(network, 'A', 'B', params);

  const stepTotal = route.steps.reduce((sum, step) => sum + step.timeS, 0);
  assert.equal(route.steps[0].type, 'wait');
  assert.equal(route.steps[0].timeS, 300);
  assert.equal(route.totalTimeS, stepTotal);
});

test('router keeps separate costs for arriving at the same station on different lines', () => {
  const network = makeNetwork(
    [{ id: 'O' }, { id: 'M' }, { id: 'D' }],
    [
      { from: 'O', to: 'M', distanceM: 500, lineId: '1', lineColor: '#111', coords: [[0, 0], [0, 1]] },
      { from: 'O', to: 'M', distanceM: 600, lineId: '2', lineColor: '#222', coords: [[0, 0], [0, 1]] },
      { from: 'M', to: 'D', distanceM: 500, lineId: '2', lineColor: '#222', coords: [[0, 1], [0, 2]] },
    ],
  );

  const route = findRoute(network, 'O', 'D', { ...params, headwayMin: 60, transferPenaltyS: 3600 });

  const riddenLines = route.steps.filter(step => step.type === 'ride').map(step => step.lineId);
  assert.deepEqual(riddenLines, ['2']);
  assert.equal(route.steps.some(step => step.type === 'transfer'), false);
});
