# GeoJSON Network Format

This document explains how to structure a GeoJSON file so it works correctly with the QUERO journey planner. The app reads two kinds of features: **station points** and **track lines**.

---

## File structure

The file must be a valid GeoJSON `FeatureCollection`. You can also include a top-level `network_defaults` object to set initial sidebar values for the whole network:

```json
{
  "type": "FeatureCollection",
  "network_defaults": {
    "accel_ms2": 1.0,
    "walk_speed_kph": 4.5,
    "transfer_penalty_min": 3
  },
  "features": [ ... ]
}
```

All fields in `network_defaults` are optional. When present, they pre-fill the corresponding sidebar sliders when the network loads — the user can still change them freely afterwards.

| Field | Unit | Sidebar slider |
|---|---|---|
| `accel_ms2` | m/s² | Aceleração |
| `walk_speed_kph` | km/h | Velocidade a pé |
| `transfer_penalty_min` | minutes | Penalidade de baldeação |

---

## Feature type 1 — Stations (Point)

Each station is a `Point` feature. The two required properties are `name` and `description`.

```json
{
  "type": "Feature",
  "properties": {
    "name": "CENTRAL",
    "description": "<span class=\"Apple-style-span\" style=\"background-color: #ef9600\"><span style=\"color:#000000\">**Linha 1**</span></span>\n<span class=\"Apple-style-span\" style=\"background-color: #eedc00\"><span style=\"color:#000000\">**Linha 4**</span></span>"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [-43.1800, -22.9100]
  }
}
```

### `name` (required)
The station's display name. Shown in route steps, tooltips, and popup headers.

### `description` (required for line membership)
HTML string listing every line that serves this station. The app parses this field to know which lines stop here — it is the **only** authoritative source of line membership.

Each line entry must be a nested `<span>` pair in this exact format:

```html
<span style="background-color: #HEX"><span style="color:#HEX">**Linha X**</span></span>
```

- The outer span's `background-color` is the line's display color (used in popups and route badges).
- The inner span's `color` is the text color (white on dark backgrounds, black on light ones).
- `**Linha X**` is the line identifier in Markdown bold. `X` can be a number (`1`–`12`) or a letter (`A`–`E` for express lines).

Multiple lines are separated by newlines (`\n`):

```
**Linha 1** span
\n
**Linha 4** span
```

#### Special sections in description

The parser stops at the first occurrence of `**Rotas especiais**`. Anything after that heading is ignored (circular routes — see TODO in README).

Express trains can be grouped under a `**Trens expressos**` heading, but the heading itself is not required — the parser identifies express lines by their letter identifier (`A`–`E`), not by their section.

```html
<span ...>**Linha 7**</span>

**Trens expressos**
<span ...>**Linha C**</span>
```

### `linha` (optional, often unreliable)
Some umap exports set this to the line number for single-line stations, but interchange stations are often tagged `"M"` (multi-line marker). **Do not rely on this field for line membership** — always use `description` instead.

### `populacao_milhoes` / `pib_brl_bilhoes` (optional, HSR networks)
Population in millions and GDP in BRL billions for the city served by this station. When present, these are displayed in the station popup.

---

## Feature type 2 — Track geometry (LineString)

Each line (or branch of a line) is a `LineString` feature. For branching lines, use one `LineString` per branch rather than a `MultiLineString`.

```json
{
  "type": "Feature",
  "properties": {
    "name": "Linha 1 – Metropolitana",
    "linha": "1",
    "stroke": "#ef9600",
    "stroke-width": 3,
    "speed": 80,
    "dwell_s": 30,
    "headway_min": 5
  },
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-43.2600, -22.9750],
      [-43.2400, -22.9600],
      [-43.1800, -22.9100],
      [-43.1600, -22.9050]
    ]
  }
}
```

### `linha` (required)
The line identifier. Must match the identifier used in station `description` fields:
- Numbered metro/rail lines: `"1"`, `"2"`, … `"12"`
- Lettered express/commuter lines: `"A"`, `"B"`, `"C"`, `"D"`, `"E"`

This value is what the router uses to detect line changes (and therefore transfers).

### `stroke` (required for correct colors)
Hex color for this line, e.g. `"#ef9600"`. Used when rendering the network on the map. If absent, the color falls back to whatever was parsed from station descriptions for the same `linha` id, then to a default green.

### `speed` (optional)
Design speed of this line in **km/h**. When present on the first `LineString` of each type (metro or express), this value pre-fills the corresponding speed slider in the sidebar. The user can override it after load.

```json
"properties": { "linha": "1", "stroke": "#e63946", "speed": 300 }
```

### `dwell_s` (optional)
Station dwell time in **seconds** — how long the train waits at each stop. Pre-fills the *Tempo de parada* sidebar slider on load.

```json
"properties": { "linha": "1", "dwell_s": 30 }
```

### `headway_min` (optional)
Service frequency in **minutes** (time between trains). Pre-fills the *Frequência* sidebar slider on load. Expected wait at any station is `headway_min / 2`.

```json
"properties": { "linha": "1", "headway_min": 5 }
```

For networks with both metro and express lines, the first `LineString` of each type (lettered vs. numbered) to declare these properties sets the default for its category.

### `linha-ramal` (optional)
Branch identifier for lines with multiple ramais (e.g. `"A1"`, `"A2"`). Not used by the router today but preserved for future filtering by branch.

### `name` (optional)
Human-readable line name, e.g. `"Linha A :: Ramal Muriqui"`. Not used by the router.

---

## Sidebar defaults — how GeoJSON values become editable defaults

When a network loads, the app reads `network_defaults` from the `FeatureCollection` and `speed`, `dwell_s`, `headway_min` from `LineString` features. These values are pushed into the sidebar sliders as starting values. The sidebar remains the single source of truth for every route calculation — you can change any slider at any time without reloading the network.

Only the first `LineString` of each type (metro / express) that declares a given property is used; subsequent `LineString` features on the same type are ignored for defaults.

| GeoJSON field | Applies to | Sidebar input |
|---|---|---|
| `network_defaults.accel_ms2` | Both | Aceleração (m/s²) |
| `network_defaults.walk_speed_kph` | Both | Velocidade a pé (km/h) |
| `network_defaults.transfer_penalty_min` | Both | Penalidade de baldeação (min) |
| `speed` on numeric `LineString` | Metro | Velocidade máxima — metro |
| `dwell_s` on numeric `LineString` | Metro | Tempo de parada — metro |
| `headway_min` on numeric `LineString` | Metro | Frequência — metro |
| `speed` on lettered `LineString` | Express | Velocidade máxima — expresso |
| `dwell_s` on lettered `LineString` | Express | Tempo de parada — expresso |
| `headway_min` on lettered `LineString` | Express | Frequência — expresso |

---

## How the router uses these features

1. **Pass 1** — All `Point` features are indexed as graph nodes. Line membership is read from `description`.
2. **Pass 2** — Each `LineString` is walked coordinate by coordinate. Whenever a coordinate falls within **300 m** of an indexed station node, an edge is emitted between that station and the previous one encountered on the same line. This splits the line into per-station-pair edges.
3. **Routing** — Dijkstra finds the minimum-time path. Switching from one `linha` to another triggers a transfer penalty + wait time.

### Implication: station coordinates must be near the track

Station `Point` coordinates should be placed on or very close (within ~300 m) to the corresponding `LineString` coordinates. If a station is further away than that threshold, the router will not snap it to the line and the edge will not be split at that station — effectively making the station invisible to routing.

### Implication: lines connect through shared stations

Two lines connect if they share a station node (i.e., there is a `Point` feature near both `LineString` geometries whose `description` lists both line IDs). There is no need to make `LineString` endpoints touch — the station snapping handles transfers automatically.

---

## Express vs. regular lines

Lines identified by a letter (`A`–`E`) are treated as **express** lines by the simulation engine and use separate speed, dwell time, and headway parameters (configurable in the sidebar). All other lines use the regular metro parameters.

The sidebar automatically hides irrelevant panels when a network loads:
- Only numbered lines present → the *Trens expressos* panel is hidden.
- Only lettered lines present → the *Linhas metropolitanas* panel is hidden.
- Both present, or neither (custom IDs) → both panels are shown.

If your network has a different express/regular split, you can adjust the `isExpressLine()` function in `src/simulation.js`.

---

## Tips for creating data in umap (openstreetmap.fr/umap)

1. Draw each line as a separate layer or at least tag each feature with a `linha` property.
2. Place station markers directly on the line path — click on the line while drawing to snap to it.
3. In each station's description field, add the `<span>` HTML for every line it serves. The background color should match the `stroke` color of the corresponding `LineString`.
4. Export: **Layer menu → Download data → GeoJSON**. If exporting all layers at once, use the map-level export (not per-layer) to get a single `FeatureCollection`.
5. Replace `data/network.geojson` (or `data/hsr-network.geojson`) with the downloaded file and reload the app.

---

## Minimal working example

A two-station, one-line network that will route correctly:

```json
{
  "type": "FeatureCollection",
  "network_defaults": {
    "accel_ms2": 1.0,
    "walk_speed_kph": 4.5,
    "transfer_penalty_min": 3
  },
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Estação Alpha",
        "description": "<span style=\"background-color: #e63946\"><span style=\"color:#ffffff\">**Linha 1**</span></span>"
      },
      "geometry": { "type": "Point", "coordinates": [-43.200, -22.900] }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Estação Beta",
        "description": "<span style=\"background-color: #e63946\"><span style=\"color:#ffffff\">**Linha 1**</span></span>"
      },
      "geometry": { "type": "Point", "coordinates": [-43.150, -22.910] }
    },
    {
      "type": "Feature",
      "properties": {
        "linha": "1",
        "stroke": "#e63946",
        "speed": 80,
        "dwell_s": 30,
        "headway_min": 5
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-43.200, -22.900],
          [-43.175, -22.905],
          [-43.150, -22.910]
        ]
      }
    }
  ]
}
```
