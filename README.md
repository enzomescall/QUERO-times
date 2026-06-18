# Simulador de Redes de Transporte

Proof-of-concept journey time planner for the **QUERO** expanded metro and rail network proposal for the Rio de Janeiro metropolitan area.

Enter two addresses anywhere in Rio and get an estimated door-to-door commute time through the hypothetical QUERO network, with configurable simulation parameters (train speed, headway, dwell time, walking speed, and more).

---

## How it works

1. **Address lookup** — Nominatim (OpenStreetMap) geocodes the origin and destination.
2. **Network graph** — The GeoJSON exported from the QUERO umap is parsed into a weighted directed graph: station Points become nodes; LineString geometries are walked coordinate-by-coordinate and split into edges at every station.
3. **Routing** — Dijkstra's algorithm finds the minimum-time path, accounting for transfer penalties and wait times.
4. **Time simulation** — Each edge uses a kinematic model (acceleration → cruise → brake) to estimate travel time. Dwell time is added at each stop; expected wait (headway ÷ 2) is added at the first boarding and at each line transfer.
5. **Walk legs** — Straight-line walking time is added between the geocoded addresses and the nearest station nodes.

### Network data structure (umap export)

| Feature type | What it represents | Key properties used |
|---|---|---|
| `Point` | Station | `name`, `description` (HTML with **Linha X** spans) |
| `LineString` | Track segment / full line | `linha` (line id), `stroke` (hex color), `linha-ramal` (branch id) |

Line membership for stations is parsed from the `description` HTML field — each served line appears as a styled `<span>` containing `**Linha X**`. The `linha` property on Point features is unreliable for interchange stations (it is set to `"M"`).

---

## Getting started

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

Quality checks:

```bash
npm test
npm run build
npm audit --audit-level=high
```

**To use real network data:** replace `data/network.geojson` with the GeoJSON layer export from the QUERO umap (umap layer menu → Export → GeoJSON).

---

## Line reference

| Id | Name | Type |
|---|---|---|
| 1–12 | Linhas Metropolitanas / Suburbanas | Metro / light rail |
| A–E | Trens expressos | Express / commuter rail |
| X | Circulares | Circular routes (share existing track) |

---

## Simulation parameters

All parameters are editable in the sidebar at runtime:

| Parameter | Default | Effect |
|---|---|---|
| Velocidade máxima metropolitana | 80 km/h | Cruise speed for numbered lines 1–12 |
| Velocidade máxima expressa | 120 km/h | Cruise speed for express lines A–E |
| Tempo em estação metropolitano | 30 s | Dwell time on numbered lines |
| Tempo em estação expresso | 45 s | Dwell time on express lines |
| Frequência metropolitana | 5 min | Wait = headway ÷ 2 on numbered lines |
| Frequência expressa | 10 min | Wait = headway ÷ 2 on express lines |
| Aceleração / frenagem | 1.0 m/s² | Ramp-up and ramp-down distance |
| Velocidade a pé | 5 km/h | Walking speed for origin/destination legs |
| Penalidade de baldeação | 3 min | Extra time added when switching lines |

---

## Project structure

```
src/
  main.js        — UI wiring and app entry point
  network.js     — GeoJSON → weighted graph (description HTML parser, station snapping)
  router.js      — Dijkstra routing with transfer penalties
  simulation.js  — Kinematic travel-time model and time formatting
  geocoding.js   — Nominatim address search (rate-limited, biased to Rio)
  mapview.js     — Leaflet: network render, route overlay, walk legs, A/B markers
  style.css      — Sidebar and map layout
test/
  router.test.js — Router timing and transfer-state regression tests
data/
  network.geojson — Replace with real umap export
```

---

## TODO

- [ ] **Rotas especiais / Circulares** — stations list `Circular 1`, `Circular 2`, etc. in their `description` under a `**Rotas especiais**` section. These circular routes reuse existing track with a different stopping pattern. The parser currently skips this section; a future version should model them as routing overlays on top of the base line graph.
- [ ] **Bus / BRT feeder routes** — not present in the umap. Even approximate corridor data would dramatically improve last-mile routing outside the rail catchment area.
- [ ] **Per-line headways** — the current model uses one global headway. Metro trunk lines (every 3 min) vs. express ramais (every 15 min) have very different wait costs.
- [ ] **Per-line design speeds** — light rail at 60 km/h vs. heavy metro at 120 km/h changes trip times significantly. Should be a property on each LineString feature.
- [ ] **Phase / opening year filter** — the QUERO proposal is staged. A slider letting users explore "what if only Phase 1 is open?" would be useful.
- [ ] **Fare estimation** — once fare zones or integration rules are defined.
- [ ] **Mobile layout polish** — the stacked sidebar/map layout works but could use a bottom-sheet pattern on small screens.
- [ ] **Click-on-map to set origin/destination** — as an alternative to address search.
