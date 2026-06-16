import { TransitNetwork, haversineM } from './network.js';
import { findRoute } from './router.js';
import { searchAddress } from './geocoding.js';
import { MapView } from './mapview.js';
import { walkTimeS, formatDuration } from './simulation.js';

// ── State ──────────────────────────────────────────────────────────────────
let network = null;
let mapView = null;
let originPoint = null;
let destPoint = null;

// ── DOM refs ───────────────────────────────────────────────────────────────
const originInput   = document.getElementById('origin');
const destInput     = document.getElementById('destination');
const originSugg    = document.getElementById('origin-suggestions');
const destSugg      = document.getElementById('destination-suggestions');
const planBtn       = document.getElementById('plan-btn');
const resultsSection = document.getElementById('results');
const resultSummary = document.getElementById('result-summary');
const resultSteps   = document.getElementById('result-steps');
const statusMsg     = document.getElementById('status-msg');
const statusBar     = document.getElementById('status-bar');

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  mapView = new MapView('map');
  setStatus('Carregando rede QUERO...');

  try {
    const res = await fetch('/data/network.geojson');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();

    network = new TransitNetwork().loadGeoJSON(geojson);
    network.logSummary();
    mapView.renderNetwork(geojson, network.lineColors);

    const nodeCount = network.nodes.size;
    const edgeCount = network.edges.length / 2;
    setStatus(`Rede carregada — ${nodeCount} estações, ${edgeCount} segmentos`);
  } catch (err) {
    setStatus(`Erro ao carregar rede: ${err.message}`, true);
    console.error(err);
  }
}

// ── Autocomplete ───────────────────────────────────────────────────────────
function wireAutocomplete(input, suggList, onSelect) {
  let debounceTimer = null;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (q.length < 3) { hideSugg(suggList); return; }

    debounceTimer = setTimeout(async () => {
      try {
        const results = await searchAddress(q);
        renderSuggestions(suggList, results, r => {
          input.value = r.displayName.split(',').slice(0, 2).join(',');
          hideSugg(suggList);
          onSelect(r);
        });
      } catch (e) {
        console.warn('Geocoding error:', e);
      }
    }, 400);
  });

  document.addEventListener('click', e => {
    if (!suggList.contains(e.target) && e.target !== input) hideSugg(suggList);
  });
}

function renderSuggestions(list, items, onSelect) {
  list.innerHTML = '';
  if (!items.length) { hideSugg(list); return; }
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item.displayName.split(',').slice(0, 3).join(', ');
    li.addEventListener('click', () => onSelect(item));
    list.appendChild(li);
  }
  list.hidden = false;
}

function hideSugg(list) { list.hidden = true; list.innerHTML = ''; }

wireAutocomplete(originInput, originSugg, r => {
  originPoint = r;
  mapView.setMarkers(originPoint, destPoint);
});

wireAutocomplete(destInput, destSugg, r => {
  destPoint = r;
  mapView.setMarkers(originPoint, destPoint);
});

// ── Params helper ──────────────────────────────────────────────────────────
function getParams() {
  return {
    trainSpeedKph:    parseFloat(document.getElementById('train-speed').value),
    dwellTimeS:       parseFloat(document.getElementById('dwell-time').value),
    headwayMin:       parseFloat(document.getElementById('headway').value),
    accelMs2:         parseFloat(document.getElementById('accel').value),
    walkSpeedKph:     parseFloat(document.getElementById('walk-speed').value),
    transferPenaltyS: parseFloat(document.getElementById('transfer-penalty').value) * 60,
  };
}

// ── Route planning ─────────────────────────────────────────────────────────
planBtn.addEventListener('click', async () => {
  if (!network) { alert('Rede ainda não carregada.'); return; }
  if (!originPoint || !destPoint) { alert('Selecione origem e destino.'); return; }

  planBtn.disabled = true;
  setStatus('Calculando rota...');

  const params = getParams();

  const { node: oNode, distanceM: oDist } = network.nearestNode(originPoint.lat, originPoint.lng);
  const { node: dNode, distanceM: dDist } = network.nearestNode(destPoint.lat, destPoint.lng);

  if (!oNode || !dNode) {
    setStatus('Não foi possível encontrar estações próximas.', true);
    planBtn.disabled = false;
    return;
  }

  const route = findRoute(network, oNode.id, dNode.id, params);

  if (!route) {
    setStatus('Nenhuma rota encontrada entre os pontos selecionados.', true);
    planBtn.disabled = false;
    return;
  }

  // Walk times
  const walkOriginS = walkTimeS(oDist, params.walkSpeedKph);
  const walkDestS   = walkTimeS(dDist, params.walkSpeedKph);
  const totalS      = route.totalTimeS + walkOriginS + walkDestS;

  // Render map
  mapView.renderRoute(route.pathCoords);
  mapView.renderWalkLegs([
    { from: [originPoint.lat, originPoint.lng], to: [oNode.lat, oNode.lng] },
    { from: [dNode.lat, dNode.lng],              to: [destPoint.lat, destPoint.lng] },
  ]);
  mapView.setMarkers(originPoint, destPoint);

  // Render sidebar results
  renderResults(route, walkOriginS, walkDestS, totalS, oNode, dNode, params);

  setStatus(`Rota calculada — ${formatDuration(totalS)} no total`);
  planBtn.disabled = false;
});

function renderResults(route, walkOriginS, walkDestS, totalS, oNode, dNode, params) {
  resultsSection.hidden = false;

  const walkMin   = Math.round((walkOriginS + walkDestS) / 60);
  const transitMin = Math.round(route.totalTimeS / 60);

  resultSummary.innerHTML = `
    <div class="total-time">${formatDuration(totalS)}</div>
    <div class="breakdown">
      ${walkMin > 0 ? `${walkMin}min a pé &nbsp;·&nbsp; ` : ''}
      ${transitMin}min no trem
    </div>
  `;

  resultSteps.innerHTML = '';

  const allSteps = [
    walkOriginS > 5
      ? { type: 'walk', description: `Caminhar até ${oNode.name ?? 'estação mais próxima'} (${Math.round(walkOriginS / 60)}min)`, timeS: walkOriginS }
      : null,
    ...route.steps,
    walkDestS > 5
      ? { type: 'walk', description: `Caminhar até o destino (${Math.round(walkDestS / 60)}min)`, timeS: walkDestS }
      : null,
  ].filter(Boolean);

  for (const step of allSteps) {
    const li = document.createElement('li');
    const icon = { walk: '🚶', ride: '🚇', wait: '⏱', transfer: '🔄' }[step.type] ?? '•';
    li.innerHTML = `
      <span class="step-icon">${icon}</span>
      <span class="step-detail">${step.description}</span>
      <span class="step-time">${formatDuration(step.timeS)}</span>
    `;
    resultSteps.appendChild(li);
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────
function setStatus(msg, isError = false) {
  statusMsg.textContent = msg;
  statusBar.classList.toggle('error', isError);
}

// ── Boot ───────────────────────────────────────────────────────────────────
init();
