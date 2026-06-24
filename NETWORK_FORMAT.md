# Formato GeoJSON de Rede

Este documento explica como estruturar um arquivo GeoJSON para que funcione corretamente com o Laboratório de Redes de Transporte. O aplicativo lê dois tipos de features: **pontos de estação** e **linhas de trilho**.

---

## Estrutura do arquivo

O arquivo deve ser um `FeatureCollection` GeoJSON válido. Você também pode incluir um objeto `network_defaults` no nível raiz para definir valores iniciais dos controles laterais para toda a rede:

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

Todos os campos em `network_defaults` são opcionais. Quando presentes, preenchem automaticamente os controles laterais ao carregar a rede — o usuário pode alterá-los livremente depois.

`reachability_thresholds_min` define os três limites de tempo (em minutos) mostrados no popup de cada estação como "X estações alcançáveis". O padrão é `[30, 45, 60]` para redes metro/suburbanas. Para redes de alta velocidade, use `[120, 240, 480]` (2h, 4h, 8h). Valores ≥ 60 que sejam múltiplos de 60 são exibidos como "2h", "4h" etc.

`traffic_multiplier` escala o tempo de carro retornado pelo OSRM (que assume fluxo livre, sem congestionamento). Um valor de `1.8` significa "dirigir leva 80% mais tempo no trânsito real do que o OSRM estima." Para o horário de pico do Rio de Janeiro, valores entre 1,5 e 2,5 são realistas. Deixe em `1.0` (padrão) para uma comparação conservadora.

| Campo | Unidade | Controle lateral |
|---|---|---|
| `network_name` | texto (ex.: `"TAV"`) | Rótulo no painel de comparação |
| `hyperlink` | URL (ex.: `"https://querometro.com/"`) | Chip de fonte no cabeçalho do app |
| `reachability_thresholds_min` | array de inteiros (ex.: `[30, 45, 60]`) | Limites de tempo no popup de estação |
| `accel_ms2` | m/s² | Aceleração |
| `walk_speed_kph` | km/h | Velocidade a pé |
| `transfer_penalty_min` | minutos | Penalidade de baldeação |
| `traffic_multiplier` | multiplicador (ex.: `1.8`) | Multiplicador de tráfego |

---

## Tipo de feature 1 — Estações (Point)

Cada estação é uma feature do tipo `Point`. As duas propriedades obrigatórias são `name` e `description`.

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

### `name` (obrigatório)
Nome de exibição da estação. Aparece nos passos da rota, nos tooltips e no cabeçalho dos popups.

### `description` (obrigatório para identificar as linhas)
String HTML listando todas as linhas que atendem esta estação. O aplicativo analisa este campo para saber quais linhas param aqui — é a **única** fonte confiável de filiação a linhas.

Cada entrada de linha deve ser um par de `<span>` aninhados neste formato exato:

```html
<span style="background-color: #HEX"><span style="color:#HEX">**Linha X**</span></span>
```

- O `background-color` do span externo é a cor de exibição da linha (usada em popups e badges de rota).
- O `color` do span interno é a cor do texto (branco em fundos escuros, preto em fundos claros).
- `**Linha X**` é o identificador da linha em negrito Markdown. `X` pode ser um número (`1`–`12`) ou uma letra (`A`–`E` para linhas expressas).

Várias linhas são separadas por quebras de linha (`\n`):

```
span da **Linha 1**
\n
span da **Linha 4**
```

#### Seções especiais na descrição

O parser para na primeira ocorrência de `**Rotas especiais**`. Tudo depois desse título é ignorado (rotas circulares — ver TODO no README).

Os trens expressos podem ser agrupados sob o título `**Trens expressos**`, mas o título em si não é obrigatório — o parser identifica as linhas expressas pelo identificador de letra (`A`–`E`), não pela seção.

```html
<span ...>**Linha 7**</span>

**Trens expressos**
<span ...>**Linha C**</span>
```

### `linha` (opcional, frequentemente não confiável)
Alguns exports do umap definem isso com o número da linha para estações de linha única, mas estações de baldeação frequentemente são marcadas como `"M"` (marcador multi-linha). **Não confie neste campo para identificar linhas** — sempre use `description`.

### `populacao_milhoes` / `pib_brl_bilhoes` (opcional, redes TAV)
População em milhões e PIB em bilhões de BRL para a cidade atendida por esta estação. Quando presentes, são exibidos no popup da estação.

---

## Tipo de feature 2 — Geometria da via (LineString)

Cada linha (ou ramal de uma linha) é uma feature do tipo `LineString`. Para linhas com ramais, use um `LineString` por ramal em vez de um `MultiLineString`.

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

### `linha` (obrigatório)
O identificador da linha. Deve corresponder ao identificador usado nos campos `description` das estações:
- Linhas metro/ferroviárias numeradas: `"1"`, `"2"`, … `"12"`
- Linhas expressas/suburbanas com letras: `"A"`, `"B"`, `"C"`, `"D"`, `"E"`

Este valor é o que o roteador usa para detectar trocas de linha (e portanto baldeações).

### `stroke` (obrigatório para cores corretas)
Cor hexadecimal desta linha, ex.: `"#ef9600"`. Usada ao renderizar a rede no mapa. Se ausente, a cor volta ao que foi analisado nas descrições das estações para o mesmo `linha`, depois para um verde padrão.

### `speed` (opcional)
Velocidade de projeto desta linha em **km/h**. Quando presente no primeiro `LineString` de cada tipo (metro ou expresso), preenche o controle de velocidade correspondente na barra lateral. O usuário pode alterar após o carregamento.

```json
"properties": { "linha": "1", "stroke": "#e63946", "speed": 300 }
```

### `dwell_s` (opcional)
Tempo de parada na estação em **segundos** — quanto tempo o trem fica parado em cada estação. Preenche o controle *Tempo de parada* na barra lateral ao carregar.

```json
"properties": { "linha": "1", "dwell_s": 30 }
```

### `headway_min` (opcional)
Frequência do serviço em **minutos** (intervalo entre trens). Preenche o controle *Frequência* na barra lateral ao carregar. A espera esperada em qualquer estação é `headway_min / 2`.

```json
"properties": { "linha": "1", "headway_min": 5 }
```

Para redes com linhas metro e expressas, o primeiro `LineString` de cada tipo (com letras vs. numerado) que declarar essas propriedades define o padrão para sua categoria.

### `linha-ramal` (opcional)
Identificador de ramal para linhas com múltiplos ramais (ex.: `"A1"`, `"A2"`). Não usado pelo roteador hoje, mas preservado para futura filtragem por ramal.

### `name` (opcional)
Nome legível da linha, ex.: `"Linha A :: Ramal Muriqui"`. Não usado pelo roteador.

---

## Padrões da barra lateral — como os valores do GeoJSON viram padrões editáveis

Ao carregar uma rede, o aplicativo lê `network_defaults` do `FeatureCollection` e `speed`, `dwell_s`, `headway_min` das features `LineString`. Esses valores são inseridos nos controles da barra lateral como valores iniciais. A barra lateral continua sendo a única fonte de verdade para cada cálculo de rota — você pode alterar qualquer controle a qualquer momento sem recarregar a rede.

Apenas o primeiro `LineString` de cada tipo (metro / expresso) que declarar uma determinada propriedade é usado; features `LineString` subsequentes do mesmo tipo são ignoradas para os padrões.

| Campo GeoJSON | Aplica-se a | Controle lateral |
|---|---|---|
| `network_defaults.network_name` | Ambos | Rótulo no painel de comparação (ex.: "TAV", "QUERO") |
| `network_defaults.hyperlink` | Ambos | Chip de fonte no cabeçalho — link externo para o site da rede |
| `network_defaults.reachability_thresholds_min` | Ambos | Limites de alcance nos popups de estação (ex.: `[30, 45, 60]` ou `[120, 240, 480]`) |
| `network_defaults.accel_ms2` | Ambos | Aceleração (m/s²) |
| `network_defaults.walk_speed_kph` | Ambos | Velocidade a pé (km/h) |
| `network_defaults.transfer_penalty_min` | Ambos | Penalidade de baldeação (min) |
| `network_defaults.traffic_multiplier` | Ambos | Multiplicador de tráfego (×) |
| `speed` em `LineString` numérico | Metro | Velocidade máxima — metro |
| `dwell_s` em `LineString` numérico | Metro | Tempo de parada — metro |
| `headway_min` em `LineString` numérico | Metro | Frequência — metro |
| `speed` em `LineString` com letra | Expresso | Velocidade máxima — expresso |
| `dwell_s` em `LineString` com letra | Expresso | Tempo de parada — expresso |
| `headway_min` em `LineString` com letra | Expresso | Frequência — expresso |

---

## Como o roteador usa essas features

1. **Passagem 1** — Todas as features `Point` são indexadas como nós do grafo. A filiação a linhas é lida a partir de `description`.
2. **Passagem 2** — Cada `LineString` é percorrido coordenada por coordenada. Sempre que uma coordenada estiver dentro de **300 m** de um nó de estação indexado, uma aresta é emitida entre essa estação e a anterior encontrada na mesma linha. Isso divide a linha em arestas por par de estações.
3. **Roteamento** — O algoritmo de Dijkstra encontra o caminho de menor tempo. Trocar de um `linha` para outro dispara uma penalidade de baldeação + tempo de espera.

### Implicação: coordenadas das estações devem estar próximas da via

As coordenadas `Point` das estações devem ser colocadas sobre ou muito próximas (dentro de ~300 m) das coordenadas correspondentes do `LineString`. Se uma estação estiver mais distante do que esse limiar, o roteador não a conectará à linha e a aresta não será dividida nessa estação — efetivamente tornando a estação invisível ao roteamento.

### Implicação: linhas se conectam por estações compartilhadas

Duas linhas se conectam se compartilharem um nó de estação (ou seja, existe uma feature `Point` próxima a ambas as geometrias `LineString` cuja `description` lista os dois IDs de linha). Não é necessário que os endpoints dos `LineString` se toquem — o snap de estação cuida das baldeações automaticamente.

---

## Expressas vs. linhas regulares

Linhas identificadas por uma letra (`A`–`E`) são tratadas como linhas **expressas** pelo motor de simulação e usam parâmetros separados de velocidade, tempo de parada e frequência (configuráveis na barra lateral). Todas as outras linhas usam os parâmetros regulares de metro.

A barra lateral oculta automaticamente os painéis irrelevantes ao carregar uma rede:
- Apenas linhas numeradas presentes → o painel *Trens expressos* é ocultado.
- Apenas linhas com letras presentes → o painel *Linhas metropolitanas* é ocultado.
- Ambos presentes, ou nenhum (IDs personalizados) → ambos os painéis são exibidos.

Se sua rede tiver uma divisão expresso/regular diferente, você pode ajustar a função `isExpressLine()` em `src/simulation.js`.

---

## Dicas para criar dados no umap (openstreetmap.fr/umap)

1. Desenhe cada linha como uma camada separada ou pelo menos marque cada feature com uma propriedade `linha`.
2. Posicione os marcadores de estação diretamente sobre o caminho da linha — clique na linha durante o desenho para encaixar nela.
3. No campo de descrição de cada estação, adicione o HTML `<span>` para cada linha que ela atende. A cor de fundo deve corresponder à cor `stroke` do `LineString` correspondente.
4. Exportar: **Menu da camada → Baixar dados → GeoJSON**. Se exportar todas as camadas de uma vez, use a exportação no nível do mapa (não por camada) para obter um único `FeatureCollection`.
5. Substitua `data/network.geojson` (ou `data/hsr-network.geojson`) pelo arquivo baixado e recarregue o aplicativo.

---

## Exemplo mínimo funcional

Uma rede de duas estações e uma linha que roteará corretamente:

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
