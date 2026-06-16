/**
 * Parses GeoJSON from the QUERO umap export and builds a weighted graph
 * suitable for Dijkstra routing.
 *
 * Assumptions about the GeoJSON structure:
 *  - LineString / MultiLineString features represent rail segments.
 *  - Point features (if present) represent named stations.
 *  - Feature properties may include: name, line, mode, color.
 *
 * If station Points are absent we synthesise nodes at every coordinate
 * that appears as an endpoint of a LineString or at intersections.
 */

const SNAP_DISTANCE_M = 50; // coords within this distance are merged into one node

export class TransitNetwork {
  constructor() {
    this.nodes = new Map();   // id -> { id, lat, lng, name, lines: Set }
    this.edges = [];          // { from, to, distanceM, lineId, lineColor }
    this._nextId = 0;
  }

  /** Load and parse a GeoJSON FeatureCollection */
  loadGeoJSON(geojson) {
    const stationFeatures = [];
    const lineFeatures = [];

    for (const feature of geojson.features ?? []) {
      const t = feature.geometry?.type;
      if (t === 'Point') stationFeatures.push(feature);
      else if (t === 'LineString' || t === 'MultiLineString') lineFeatures.push(feature);
    }

    // Index explicit station points first
    for (const f of stationFeatures) {
      const [lng, lat] = f.geometry.coordinates;
      this._getOrCreateNode(lat, lng, f.properties?.name ?? null, f.properties?.line ?? null);
    }

    // Build edges from line geometries
    for (const f of lineFeatures) {
      const coords =
        f.geometry.type === 'LineString'
          ? [f.geometry.coordinates]
          : f.geometry.coordinates;

      const lineId = f.properties?.name ?? f.properties?.line ?? 'unknown';
      const lineColor = f.properties?.color ?? f.properties?.stroke ?? '#0a7a3c';

      for (const segment of coords) {
        this._processLineSegment(segment, lineId, lineColor);
      }
    }

    return this;
  }

  _processLineSegment(coords, lineId, lineColor) {
    // Each consecutive pair of coordinates becomes an edge;
    // intersection nodes are automatically created as side-effects of _getOrCreateNode.
    let prevNode = null;
    let accDistM = 0;
    let segStart = null;

    for (let i = 0; i < coords.length; i++) {
      const [lng, lat] = coords[i];
      const isEndpoint = i === 0 || i === coords.length - 1;

      if (i > 0) {
        const [plng, plat] = coords[i - 1];
        accDistM += haversineM(plat, plng, lat, lng);
      }

      // Create nodes only at endpoints; intermediate coords just accumulate distance
      if (isEndpoint) {
        const node = this._getOrCreateNode(lat, lng, null, lineId);
        node.lines.add(lineId);

        if (prevNode && prevNode.id !== node.id) {
          this.edges.push({ from: prevNode.id, to: node.id, distanceM: accDistM, lineId, lineColor });
          this.edges.push({ from: node.id, to: prevNode.id, distanceM: accDistM, lineId, lineColor });
        }

        prevNode = node;
        accDistM = 0;
        segStart = [lat, lng];
      }
    }
  }

  _getOrCreateNode(lat, lng, name, lineId) {
    // Snap to existing node within SNAP_DISTANCE_M
    for (const node of this.nodes.values()) {
      if (haversineM(lat, lng, node.lat, node.lng) <= SNAP_DISTANCE_M) {
        if (name && !node.name) node.name = name;
        if (lineId) node.lines.add(lineId);
        return node;
      }
    }

    const id = String(this._nextId++);
    const node = { id, lat, lng, name, lines: new Set(lineId ? [lineId] : []) };
    this.nodes.set(id, node);
    return node;
  }

  /** Return nodes that act as transfer points (belong to ≥2 lines) */
  get transferNodes() {
    return [...this.nodes.values()].filter(n => n.lines.size >= 2);
  }

  /** Find the node closest to a given lat/lng */
  nearestNode(lat, lng) {
    let best = null;
    let bestDist = Infinity;
    for (const node of this.nodes.values()) {
      const d = haversineM(lat, lng, node.lat, node.lng);
      if (d < bestDist) { bestDist = d; best = node; }
    }
    return { node: best, distanceM: bestDist };
  }

  /** Build adjacency list keyed by node id */
  buildAdjacency() {
    const adj = new Map();
    for (const id of this.nodes.keys()) adj.set(id, []);
    for (const edge of this.edges) {
      adj.get(edge.from)?.push(edge);
    }
    return adj;
  }
}

/** Haversine distance in metres */
export function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return (deg * Math.PI) / 180; }
