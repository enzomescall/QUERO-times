/**
 * Parses GeoJSON from the QUERO umap export and builds a weighted graph.
 *
 * Data structure (from umap export):
 *  - Point features: stations. `name` = station name, `description` = HTML with
 *    "**Linha X**" spans for every line served (including express lines A-E).
 *    The `linha` property is either the line id for single-line stations or "M"
 *    for multi-line interchange markers — do NOT use it as the authoritative
 *    line identifier; parse `description` instead.
 *  - LineString features: track geometry. `linha` = line id ("1"…"12", "A"…"E").
 *    `stroke` = hex color. `linha-ramal` = branch id for express ramais.
 *
 * Graph building strategy:
 *  Pass 1 — index all station Points as nodes, extracting line membership from
 *            the description HTML.
 *  Pass 2 — walk each LineString coordinate-by-coordinate; whenever a coord is
 *            within STATION_SNAP_M of an indexed station, emit an edge from the
 *            last stop-node and reset the accumulator. This splits long lines
 *            into per-station-pair edges, which is what the router needs.
 */

const STATION_SNAP_M  = 300; // station Points vs LineString coords — umap placement can drift
const NODE_MERGE_M    = 50;  // merge duplicate nodes that are very close together
const EXPRESS_LINE_RE = /^[A-Ea-e]$/; // lettered lines are express

export class TransitNetwork {
  constructor() {
    this.nodes = new Map();      // id -> { id, lat, lng, name, lines: Set<string> }
    this.edges = [];             // { from, to, distanceM, lineId, lineColor, coords }
    this.lineColors = new Map(); // lineId -> hex color

    /**
     * Suggested sidebar defaults extracted from the GeoJSON.
     * Null fields mean "no suggestion — keep current slider value."
     * Per-line fields (speed, dwell, headway) use the first LineString
     * of each type (metro / express) that declares the property.
     * Global fields come from `network_defaults` on the FeatureCollection.
     */
    this.suggestedParams = {
      trainSpeedKph:      null,
      dwellTimeS:         null,
      headwayMin:         null,
      expressSpeedKph:    null,
      expressDwellTimeS:  null,
      expressHeadwayMin:  null,
      accelMs2:           null,
      walkSpeedKph:       null,
      transferPenaltyMin: null,
    };

    this._hasMetroLines   = false;
    this._hasExpressLines = false;
    this._nextId = 0;
  }

  /** Which broad line categories are present in this network. */
  get lineTypes() {
    return {
      hasMetro:   this._hasMetroLines,
      hasExpress: this._hasExpressLines,
    };
  }

  /** Load and parse a GeoJSON FeatureCollection. Returns `this`. */
  loadGeoJSON(geojson) {
    const stationFeatures = [];
    const lineFeatures    = [];

    for (const feature of geojson.features ?? []) {
      const t = feature.geometry?.type;
      if (t === 'Point') stationFeatures.push(feature);
      else if (t === 'LineString' || t === 'MultiLineString') lineFeatures.push(feature);
    }

    // ── Global defaults from FeatureCollection top-level ──────────────────
    // e.g. "network_defaults": { "accel_ms2": 1.3, "walk_speed_kph": 5, ... }
    const nd  = geojson.network_defaults ?? {};
    const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    if (nd.accel_ms2            != null) this.suggestedParams.accelMs2          = num(nd.accel_ms2);
    if (nd.walk_speed_kph       != null) this.suggestedParams.walkSpeedKph      = num(nd.walk_speed_kph);
    if (nd.transfer_penalty_min != null) this.suggestedParams.transferPenaltyMin = num(nd.transfer_penalty_min);

    // ── Pass 1 — station nodes ────────────────────────────────────────────
    for (const f of stationFeatures) {
      const [lng, lat] = f.geometry.coordinates;
      const node = this._getOrCreateNode(lat, lng, f.properties?.name ?? null);
      const { lines, colors } = parseDescriptionLines(f.properties?.description ?? '');
      for (const lineId of lines) node.lines.add(lineId);
      for (const [lineId, color] of colors) {
        if (!this.lineColors.has(lineId)) this.lineColors.set(lineId, color);
      }
    }

    // ── Pass 2 — track edges ──────────────────────────────────────────────
    for (const f of lineFeatures) {
      const lineId    = String(f.properties?.linha ?? f.properties?.name ?? 'unknown');
      const lineColor = f.properties?.stroke ?? this.lineColors.get(lineId) ?? '#0a7a3c';
      const p         = f.properties ?? {};

      if (p.stroke && !this.lineColors.has(lineId)) this.lineColors.set(lineId, p.stroke);

      // Collect per-line param suggestions; first LineString of each type wins.
      const isExpress = EXPRESS_LINE_RE.test(lineId);
      if (isExpress) {
        this._hasExpressLines = true;
        if (this.suggestedParams.expressSpeedKph   == null) this.suggestedParams.expressSpeedKph   = num(p.speed);
        if (this.suggestedParams.expressDwellTimeS == null) this.suggestedParams.expressDwellTimeS = num(p.dwell_s);
        if (this.suggestedParams.expressHeadwayMin == null) this.suggestedParams.expressHeadwayMin = num(p.headway_min);
      } else {
        this._hasMetroLines = true;
        if (this.suggestedParams.trainSpeedKph == null) this.suggestedParams.trainSpeedKph = num(p.speed);
        if (this.suggestedParams.dwellTimeS    == null) this.suggestedParams.dwellTimeS    = num(p.dwell_s);
        if (this.suggestedParams.headwayMin    == null) this.suggestedParams.headwayMin    = num(p.headway_min);
      }

      const allCoords = f.geometry.type === 'LineString'
        ? f.geometry.coordinates
        : f.geometry.coordinates.flat();

      this._processLineSegment(allCoords, lineId, lineColor);
    }

    return this;
  }

  /**
   * Walk the coordinate array of a single LineString.
   * Creates edges between consecutive station nodes (and the line's terminal
   * endpoints even if no named station exists there).
   */
  _processLineSegment(coords, lineId, lineColor) {
    let prevNode = null;
    let accDistM = 0;
    // Accumulate [lat, lng] waypoints for the current inter-station segment
    let segCoords = [];

    for (let i = 0; i < coords.length; i++) {
      const [lng, lat] = coords[i];

      if (i > 0) {
        const [plng, plat] = coords[i - 1];
        accDistM += haversineM(plat, plng, lat, lng);
      }
      segCoords.push([lat, lng]);

      const isEndpoint = i === 0 || i === coords.length - 1;
      const nearStation = this._findNearNode(lat, lng, STATION_SNAP_M);

      if (isEndpoint || nearStation) {
        const node = nearStation ?? this._getOrCreateNode(lat, lng, null);
        node.lines.add(lineId);

        if (prevNode && prevNode.id !== node.id && accDistM > 0) {
          // Store the actual track geometry on each directed edge
          const fwdCoords = [...segCoords];
          const revCoords = [...segCoords].reverse();
          this.edges.push({ from: prevNode.id, to: node.id, distanceM: accDistM, lineId, lineColor, coords: fwdCoords });
          this.edges.push({ from: node.id, to: prevNode.id, distanceM: accDistM, lineId, lineColor, coords: revCoords });
        }

        prevNode = node;
        accDistM = 0;
        // The current node is the start of the next segment
        segCoords = [[lat, lng]];
      }
    }
  }

  /** Return the closest node within `maxDist` metres, or null. */
  _findNearNode(lat, lng, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const node of this.nodes.values()) {
      const d = haversineM(lat, lng, node.lat, node.lng);
      if (d < bestDist) { bestDist = d; best = node; }
    }
    return best;
  }

  _getOrCreateNode(lat, lng, name) {
    // Merge nodes that are within NODE_MERGE_M (avoids duplicating the same station)
    const existing = this._findNearNode(lat, lng, NODE_MERGE_M);
    if (existing) {
      if (name && !existing.name) existing.name = name;
      return existing;
    }

    const id = String(this._nextId++);
    const node = { id, lat, lng, name, lines: new Set() };
    this.nodes.set(id, node);
    return node;
  }

  /** Nodes that serve ≥2 lines (interchange stations). */
  get transferNodes() {
    return [...this.nodes.values()].filter(n => n.lines.size >= 2);
  }

  /** Find the node closest to a given lat/lng (no distance limit). */
  nearestNode(lat, lng) {
    let best = null;
    let bestDist = Infinity;
    for (const node of this.nodes.values()) {
      const d = haversineM(lat, lng, node.lat, node.lng);
      if (d < bestDist) { bestDist = d; best = node; }
    }
    return { node: best, distanceM: bestDist };
  }

  /** Build adjacency list keyed by node id. */
  buildAdjacency() {
    const adj = new Map();
    for (const id of this.nodes.keys()) adj.set(id, []);
    for (const edge of this.edges) {
      adj.get(edge.from)?.push(edge);
    }
    return adj;
  }

  /** Debug summary logged to console. */
  logSummary() {
    const stationNodes  = [...this.nodes.values()].filter(n => n.name).length;
    const terminalNodes = this.nodes.size - stationNodes;
    const transfers     = this.transferNodes.length;
    console.info(
      `[QUERO network] ${this.nodes.size} nodes (${stationNodes} named, ${terminalNodes} terminals), ` +
      `${this.edges.length / 2} edges, ${transfers} interchange stations, ` +
      `${this.lineColors.size} lines`
    );
  }
}

// ── Description HTML parser ────────────────────────────────────────────────

/**
 * Extract line IDs and colors from umap description HTML.
 *
 * Format: one or more spans like:
 *   <span style="background-color: #ef9600"><span style="color:#000">**Linha 1**</span></span>
 * Sections "**Trens expressos**" and "**Rotas especiais**" act as headers.
 *
 * Returns { lines: string[], colors: Map<lineId, hexColor> }
 * where lineId is the part after "Linha " (e.g. "1", "A", "C").
 * "Rotas especiais" entries are skipped (TODO).
 */
function parseDescriptionLines(html) {
  if (!html) return { lines: [], colors: new Map() };

  const lines  = [];
  const colors = new Map();

  // Stop collecting at "Rotas especiais" section (TODO)
  const [relevantPart] = html.split(/\*\*Rotas especiais\*\*/i);

  // Match each span block: capture background-color and bold line label
  const spanRe = /background-color\s*:\s*(#[0-9a-f]{3,8})[^>]*>.*?\*\*(Linha\s+([\w\d]+))\*\*/gi;
  let m;
  while ((m = spanRe.exec(relevantPart)) !== null) {
    const color  = m[1];
    const lineId = m[3]; // e.g. "1", "A", "11"
    lines.push(lineId);
    if (!colors.has(lineId)) colors.set(lineId, color);
  }

  return { lines, colors };
}

// ── Haversine ─────────────────────────────────────────────────────────────

/** Straight-line distance in metres between two lat/lng points. */
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return (deg * Math.PI) / 180; }
