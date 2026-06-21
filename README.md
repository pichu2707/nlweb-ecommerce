# NLTravel — Prototipo de búsqueda semántica para viajes

Demostración funcional de búsqueda en lenguaje natural sobre un catálogo de destinos turísticos y alojamientos. El usuario escribe lo que busca con sus propias palabras y el sistema devuelve resultados relevantes en streaming, con el fondo de la interfaz adaptándose al tipo de destino detectado.

## Qué hace

- Busca por intención, no por palabras exactas: "algo barato en la montaña para esquiar" funciona
- Los resultados aparecen en la pantalla conforme llegan, sin esperar a que termine la búsqueda
- El fondo cambia de color según el destino: azul turquesa para playa, verde para jungla, índigo nocturno para auroras boreales, etc.
- Filtros de tipo de alojamiento y ordenación por precio o valoración aplicados en cliente
- Imágenes por destino, tipos de habitación, precios y valoraciones

## Stack técnico

```
Frontend  →  SolidJS + Vite          (puerto 5173)
Gateway   →  Rust / Axum             (puerto 3000)
Backend   →  Python / NLWeb          (puerto 8000)
Búsqueda  →  Qdrant (Docker)         (puerto 6333)
LLM       →  Ollama local            (puerto 11434)
Embeddings→  nomic-embed-text (Ollama)
Ranking   →  llama3.2:3b (Ollama)
```

El gateway Rust actúa como proxy SSE entre el frontend y NLWeb: mantiene las conexiones de streaming abiertas de forma eficiente y añade la capa de CORS y rate limiting sin tocar el código Python.

---

## Requisitos previos

Instala estas herramientas antes de continuar:

| Herramienta | Versión mínima | Instalación |
|---|---|---|
| Python | 3.13 | Sistema |
| Node.js | 18+ | Sistema |
| Rust / Cargo | 1.75+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Docker | cualquiera | Sistema |
| Ollama | cualquiera | `curl -fsSL https://ollama.com/install.sh \| sh` |

También necesitas el repositorio de NLWeb clonado en `~/Documents/NLWeb`:

```bash
git clone https://github.com/microsoft/NLWeb ~/Documents/NLWeb
```

---

## Instalación (primera vez)

### 1. Modelos de Ollama

```bash
# Arranca el servidor Ollama en una terminal separada
ollama serve

# En otra terminal, descarga los modelos necesarios
ollama pull nomic-embed-text   # embeddings — 274 MB
ollama pull llama3.2:3b        # ranking y análisis — ~2 GB
```

### 2. Dependencias Python de NLWeb

```bash
python3 -m venv ~/Documents/NLWeb/.venv
~/Documents/NLWeb/.venv/bin/pip install -r ~/Documents/NLWeb/AskAgent/python/requirements.txt
~/Documents/NLWeb/.venv/bin/pip install ollama
```

Hay un bug en `qdrant-client` con Python 3.13 en Debian/Ubuntu que rompe la importación de `sqlite3`. Aplica este parche:

```bash
sed -i 's/^import sqlite3$/try:\n    import sqlite3\nexcept ImportError:\n    sqlite3 = None  # type: ignore[assignment]/' \
  ~/Documents/NLWeb/.venv/lib/python3.13/site-packages/qdrant_client/local/persistence.py
```

### 3. Base de datos vectorial (Qdrant)

```bash
docker run -d \
  --name qdrant-furnova \
  -p 6333:6333 \
  -v ~/Documents/nlweb-ecommerce/backend/data/db:/qdrant/storage \
  qdrant/qdrant:latest
```

Verifica que responde:

```bash
curl http://localhost:6333/healthz
# Respuesta esperada: healthz check passed
```

### 4. Dependencias del frontend

```bash
cd ~/Documents/nlweb-ecommerce/frontend
npm install
```

### 5. Indexar el catálogo

Solo es necesario la primera vez o cuando añadas nuevos destinos:

```bash
export OLLAMA_ENDPOINT=http://localhost:11434
export NLWEB_CONFIG_DIR=~/Documents/nlweb-ecommerce/backend/config
export QDRANT_URL=http://localhost:6333

cd ~/Documents/NLWeb/AskAgent/python
~/Documents/NLWeb/.venv/bin/python -m data_loading.db_load \
  ~/Documents/nlweb-ecommerce/backend/data/catalog/travels.jsonl \
  localhost \
  --database qdrant_server
```

Verás algo como: `Loading completed. Added 21 documents to the database.`

---

## Arranque diario

Una vez instalado, el flujo normal es:

```bash
# Terminal 1: Ollama (si no está corriendo como servicio)
ollama serve

# Terminal 2: Qdrant (si el contenedor está parado)
docker start qdrant-furnova

# Terminal 3: todo el stack
cd ~/Documents/nlweb-ecommerce
./start.sh
```

El script `start.sh` arranca NLWeb, el gateway Rust y el frontend en ese orden, y espera a que cada servicio esté listo antes de continuar. Abre `http://localhost:5173` cuando veas el mensaje de confirmación.

Para parar todo: `Ctrl+C` en la terminal donde corre `start.sh`.

---

## Si algo falla

### Error 502 en el frontend

NLWeb no está corriendo. El gateway arranca pero no tiene a quién proxear.

```bash
# Verifica qué puertos están activos
fuser 8000/tcp && echo "NLWeb OK" || echo "NLWeb NO está corriendo"
fuser 3000/tcp && echo "Gateway OK" || echo "Gateway NO está corriendo"

# Arranca NLWeb manualmente
export OLLAMA_ENDPOINT=http://localhost:11434
export NLWEB_CONFIG_DIR=~/Documents/nlweb-ecommerce/backend/config
export QDRANT_URL=http://localhost:6333
export PORT=8000
cd ~/Documents/NLWeb/AskAgent/python
~/Documents/NLWeb/.venv/bin/python -m webserver.aiohttp_server
```

### Sin resultados en las búsquedas

El catálogo no está indexado o Qdrant no está corriendo.

```bash
# Verifica Qdrant
curl http://localhost:6333/collections/furnova_collection
# Debe mostrar "points_count": 21

# Si el contenedor está parado
docker start qdrant-furnova

# Si la colección está vacía, re-indexa
cd ~/Documents/nlweb-ecommerce && ./backend/scripts/ingest.sh
```

### Ollama no responde

```bash
# Verifica si está corriendo
curl http://localhost:11434/api/tags

# Si no responde, arráncalo
ollama serve &

# Verifica que los modelos están descargados
ollama list
# Debe mostrar: nomic-embed-text y llama3.2:3b
```

### El gateway Rust no compila

```bash
cd ~/Documents/nlweb-ecommerce/gateway
cargo build --release
# Si falla por dependencias del sistema, instala: sudo apt install pkg-config libssl-dev
```

---

## Añadir imágenes propias

El catálogo usa imágenes de Lorem Picsum por defecto (`https://picsum.photos/seed/...`). Para usar imágenes reales:

### Opción A — Imágenes locales servidas por el frontend

Coloca las imágenes en `frontend/public/images/`:

```
frontend/public/images/
  cancun-grand-reef.jpg
  chamonix-chalet.jpg
  ...
```

Edita `backend/data/catalog/travels.jsonl` y cambia el campo `"image"` de cada entrada:

```json
"image": "/images/cancun-grand-reef.jpg"
```

Después re-indexa el catálogo:

```bash
./backend/scripts/ingest.sh
```

### Opción B — Imágenes en un servidor externo o CDN

Cambia el campo `"image"` en el JSONL a la URL completa de tu CDN:

```json
"image": "https://mi-cdn.com/destinos/cancun.jpg"
```

El frontend carga cualquier URL válida. Si la imagen falla, muestra un emoji del tipo de alojamiento como fallback.

### Formato recomendado

- Tamaño: **800×500 px** mínimo (proporción 16:10)
- Peso: menos de 200 KB por imagen (usa WebP si puedes)
- Nombrado: `[id-del-destino].jpg` para mantenerlo ordenado

---

## Añadir nuevos destinos

Cada línea de `backend/data/catalog/travels.jsonl` es un destino. El formato es:

```
URL_INTERNA[TAB]JSON_SCHEMA_ORG
```

Ejemplo mínimo para un hotel nuevo:

```jsonl
http://localhost:5173/destino/mi-hotel-id	{"@type":"LodgingBusiness","name":"Nombre del Hotel","description":"Descripción completa del alojamiento y su entorno. Cuanto más detallada, mejor funciona la búsqueda semántica.","url":"http://localhost:5173/destino/mi-hotel-id","image":"https://picsum.photos/seed/mi-seed/800/500","address":{"@type":"PostalAddress","addressLocality":"Ciudad","addressCountry":"ES"},"priceRange":"€€","amenityFeature":[{"@type":"LocationFeatureSpecification","name":"Tipo","value":"Hotel"},{"@type":"LocationFeatureSpecification","name":"Habitación doble","value":"Disponible"}],"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.5","reviewCount":"100"},"offers":{"@type":"Offer","price":"90","priceCurrency":"EUR","description":"por noche, habitación doble"},"keywords":"playa,ciudad,naturaleza"}
```

Campos obligatorios: `@type`, `name`, `description`, `url`, `address.addressCountry`, `amenityFeature` (con entrada `Tipo`), `offers.price`.

Campos que mejoran los resultados de búsqueda: `keywords`, `description` detallada, `amenityFeature` con todas las características del alojamiento.

Después de añadir entradas, re-indexa:

```bash
./backend/scripts/ingest.sh
```

### Tipos de alojamiento reconocidos por la UI

`Hotel`, `Hostal`, `Resort`, `Lodge`, `Camping`, `Glamping`, `Riad`, `Chalet`, `Hotel Cápsula`, `Safari Lodge`, `Lodge Ecológico`

---

## Cómo funciona la búsqueda

```
Usuario escribe query
        │
        ▼
SolidJS → POST /search (gateway Rust :3000)
        │
        ▼
Gateway → POST /ask (NLWeb Python :8000)
        │
        ▼
NLWeb:
  1. Genera embedding de la query con nomic-embed-text (Ollama)
  2. Busca los 50 destinos más cercanos en Qdrant (similitud coseno)
  3. Por cada resultado, llama a llama3.2:3b para asignar score 0-100
  4. Envía cada resultado rankeado como evento SSE en cuanto está listo
        │
        ▼ eventos SSE en streaming
Gateway → frontend (SSE passthrough)
        │
        ▼
SolidJS procesa cada event:result
  → añade TravelCard al grid inmediatamente
  → al recibir event:complete reordena por score
```

El fondo del header cambia en el momento en que se lanza la búsqueda, sin esperar los resultados, basándose en palabras clave de la query.

---

## Estructura del proyecto

```
nlweb-ecommerce/
├── start.sh                        # Arranca todos los servicios
├── .env                            # Variables de entorno (no subir a git)
├── .env.example                    # Plantilla de variables
│
├── backend/
│   ├── config/
│   │   ├── config_llm.yaml         # Proveedor LLM: Ollama / OpenAI
│   │   ├── config_embedding.yaml   # Proveedor embeddings: Ollama / OpenAI
│   │   ├── config_retrieval.yaml   # Base de datos vectorial: Qdrant
│   │   ├── config_nlweb.yaml       # Comportamiento NLWeb (features on/off)
│   │   ├── prompts.xml             # → symlink a NLWeb/config/prompts.xml
│   │   └── tools.xml               # → symlink a NLWeb/config/tools.xml
│   ├── data/
│   │   ├── catalog/
│   │   │   └── travels.jsonl       # Catálogo de destinos (edita aquí)
│   │   ├── db/                     # Datos persistentes de Qdrant (Docker volume)
│   │   └── embeddings/             # Cache de embeddings generados
│   └── scripts/
│       └── ingest.sh               # Re-indexa el catálogo en Qdrant
│
├── gateway/
│   ├── src/main.rs                 # Proxy SSE en Rust/Axum
│   ├── Cargo.toml
│   └── target/release/             # Binario compilado (generado automáticamente)
│
└── frontend/
    ├── index.html
    ├── vite.config.js              # Proxy /search → gateway :3000
    └── src/
        ├── App.jsx                 # Layout principal + fondo dinámico
        ├── index.jsx               # Punto de entrada
        ├── components/
        │   ├── SearchBar.jsx       # Input + sugerencias + filtros
        │   ├── TravelCard.jsx      # Card de cada alojamiento
        │   └── ResultsGrid.jsx     # Grid de resultados con estados
        └── stores/
            └── search.js           # Estado global: búsqueda, filtros, escena
```

---

## Referencia de archivos de configuración

### `backend/config/config_nlweb.yaml`

Controla el comportamiento general de NLWeb. Los flags más relevantes para este proyecto:

```yaml
sites: "localhost"              # Filtra resultados al site indexado
tool_selection_enabled: false   # Desactivado: con llama3.2:3b el selector de herramientas
                                # genera resultados incorrectos. Actívalo con modelos mayores.
analyze_query_enabled: false    # Desactivado: el análisis de tipo de ítem es innecesario
                                # con un catálogo homogéneo de alojamientos.
decontextualize_enabled: false  # Desactivado: la decontextualización con llama3.2:3b
                                # produce queries absurdas. Actívalo con OpenAI/Claude.
memory_enabled: false           # Desactivado: no hay sesiones persistentes en el prototipo.
```

Cuando uses un LLM más capaz (OpenAI, Anthropic), puedes poner `tool_selection_enabled: true`, `analyze_query_enabled: true` y `decontextualize_enabled: true` para activar la búsqueda conversacional completa — por ejemplo, que "y algo más barato" funcione como pregunta de seguimiento.

---

### `backend/config/config_llm.yaml`

Define qué proveedor de LLM usa NLWeb para ranking, análisis de queries y selección de herramientas. Cada proveedor tiene un modelo `high` (para ranking, donde la calidad importa) y `low` (para tareas simples como clasificar relevancia).

El campo `preferred_endpoint` determina cuál se usa por defecto. Puedes tener varios configurados y cambiar entre ellos sin tocar código.

---

### `backend/config/config_embedding.yaml`

Define el proveedor de embeddings. Los embeddings convierten texto en vectores numéricos para la búsqueda semántica. El proveedor aquí debe ser **coherente con el modelo usado al indexar** — si indexaste con `nomic-embed-text` de Ollama, las búsquedas también deben usar ese mismo modelo. Cambiar de proveedor sin re-indexar el catálogo da resultados incorrectos.

---

### `backend/config/config_retrieval.yaml`

Define la base de datos vectorial. En este proyecto usa Qdrant corriendo en Docker. El campo `write_endpoint` determina dónde se escriben los datos durante la ingesta.

---

### `backend/config/prompts.xml` (symlink → NLWeb)

Contiene todos los prompts que NLWeb envía al LLM durante el procesamiento de una query. Cada prompt está identificado por un `ref` y agrupa la instrucción (`promptString`) con el JSON que debe devolver el modelo (`returnStruc`).

Los más relevantes para entender cómo funciona el sistema:

| Prompt | Cuándo se ejecuta | Qué hace |
|---|---|---|
| `RankingPrompt` | Por cada resultado de Qdrant | Asigna score 0-100 al ítem respecto a la query. Es la llamada LLM más frecuente: se ejecuta hasta 50 veces por búsqueda. |
| `DetectIrrelevantQueryPrompt` | Al inicio de cada query | Decide si la query tiene algo que ver con el catálogo. Evita buscar "recetas de pasta" en un catálogo de viajes. |
| `PrevQueryDecontextualizer` | Cuando hay queries previas en la conversación | Reescribe "y algo más barato" como "hotel económico en Barcelona" usando el contexto de la pregunta anterior. |
| `QueryRewrite` | Antes de la búsqueda vectorial | Descompone queries complejas en hasta 5 queries más simples para mejorar la cobertura del vector search. Con llama3.2:3b funciona mal; con modelos mayores mejora significativamente. |
| `DetectMemoryRequestPrompt` | Al inicio de cada query | Detecta si el usuario pide recordar algo para futuras búsquedas ("recuerda que soy vegano"). |
| `SummarizeResultsPrompt` | Modo `generate` | Sintetiza todos los resultados en una respuesta de texto en vez de lista de cards. |
| `CompareItemsPrompt` | Tool `compare` | Compara dos ítems específicos del catálogo lado a lado. |

Puedes modificar los prompts para adaptar el comportamiento a tu dominio. Por ejemplo, cambiar `RankingPrompt` para dar más peso al precio o la ubicación en el score.

---

### `backend/config/tools.xml` (symlink → NLWeb)

Define las herramientas disponibles para cada tipo de query, organizadas por `<Site>` y tipo de ítem (`<Item>`, `<Recipe>`, etc.). Cuando `tool_selection_enabled: true`, el LLM lee estos prompts y decide cuál herramienta usar.

Las herramientas activas en el site `default`:

| Tool | Handler | Cuándo la activa el LLM |
|---|---|---|
| `search` | builtin | La mayoría de queries: "hoteles en Cancún", "algo barato en la montaña" |
| `details` | `methods.item_details` | El usuario pregunta por un ítem específico por nombre: "detalles del Grand Reef Hotel" |
| `compare` | `methods.compare_items` | El usuario quiere comparar dos ítems: "compara el hostal de Barcelona con el de Tokyo" |
| `ensemble` | `methods.ensemble_tool` | El usuario pide varios ítems relacionados: "planifícame un viaje a Japón con hotel y actividades" |
| `statistics_query` | `methods.statistics_handler` | Queries de datos estadísticos geográficos (no aplica en viajes) |

Para añadir una herramienta propia (por ejemplo, `booking` que conecte con una API de reservas), añade un bloque `<Tool>` en este archivo con su prompt y el handler Python que lo implementa.

---

## Cambiar el proveedor LLM

El sistema funciona con Ollama local por defecto (sin coste, sin internet). Para usar OpenAI y obtener mejor calidad de ranking:

Edita `backend/config/config_llm.yaml`:

```yaml
preferred_endpoint: openai

endpoints:
  openai:
    api_key_env: OPENAI_API_KEY
    llm_type: openai
    models:
      high: gpt-4.1-mini
      low: gpt-4.1-mini
```

Añade tu API key al `.env`:

```bash
OPENAI_API_KEY=sk-...
```

Y haz lo mismo en `backend/config/config_embedding.yaml` si quieres usar embeddings de OpenAI (`text-embedding-3-small`). Con OpenAI los resultados son notablemente mejores y más rápidos, pero tienen coste por búsqueda.

---

## Limitaciones conocidas del prototipo

**LLM de ranking con llama3.2:3b en CPU**
El modelo es pequeño. El ranking es funcional pero puede hacer asociaciones semánticas inesperadas. Con un modelo más grande (llama3.1:8b, OpenAI, Anthropic) la calidad mejora significativamente.

**Sin página de detalle**
Los enlaces de cada card apuntan a `localhost:5173/destino/...` pero esa ruta no existe en el frontend todavía. El siguiente paso natural es añadir una página de detalle del alojamiento con galería de imágenes y formulario de reserva.

**Catálogo pequeño**
Con 21 destinos, el vector search devuelve todos los resultados en cualquier búsqueda. El ranking es lo que diferencia unos de otros. Con miles de destinos el vector search filtra mucho más y el sistema escala mejor.

**Sin persistencia de sesión**
Cada búsqueda es independiente. No hay historial ni conversación multi-turno activada. NLWeb soporta esto pero está desactivado para simplificar el prototipo.

---

## Próximos pasos sugeridos

- Página de detalle por destino con galería de imágenes
- Búsqueda conversacional: "y algo más barato" después de una búsqueda previa
- NLWebScorer + JAX para ranking sin LLM (elimina el coste y la latencia de Ollama en ranking)
- API externa de catálogo: endpoint REST que devuelva JSONL para ingestar desde cualquier fuente
- Modo servidor separado: mover NLWeb + Qdrant a un servidor dedicado y conectar el gateway remotamente
