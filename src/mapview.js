/**
 * Leaflet map wrapper — renders the QUERO network and route overlays.
 */

import L from 'leaflet';

const RIO_CENTER = [-22.9068, -43.1729];
const DEFAULT_ZOOM = 10;

export class MapView {
  constructor(containerId) {
    this.map = L.map(containerId, { zoomControl: true }).setView(RIO_CENTER, DEFAULT_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    this._networkLayer = L.layerGroup().addTo(this.map);
    this._routeLayer   = L.layerGroup().addTo(this.map);
    this._markerLayer  = L.layerGroup().addTo(this.map);
  }

  /** Render the full transit network from GeoJSON */
  renderNetwork(geojson) {
    this._networkLayer.clearLayers();

    L.geoJSON(geojson, {
      style: feature => ({
        color: feature.properties?.color ?? feature.properties?.stroke ?? '#0a7a3c',
        weight: 3,
        opacity: 0.8,
      }),
      pointToLayer: (feature, latlng) =>
        L.circleMarker(latlng, {
          radius: 5,
          fillColor: '#ffffff',
          color: '#0a7a3c',
          weight: 2,
          fillOpacity: 1,
        }).bindTooltip(feature.properties?.name ?? ''),
    }).addTo(this._networkLayer);
  }

  /** Draw the computed route polyline */
  renderRoute(pathCoords, lineColor = '#ff6b00') {
    this._routeLayer.clearLayers();
    if (!pathCoords?.length) return;

    L.polyline(pathCoords, {
      color: lineColor,
      weight: 6,
      opacity: 0.9,
      dashArray: null,
    }).addTo(this._routeLayer);

    this.map.fitBounds(L.latLngBounds(pathCoords), { padding: [40, 40] });
  }

  /** Place origin / destination markers */
  setMarkers(origin, destination) {
    this._markerLayer.clearLayers();

    const makeIcon = (letter, color) =>
      L.divIcon({
        className: '',
        html: `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${letter}</div>`,
        iconSize: [28, 28],
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

  /** Show/hide walking lines between address and nearest station */
  renderWalkLegs(legs) {
    // legs: [{from: [lat,lng], to: [lat,lng]}]
    for (const { from, to } of legs) {
      L.polyline([from, to], {
        color: '#6b7280',
        weight: 3,
        dashArray: '6 4',
        opacity: 0.7,
      }).addTo(this._routeLayer);
    }
  }
}
