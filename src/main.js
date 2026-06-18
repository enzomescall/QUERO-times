import { TransitNetwork } from './network.js';
import { findRoute } from './router.js';
import { searchAddress } from './geocoding.js';
import { MapView } from './mapview.js';
import { walkTimeS, formatDuration } from './simulation.js';

// ── Per-tab config ─────────────────────────────────────────────────────────
const TAB_CONFIG = {
  metro: {
    geojsonPath: '/data/network.geojson',
    title:    'QUERO Transporte',
    subtitle: 'Planejador de rotas — rede proposta',
  },
  hsr: {
    geojsonPath: '/data/hsr-network.geojson',
    title:    'Alta Velocidade',
    subtitle: 'Planejador de rotas — TAV proposto',
  },
};

// ── State ──────────────────────────────────────────────────────────────────
const networks = { metro: null, hsr: null };
const geojsons = { metro: null, hsr: null };
let activeTab    = 'metro';
let mapView      = null;
let originPoint  = null;
let destPoint    = null;

// ── DOM refs ───────────────────────────────────────────────────────────────
const appEl         = document.getElementById('app');
const headerTitle   = document.getElementById('header-title');
const headerSub     = document.getElementById('header-subtitle');
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

// ── Network loading ────────────────────────────────────────────────────────
async function loadNetwork(tab) {
  if (networks[tab]) {
    mapView.renderNetwork(geojsons[tab], networks[tab].lineColors);
    mapView.fitToNetwork(geojsons[tab]);
    updateParamVisibility(networks[tab]);
    const n = networks[tab];
    setStatus(`Rede carregada — ${n.nodes.size} estações, ${n.edges.length / 2} segmentos`);
    return;
  }

  setStatus('Carregando rede...');
  try {
    const res = await fetch(TAB_CONFIG[tab].geojsonPath);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();

    const net = new TransitNetwork().loadGeoJSON(geojson);
    net.logSummary();

    networks[tab] = net;
    geojsons[tab] = geojson;

    mapView.renderNetwork(geojson, net.lineColors);
    mapView.fitToNetwork(geojson);
    updateParamVisibility(net);
    setStatus(`Rede carregada — ${net.nodes.size} estações, ${net.edges.length / 2} segmentos`);
  } catch (err) {
    setStatus(`Erro ao carregar rede: ${err.message}`, true);
    console.error(err);
  }
}

/**
 * Show only the param sections that are relevant for the loaded network.
 * If the network uses only numbered lines, hide the express panel (and vice
 * versa). If it uses both — or neither (unknown custom IDs) — show both.
 */
function updateParamVisibility(network) {
  const { hasMetro, hasExpress } = network.lineTypes;
  const showBoth = !hasMetro && !hasExpress; // custom/unknown line ids → show everything
  document.getElementById('metro-params').hidden  = !showBoth && !hasMetro;
  document.getElementById('express-params').hidden = !showBoth && !hasExpress;
}

// ── Tab switching ──────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', async () => {
    const tab = btn.dataset.tab;
    if (tab === activeTab) return;

    activeTab = tab;

    // Update tab visual state
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
      t.setAttribute('aria-selected', String(t.dataset.tab === tab));
    });

    // Update theme and header text
    appEl.dataset.tab = tab;
    const cfg = TAB_CONFIG[tab];
    headerTitle.innerHTML = cfg.title.includes(' ')
      ? cfg.title.replace(' ', ' <span>') + '</span>'
      : cfg.title;
    headerSub.textContent = cfg.subtitle;

    // Clear route state for the new tab
    originPoint = null;
    destPoint   = null;
    originInput.value = '';
    destInput.value   = '';
    hideSugg(originSugg);
    hideSugg(destSugg);
    mapView.clearRoute();
    resultsSection.hidden = true;

    await loadNetwork(tab);
  });
});

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  mapView = new MapView('map');
  appEl.dataset.tab = activeTab;
  await loadNetwork(activeTab);
}

// ── Autocomplete ───────────────────────────────────────────────────────────
function wireAutocomplete(input, suggList, onSelect) {
  let debounceTimer = null;
  let requestSeq = 0;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (q.length < 3) { requestSeq += 1; hideSugg(suggList); return; }

    debounceTimer = setTimeout(async () => {
      const seq = ++requestSeq;
      try {
        const results = await searchAddress(q);
        if (seq !== requestSeq || input.value.trim() !== q) return;
        renderSuggestions(suggList, results, r => {
          input.value = r.displayName.split(',').slice(0, 2).join(',');
          hideSugg(suggList);
          onSelect(r);
        });
      } catch (e) {
        if (seq === requestSeq) setStatus(`Erro ao buscar endereço: ${e.message}`, true);
        console.warn('Geocoding error:', e);
      }
    }, 400);
  });

  document.addEventListener('click', e => {
    if (!suggList.contains(e.target) && e.target !== input) hideSugg(suggList);
  });
}

function renderSuggestions(list, items, onSelect) {
  list.replaceChildren();
  if (!items.length) { hideSugg(list); return; }
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item.displayName.split(',').slice(0, 3).join(', ');
    li.addEventListener('click', () => onSelect(item));
    list.appendChild(li);
  }
  list.hidden = false;
}

function hideSugg(list) { list.hidden = true; list.replaceChildren(); }

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
    trainSpeedKph:     parseFloat(document.getElementById('train-speed').value),
    dwellTimeS:        parseFloat(document.getElementById('dwell-time').value),
    headwayMin:        parseFloat(document.getElementById('headway').value),
    expressSpeedKph:   parseFloat(document.getElementById('express-speed').value),
    expressDwellTimeS: parseFloat(document.getElementById('express-dwell').value),
    expressHeadwayMin: parseFloat(document.getElementById('express-headway').value),
    accelMs2:          parseFloat(document.getElementById('accel').value),
    walkSpeedKph:      parseFloat(document.getElementById('walk-speed').value),
    transferPenaltyS:  parseFloat(document.getElementById('transfer-penalty').value) * 60,
  };
}

// ── Route planning ─────────────────────────────────────────────────────────
planBtn.addEventListener('click', async () => {
  const network = networks[activeTab];
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

  const walkOriginS = walkTimeS(oDist, params.walkSpeedKph);
  const walkDestS   = walkTimeS(dDist, params.walkSpeedKph);
  const totalS      = route.totalTimeS + walkOriginS + walkDestS;

  mapView.renderRoute(route.pathSegments);
  mapView.renderWalkLegs([
    { from: [originPoint.lat, originPoint.lng], to: [oNode.lat, oNode.lng] },
    { from: [dNode.lat, dNode.lng],             to: [destPoint.lat, destPoint.lng] },
  ]);
  mapView.setMarkers(originPoint, destPoint);

  renderResults(route, walkOriginS, walkDestS, totalS, oNode, dNode);
  setStatus(`Rota calculada — ${formatDuration(totalS)} no total`);
  planBtn.disabled = false;
});

function renderResults(route, walkOriginS, walkDestS, totalS, oNode, dNode) {
  resultsSection.hidden = false;

  const walkMin    = Math.round((walkOriginS + walkDestS) / 60);
  const transitMin = Math.round(route.totalTimeS / 60);

  resultSummary.replaceChildren();

  const totalEl = document.createElement('div');
  totalEl.className   = 'total-time';
  totalEl.textContent = formatDuration(totalS);

  const breakdownEl = document.createElement('div');
  breakdownEl.className   = 'breakdown';
  breakdownEl.textContent = `${walkMin > 0 ? `${walkMin}min a pé · ` : ''}${transitMin}min no trem`;

  resultSummary.append(totalEl, breakdownEl);
  resultSteps.replaceChildren();

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

    const iconEl = document.createElement('span');
    iconEl.className   = 'step-icon';
    iconEl.textContent = icon;

    const detailEl = document.createElement('span');
    detailEl.className   = 'step-detail';
    detailEl.textContent = step.description;

    const timeEl = document.createElement('span');
    timeEl.className   = 'step-time';
    timeEl.textContent = formatDuration(step.timeS);

    li.append(iconEl, detailEl, timeEl);
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
