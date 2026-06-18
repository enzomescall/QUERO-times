import json
import random

random.seed(42)

CITIES = {
    # Southeast — RJ
    "Rio de Janeiro": {"lat": -22.9064, "lon": -43.2096, "pop": 6.75, "pib": 365.0},
    "Niterói": {"lat": -22.8833, "lon": -43.1036, "pop": 0.51, "pib": 30.0},
    "Volta Redonda": {"lat": -22.5231, "lon": -44.1042, "pop": 0.27, "pib": 12.0},
    "Macaé": {"lat": -22.3711, "lon": -41.7833, "pop": 0.26, "pib": 90.0},
    "Campos dos Goytacazes": {"lat": -21.7525, "lon": -41.3292, "pop": 0.51, "pib": 45.0},
    "Duque de Caxias": {"lat": -22.7858, "lon": -43.3117, "pop": 0.93, "pib": 45.0},
    "Petrópolis": {"lat": -22.5050, "lon": -43.1786, "pop": 0.31, "pib": 10.0},
    # Southeast — SP
    "São Paulo": {"lat": -23.5505, "lon": -46.6333, "pop": 12.40, "pib": 710.0},
    "Campinas": {"lat": -22.9058, "lon": -47.0608, "pop": 1.22, "pib": 62.0},
    "São José dos Campos": {"lat": -23.1896, "lon": -45.8858, "pop": 0.73, "pib": 55.0},
    "Aparecida": {"lat": -22.8469, "lon": -45.2297, "pop": 0.036, "pib": 1.2},
    "Jundiaí": {"lat": -23.1852, "lon": -46.8842, "pop": 0.42, "pib": 30.0},
    "Sorocaba": {"lat": -23.5017, "lon": -47.4594, "pop": 0.69, "pib": 35.0},
    "Itapetininga": {"lat": -23.5919, "lon": -48.0581, "pop": 0.16, "pib": 6.0},
    "Santos": {"lat": -23.9608, "lon": -46.3336, "pop": 0.43, "pib": 25.0},
    "Ribeirão Preto": {"lat": -21.1775, "lon": -47.8311, "pop": 0.71, "pib": 40.0},
    "Lavras": {"lat": -21.2450, "lon": -44.9997, "pop": 0.10, "pib": 4.0},
    "Varginha": {"lat": -21.5514, "lon": -45.4236, "pop": 0.14, "pib": 6.0},
    "Pouso Alegre": {"lat": -22.2267, "lon": -45.9364, "pop": 0.15, "pib": 5.0},
    # Southeast — MG
    "Belo Horizonte": {"lat": -19.9173, "lon": -43.9378, "pop": 2.52, "pib": 92.0},
    "Juiz de Fora": {"lat": -21.7595, "lon": -43.3468, "pop": 0.57, "pib": 22.0},
    "Barbacena": {"lat": -21.2219, "lon": -43.7732, "pop": 0.14, "pib": 5.0},
    "Conselheiro Lafaiete": {"lat": -20.6605, "lon": -43.7836, "pop": 0.13, "pib": 4.0},
    "Ouro Preto": {"lat": -20.3853, "lon": -43.4983, "pop": 0.075, "pib": 3.0},
    "Uberlândia": {"lat": -18.9125, "lon": -48.2833, "pop": 0.71, "pib": 38.0},
    "Uberaba": {"lat": -19.7475, "lon": -47.9321, "pop": 0.34, "pib": 16.0},
    "Sete Lagoas": {"lat": -19.4658, "lon": -44.2467, "pop": 0.24, "pib": 8.0},
    "Paracatu": {"lat": -17.2250, "lon": -46.8733, "pop": 0.09, "pib": 3.0},
    # Southeast — ES
    "Serra": {"lat": -20.1289, "lon": -40.2650, "pop": 0.53, "pib": 20.0},
    "Vila Velha": {"lat": -20.3297, "lon": -40.2875, "pop": 0.50, "pib": 15.0},
    "Cariacica": {"lat": -20.2642, "lon": -40.3889, "pop": 0.39, "pib": 8.0},
    "Vitória": {"lat": -20.3155, "lon": -40.3378, "pop": 0.37, "pib": 31.0},
    # South
    "Curitiba": {"lat": -25.4284, "lon": -49.2731, "pop": 1.96, "pib": 87.0},
    "Ponta Grossa": {"lat": -25.0950, "lon": -50.1628, "pop": 0.36, "pib": 15.0},
    "Joinville": {"lat": -26.3045, "lon": -48.8455, "pop": 0.60, "pib": 35.0},
    "Florianópolis": {"lat": -27.5954, "lon": -48.5482, "pop": 0.51, "pib": 27.0},
    "Criciúma": {"lat": -28.6775, "lon": -49.3725, "pop": 0.22, "pib": 8.0},
    "Porto Alegre": {"lat": -30.0346, "lon": -51.2183, "pop": 1.49, "pib": 70.0},
    "Londrina": {"lat": -23.3103, "lon": -51.1628, "pop": 0.58, "pib": 28.0},
    "Maringá": {"lat": -23.4253, "lon": -51.9386, "pop": 0.43, "pib": 22.0},
    "Cascavel": {"lat": -24.9558, "lon": -53.4567, "pop": 0.33, "pib": 15.0},
    "Foz do Iguaçu": {"lat": -25.5447, "lon": -54.5850, "pop": 0.26, "pib": 10.0},
    # Central-West
    "Brasília": {"lat": -15.7925, "lon": -47.8625, "pop": 3.06, "pib": 270.0},
    "Goiânia": {"lat": -16.6864, "lon": -49.2533, "pop": 1.54, "pib": 57.0},
    "Anápolis": {"lat": -16.3289, "lon": -48.9567, "pop": 0.39, "pib": 15.0},
    "Rio Verde": {"lat": -17.7975, "lon": -50.9981, "pop": 0.25, "pib": 12.0},
    "Rondonópolis": {"lat": -16.4669, "lon": -54.9097, "pop": 0.24, "pib": 12.0},
    "Cuiabá": {"lat": -15.5958, "lon": -56.1006, "pop": 0.62, "pib": 28.0},
    # Northeast
    "Salvador": {"lat": -12.9714, "lon": -38.4813, "pop": 2.90, "pib": 85.0},
    "Feira de Santana": {"lat": -12.2667, "lon": -38.9667, "pop": 0.62, "pib": 18.0},
    "Aracaju": {"lat": -10.9092, "lon": -37.0711, "pop": 0.67, "pib": 22.0},
    "Maceió": {"lat": -9.6663, "lon": -35.7353, "pop": 1.03, "pib": 28.0},
    "Recife": {"lat": -8.0546, "lon": -34.8778, "pop": 1.66, "pib": 65.0},
    "Paulista": {"lat": -7.9478, "lon": -34.8714, "pop": 0.34, "pib": 8.0},
    "Goiana": {"lat": -7.5636, "lon": -35.0025, "pop": 0.08, "pib": 2.0},
    "João Pessoa": {"lat": -7.1150, "lon": -34.8631, "pop": 0.83, "pib": 30.0},
    "Natal": {"lat": -5.7936, "lon": -35.2094, "pop": 0.89, "pib": 32.0},
    "Mossoró": {"lat": -5.1842, "lon": -37.3442, "pop": 0.30, "pib": 10.0},
    "Fortaleza": {"lat": -3.7189, "lon": -38.5575, "pop": 2.70, "pib": 75.0},
    # North
    "Belém": {"lat": -1.4558, "lon": -48.5044, "pop": 1.50, "pib": 38.0},
    "Santa Izabel do Pará": {"lat": -1.2989, "lon": -48.1606, "pop": 0.07, "pib": 1.0},
    "Castanhal": {"lat": -1.2972, "lon": -47.9264, "pop": 0.20, "pib": 4.0},
    "Bragança": {"lat": -1.0536, "lon": -46.7653, "pop": 0.13, "pib": 2.0},
    "São Luís": {"lat": -2.5294, "lon": -44.3083, "pop": 1.11, "pib": 35.0},
    # New additions — important regional cities near existing lines
    "Guarulhos": {"lat": -23.4628, "lon": -46.5333, "pop": 1.29, "pib": 50.0},
    "Piracicaba": {"lat": -22.7253, "lon": -47.6492, "pop": 0.36, "pib": 15.0},
    "Bauru": {"lat": -22.3147, "lon": -49.0606, "pop": 0.37, "pib": 14.0},
    "São José do Rio Preto": {"lat": -20.8197, "lon": -49.3794, "pop": 0.47, "pib": 18.0},
    "Caxias do Sul": {"lat": -29.1681, "lon": -51.1794, "pop": 0.52, "pib": 20.0},
    "Campina Grande": {"lat": -7.2306, "lon": -35.8811, "pop": 0.41, "pib": 10.0},
    "Caruaru": {"lat": -8.2833, "lon": -35.9761, "pop": 0.37, "pib": 8.0},
    "Pelotas": {"lat": -31.7717, "lon": -52.3425, "pop": 0.34, "pib": 10.0},
    "Montevideo": {"lat": -34.9011, "lon": -56.1645, "pop": 1.30, "pib": 35.0},
    "Buenos Aires": {"lat": -34.6037, "lon": -58.3816, "pop": 3.12, "pib": 150.0},
    "Villarrica": {"lat": -25.7809, "lon": -56.4493, "pop": 0.078, "pib": 1.5},
    "Asunción": {"lat": -25.2867, "lon": -57.3333, "pop": 0.52, "pib": 25.0},
}

def jitter(a, b, steps):
    coords = []
    lat_a, lon_a = a
    lat_b, lon_b = b
    for i in range(1, steps + 1):
        frac = i / (steps + 1)
        lat = lat_a + (lat_b - lat_a) * frac
        lon = lon_a + (lon_b - lon_a) * frac
        lat += random.uniform(-0.02, 0.02)
        lon += random.uniform(-0.02, 0.02)
        coords.append([round(lon, 4), round(lat, 4)])
    return coords

# Fixed waypoints for routes that must arc around geography (not stations)
FIXED_WAYPOINTS = {
    ("Montevideo", "Buenos Aires"): [
        (-34.8, -56.6), (-34.7, -57.0), (-34.6, -57.4),
        (-34.5, -57.8), (-34.5, -58.0), (-34.55, -58.2),
    ],
}

def build_track(stations, steps=5):
    coords = []
    for i in range(len(stations) - 1):
        c1 = (CITIES[stations[i]]["lat"], CITIES[stations[i]]["lon"])
        c2 = (CITIES[stations[i + 1]]["lat"], CITIES[stations[i + 1]]["lon"])
        coords.append([round(c1[1], 4), round(c1[0], 4)])
        key = (stations[i], stations[i + 1])
        if key in FIXED_WAYPOINTS:
            for wlat, wlon in FIXED_WAYPOINTS[key]:
                wlat += random.uniform(-0.015, 0.015)
                wlon += random.uniform(-0.015, 0.015)
                coords.append([round(wlon, 4), round(wlat, 4)])
        else:
            coords.extend(jitter(c1, c2, steps))
    last = CITIES[stations[-1]]
    coords.append([round(last["lon"], 4), round(last["lat"], 4)])
    return coords

def station_desc(name, linhas):
    spans = []
    for lid, color, text_color in linhas:
        spans.append(
            f'<span style="background-color: {color}"><span style="color:{text_color}">**Linha {lid}**</span></span>'
        )
    return "\n".join(spans)

LINE_COLORS = {
    "1": "#e63946",
    "2": "#f4a261",
    "3": "#2a9d8f",
    "4": "#264653",
    "5": "#e9c46a",
    "6": "#d62828",
    "7": "#457b9d",
    "8": "#1d3557",
    "9": "#2b9348",
    "10": "#0077b6",
    "11": "#e07a5f",
    "12": "#3d405b",
}

# Line definitions: (id, name, main_stations, branch_stations_list)
# branch_stations_list is a list of (branch_track_name, stations) for extra branches

LINES = [
    {
        "id": "1",
        "name": "LEX-01 — Linha Expressa Litoral",
        "main": ["Rio de Janeiro", "Duque de Caxias", "Volta Redonda", "Aparecida", "São José dos Campos", "Guarulhos", "São Paulo", "Jundiaí", "Campinas"],
        "branches": [
            ("LEX-01 — Ramal Leste", ["Rio de Janeiro", "Niterói", "Macaé", "Campos dos Goytacazes", "Vitória"]),
            ("LEX-01 — Ramal Santos", ["São Paulo", "Santos"]),
        ],
    },
    {
        "id": "2",
        "name": "LEX-02 — Linha Expressa Central",
        "main": ["Rio de Janeiro", "Duque de Caxias", "Petrópolis", "Juiz de Fora", "Barbacena", "Ouro Preto", "Belo Horizonte"],
        "branches": [],
    },
    {
        "id": "3",
        "name": "LEX-03 — Linha Expressa Sul",
        "main": ["São Paulo", "Sorocaba", "Itapetininga", "Curitiba"],
        "branches": [],
    },
    {
        "id": "4",
        "name": "LEX-04 — Linha Expressa Planalto",
        "main": ["Campinas", "Piracicaba", "Ribeirão Preto", "Uberaba", "Uberlândia", "Brasília"],
        "branches": [
            ("LEX-04 — Ramal Bauru", ["Piracicaba", "Bauru"]),
            ("LEX-04 — Ramal Rio Preto", ["Ribeirão Preto", "São José do Rio Preto"]),
        ],
    },
    {
        "id": "5",
        "name": "LEX-05 — Linha Expressa Centro-Oeste (antigas 5 + 11)",
        "main": ["Brasília", "Anápolis", "Goiânia", "Rio Verde", "Rondonópolis", "Cuiabá"],
        "branches": [],
    },
    {
        "id": "6",
        "name": "LEX-06 — Linha Expressa Sul Litorânea",
        "main": ["Curitiba", "Joinville", "Florianópolis", "Criciúma", "Caxias do Sul", "Porto Alegre", "Pelotas", "Montevideo", "Buenos Aires"],
        "branches": [],
    },
    {
        "id": "7",
        "name": "LEX-07 — Linha Expressa Nordeste Litoral Norte",
        "main": ["Recife", "Paulista", "Goiana", "João Pessoa", "Natal", "Mossoró", "Fortaleza"],
        "branches": [
            ("LEX-07 — Ramal Campina Grande", ["João Pessoa", "Campina Grande"]),
        ],
    },
    {
        "id": "8",
        "name": "LEX-08 — Linha Expressa Nordeste Litoral Sul",
        "main": ["Salvador", "Feira de Santana", "Aracaju", "Maceió", "Recife"],
        "branches": [
            ("LEX-08 — Ramal Caruaru", ["Recife", "Caruaru"]),
        ],
    },
    {
        "id": "9",
        "name": "LEX-09 — Linha Expressa Norte",
        "main": ["Belém", "Santa Izabel do Pará", "Castanhal", "Bragança", "São Luís"],
        "branches": [],
    },
    {
        "id": "10",
        "name": "LEX-10 — Linha Expressa Triângulo",
        "main": ["Belo Horizonte", "Sete Lagoas", "Paracatu", "Brasília"],
        "branches": [],
    },
    {
        "id": "11",
        "name": "LEX-11 — Linha Expressa Minas–São Paulo",
        "main": ["Belo Horizonte", "Lavras", "Varginha", "Pouso Alegre", "São Paulo"],
        "branches": [],
    },
    {
        "id": "12",
        "name": "LEX-12 — Linha Expressa Londrina",
        "main": ["Curitiba", "Ponta Grossa", "Londrina", "Maringá", "Cascavel", "Foz do Iguaçu"],
        "branches": [
            ("LEX-12 — Ramal Paraguai", ["Foz do Iguaçu", "Villarrica", "Asunción"]),
        ],
    },
]

# Build station line membership map
station_lines = {}
for line in LINES:
    lid = line["id"]
    all_stations = list(line["main"])
    for branch in line["branches"]:
        all_stations.extend(branch[1])
    for s in all_stations:
        station_lines.setdefault(s, set()).add(lid)

TRACK_PARAMS = {
    "LEX-01 — Linha Expressa Litoral":               (280, 180, 30),
    "LEX-01 — Ramal Leste":                          (250, 180, 60),
    "LEX-01 — Ramal Santos":                         (200, 120, 60),
    "LEX-02 — Linha Expressa Central":               (250, 180, 30),
    "LEX-03 — Linha Expressa Sul":                   (250, 180, 30),
    "LEX-04 — Linha Expressa Planalto":              (280, 180, 30),
    "LEX-04 — Ramal Bauru":                          (250, 120, 60),
    "LEX-04 — Ramal Rio Preto":                      (250, 120, 60),
    "LEX-05 — Linha Expressa Centro-Oeste (antigas 5 + 11)": (280, 180, 60),
    "LEX-06 — Linha Expressa Sul Litorânea":         (250, 180, 30),
    "LEX-07 — Linha Expressa Nordeste Litoral Norte": (280, 180, 60),
    "LEX-07 — Ramal Campina Grande":                 (200, 120, 60),
    "LEX-08 — Linha Expressa Nordeste Litoral Sul":  (280, 180, 60),
    "LEX-08 — Ramal Caruaru":                        (200, 120, 60),
    "LEX-09 — Linha Expressa Norte":                 (250, 180, 60),
    "LEX-10 — Linha Expressa Triângulo":             (280, 180, 60),
    "LEX-11 — Linha Expressa Minas–São Paulo":       (250, 180, 60),
    "LEX-12 — Linha Expressa Londrina":              (250, 180, 60),
}

features = []

# Station features
for name, data in CITIES.items():
    if name not in station_lines:
        continue
    lids = sorted(station_lines[name], key=lambda x: int(x) if x.isdigit() else x)
    desc_lines = [(lid, LINE_COLORS[lid], "#ffffff") for lid in lids]
    features.append({
        "type": "Feature",
        "properties": {
            "name": name.upper(),
            "description": station_desc(name, desc_lines),
            "populacao_milhoes": CITIES[name]["pop"],
            "pib_brl_bilhoes": CITIES[name]["pib"],
        },
        "geometry": {
            "type": "Point",
            "coordinates": [data["lon"], data["lat"]],
        },
    })

# Track features
for line in LINES:
    lid = line["id"]
    color = LINE_COLORS[lid]
    # Main track
    main_coords = build_track(line["main"], steps=5)
    speed, dwell, headway = TRACK_PARAMS.get(line["name"], (250, 180, 60))
    features.append({
        "type": "Feature",
        "properties": {
            "name": line["name"],
            "linha": lid,
            "speed": speed,
            "dwell_s": dwell,
            "headway_min": headway,
            "stroke": color,
            "stroke-width": 3,
            "stroke-opacity": 1,
        },
        "geometry": {
            "type": "LineString",
            "coordinates": main_coords,
        },
    })
    # Branch tracks
    for branch_name, branch_stations in line["branches"]:
        branch_coords = build_track(branch_stations, steps=4)
        speed, dwell, headway = TRACK_PARAMS.get(branch_name, (200, 120, 60))
        features.append({
            "type": "Feature",
            "properties": {
                "name": branch_name,
                "linha": lid,
                "speed": speed,
                "dwell_s": dwell,
                "headway_min": headway,
                "stroke": color,
                "stroke-width": 3,
                "stroke-opacity": 1,
            },
            "geometry": {
                "type": "LineString",
                "coordinates": branch_coords,
            },
        })

collection = {
    "type": "FeatureCollection",
    "network_defaults": {
        "accel_ms2": 0.5,
        "walk_speed_kph": 4.5,
        "transfer_penalty_min": 15,
    },
    "features": features,
}

with open("/home/enzo/Documents/Code/QUERO-times/data/hsr-network.geojson", "w") as f:
    json.dump(collection, f, ensure_ascii=False, indent=2)

print(f"Generated {len(features)} features")
st = sum(1 for f in features if f["geometry"]["type"] == "Point")
tr = sum(1 for f in features if f["geometry"]["type"] == "LineString")
print(f"  Stations: {st}")
print(f"  Tracks: {tr}")
