/**
 * Leaflet map wrapper — renders the QUERO network and route overlays.
 */

import L from 'leaflet';
import { formatDuration } from './simulation.js';

const RIO_CENTER  = [-22.9068, -43.1729];
const DEFAULT_ZOOM = 10;

export class MapView {
  constructor(containerId) {
    this.map = L.map(containerId, { zoomControl: true }).setView(RIO_CENTER, DEFAULT_ZOOM);

    // CartoDB Positron — flat, minimal, lets the transit network stand out
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
        '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(this.map);

    this._networkLayer   = L.layerGroup().addTo(this.map);
    this._routeLayer     = L.layerGroup().addTo(this.map);
    this._markerLayer    = L.layerGroup().addTo(this.map);
    this._isochroneLayer = L.layerGroup().addTo(this.map);
  }

  /**
   * Render the full transit network from GeoJSON.
   * `lineColors` is a Map<lineId, hexColor> from the network parser.
   */
  renderNetwork(geojson, lineColors = new Map(), getStatsForNode = null) {
    this._networkLayer.clearLayers();

    L.geoJSON(geojson, {
      style: feature => {
        const lineId = String(feature.properties?.linha ?? '');
        const color  = feature.properties?.stroke ?? lineColors.get(lineId) ?? '#0a7a3c';
        return { color, weight: 3, opacity: 0.8 };
      },
      pointToLayer: (feature, latlng) => {
        const p      = feature.properties ?? {};
        const name   = p.name  ?? '';
        const desc   = p.description ?? '';
        const lineId = String(p.linha ?? '');
        const color  = lineColors.get(lineId) ?? '#0a7a3c';

        const marker = L.circleMarker(latlng, {
          radius:      5,
          fillColor:   '#ffffff',
          color,
          weight:      2,
          fillOpacity: 1,
          interactive: true,
        });

        const baseStats = {
          pop: p.populacao_milhoes ?? null,
          pib: p.pib_brl_bilhoes  ?? null,
        };

        marker.bindPopup(
          stationPopupHtml(name, desc, baseStats),
          { maxWidth: 240, className: 'quero-popup' }
        );

        if (getStatsForNode) {
          const [lng, lat] = feature.geometry.coordinates;
          marker.on('popupopen', () => {
            const reachable = getStatsForNode(lat, lng);
            if (reachable) {
              marker.getPopup().setContent(
                stationPopupHtml(name, desc, { ...baseStats, reachable })
              );
            }
          });
        }

        if (name) marker.bindTooltip(name, { direction: 'top', offset: [0, -6] });

        return marker;
      },
    }).addTo(this._networkLayer);
  }

  /**
   * Render route as per-line colored polylines following actual track geometry.
   * `segments` is [{lineId, lineColor, coords: [[lat,lng],...]}]
   */
  renderRoute(segments) {
    this._routeLayer.clearLayers();
    if (!segments?.length) return;

    const allCoords = segments.flatMap(s => s.coords);

    for (const seg of segments) {
      if (seg.coords.length < 2) continue;
      // White halo for contrast against background network
      L.polyline(seg.coords, { color: '#ffffff', weight: 10, opacity: 0.7, interactive: false })
        .addTo(this._routeLayer);
      // Actual line color, slightly thicker than network
      L.polyline(seg.coords, { color: seg.lineColor, weight: 6, opacity: 1.0, interactive: false })
        .addTo(this._routeLayer);
    }

    this.map.fitBounds(L.latLngBounds(allCoords), { padding: [48, 48] });
  }

  /** Clear the route overlay and address markers (called on tab switch). */
  clearRoute() {
    this._routeLayer.clearLayers();
    this._markerLayer.clearLayers();
  }

  /** Fit the map view to a GeoJSON FeatureCollection's bounding box. */
  fitToNetwork(geojson) {
    try {
      const bounds = L.geoJSON(geojson).getBounds();
      if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [24, 24] });
    } catch { /* empty geojson — leave view unchanged */ }
  }

  /** Walk legs rendered as dashed gray lines. */
  renderWalkLegs(legs) {
    for (const { from, to } of legs) {
      L.polyline([from, to], {
        color:     '#6b7280',
        weight:    3,
        dashArray: '6 4',
        opacity:   0.7,
        interactive: false,
      }).addTo(this._routeLayer);
    }
  }

  /**
   * Render isochrone — filled circle markers for every named node in the map,
   * colored green→yellow→red by fraction of maxTimeS used.
   * `isochroneMap` is Map<nodeId, timeS>; `nodes` is the network.nodes Map.
   */
  renderIsochrone(isochroneMap, nodes, maxTimeS) {
    this._isochroneLayer.clearLayers();

    for (const [nodeId, timeS] of isochroneMap) {
      const node = nodes.get(nodeId);
      if (!node || node.name == null) continue;

      const f = Math.min(timeS / maxTimeS, 1);
      const color = isoColor(f);

      const marker = L.circleMarker([node.lat, node.lng], {
        radius:      9,
        fillColor:   color,
        color:       'transparent',
        weight:      0,
        fillOpacity: 0.85,
        interactive: true,
      });

      marker.bindTooltip(`${node.name} — ${formatDuration(timeS)}`, {
        direction: 'top',
        offset: [0, -10],
      });

      marker.addTo(this._isochroneLayer);
    }
  }

  /** Clear the isochrone overlay. */
  clearIsochrone() {
    this._isochroneLayer.clearLayers();
  }

  /** Place A / B address markers on the map. */
  setMarkers(origin, destination) {
    this._markerLayer.clearLayers();

    const makeIcon = (letter, color) =>
      L.divIcon({
        className: '',
        html: `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50%;` +
              `display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;` +
              `border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${letter}</div>`,
        iconSize:   [28, 28],
        iconAnchor: [14, 14],
      });

    if (origin)
      L.marker([origin.lat, origin.lng], { icon: makeIcon('A', '#0a7a3c') })
        .bindPopup(origin.displayName ?? 'Origem')
        .addTo(this._markerLayer);

    if (destination)
      L.marker([destination.lat, destination.lng], { icon: makeIcon('B', '#dc2626') })
        .bindPopup(destination.displayName ?? 'Destino')
        .addTo(this._markerLayer);
  }
}

// ── Isochrone color interpolation ─────────────────────────────────────────

function isoColor(f) {
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  const r = f < 0.5 ? lerp(34, 234, f * 2)  : lerp(234, 239, (f - 0.5) * 2);
  const g = f < 0.5 ? lerp(197, 163, f * 2) : lerp(163, 68,  (f - 0.5) * 2);
  const b = f < 0.5 ? lerp(34, 8, f * 2)    : lerp(8,   68,  (f - 0.5) * 2);
  return `rgb(${r},${g},${b})`;
}

// ── Station popup ──────────────────────────────────────────────────────────

/**
 * Build popup HTML for a station.
 * `stats` may contain `pop` (populacao_milhoes) and/or `pib` (pib_brl_bilhoes).
 */
function stationPopupHtml(name, description, stats = {}) {
  const badges = parseLineBadges(description);

  const badgesHtml = badges
    .map(({ label, bg, fg }) =>
      `<span style="display:inline-block;padding:2px 7px;border-radius:3px;` +
      `background:${safeCssColor(bg, '#0a7a3c')};color:${safeCssColor(fg, '#ffffff')};` +
      `font-size:11px;font-weight:700;margin:2px 2px 0 0">${escapeHtml(label)}</span>`
    )
    .join('');

  const { pop, pib, reachable } = stats;
  const hasStats = pop != null || pib != null;

  const statsHtml = hasStats
    ? `<hr class="popup-divider" />` +
      `<div class="popup-stats">` +
      (pop != null ? `<div class="popup-stat"><span class="stat-label">Pop.</span><span>${pop.toLocaleString('pt-BR')}M hab.</span></div>` : '') +
      (pib != null ? `<div class="popup-stat"><span class="stat-label">PIB</span><span>R$&nbsp;${pib.toLocaleString('pt-BR')}B</span></div>` : '') +
      `</div>`
    : '';

  const reachableHtml = reachable
    ? `<hr class="popup-divider"/>` +
      `<div class="popup-stat-heading">Alcance em tempo real</div>` +
      `<div class="popup-stats">` +
      Object.entries(reachable).map(([min, count]) =>
        `<div class="popup-stat"><span class="stat-label">${formatMinLabel(Number(min))}</span><span>${count} estações</span></div>`
      ).join('') +
      `</div>`
    : '';

  return (
    `<div class="quero-popup-inner">` +
    `<strong>${escapeHtml(name || 'Estação')}</strong>` +
    (badgesHtml ? `<div style="margin-top:6px">${badgesHtml}</div>` : '') +
    statsHtml +
    reachableHtml +
    `</div>`
  );
}

/**
 * Parse `**Linha X**` entries from umap description HTML.
 * Stops at the "Rotas especiais" section.
 * Returns [{label: "Linha 1", bg: "#ef9600", fg: "#000000"}]
 */
function parseLineBadges(html) {
  if (!html) return [];

  const [relevantPart] = html.split(/\*\*Rotas especiais\*\*/i);

  const badges = [];
  // Outer span: background-color. Inner span: color. Then **Linha X**.
  const re = /background-color\s*:\s*(#[0-9a-fA-F]{3,8})[^<]*<span[^>]+color\s*:\s*(#[0-9a-fA-F]{3,8})[^>]*>\*\*(Linha\s+[\w\d]+)\*\*/g;
  let m;
  while ((m = re.exec(relevantPart)) !== null) {
    badges.push({ bg: m[1], fg: m[2], label: m[3] });
  }
  return badges;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeCssColor(value, fallback) {
  return /^#[0-9a-fA-F]{3,8}$/.test(String(value)) ? value : fallback;
}

function formatMinLabel(min) {
  if (min >= 60 && min % 60 === 0) return `${min / 60}h`;
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}min`;
  return `${min} min`;
}
