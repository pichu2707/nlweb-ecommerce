#!/usr/bin/env bash
# Arranca todos los servicios del prototipo Furnova
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
NLWEB_DIR="/home/javilazaro/Documents/NLWeb/AskAgent/python"
VENV="/home/javilazaro/Documents/NLWeb/.venv/bin/python"

export NLWEB_CONFIG_DIR="$ROOT/backend/config"
export OLLAMA_ENDPOINT="${OLLAMA_ENDPOINT:-http://localhost:11434}"
export QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
export NLWEB_PORT="${NLWEB_PORT:-8000}"
export GATEWAY_PORT="${GATEWAY_PORT:-3000}"

[ -f "$ROOT/.env" ] && set -a && source "$ROOT/.env" && set +a

echo "==> Verificando servicios previos..."

if ! curl -sf "$OLLAMA_ENDPOINT/api/tags" > /dev/null; then
  echo "ERROR: Ollama no responde en $OLLAMA_ENDPOINT"
  echo "       Arranca con: ollama serve"
  exit 1
fi
echo "    Ollama OK"

if ! curl -sf "$QDRANT_URL/healthz" > /dev/null; then
  echo "ERROR: Qdrant no responde en $QDRANT_URL"
  echo "       Arranca con: docker start qdrant-furnova"
  exit 1
fi
echo "    Qdrant OK"

echo ""
echo "==> Arrancando NLWeb (Python) en puerto $NLWEB_PORT..."
cd "$NLWEB_DIR"
PORT="$NLWEB_PORT" "$VENV" -m webserver.aiohttp_server &
NLWEB_PID=$!
echo "    PID: $NLWEB_PID"

# Espera hasta que NLWeb responda (máximo 15s)
echo -n "    Esperando que arranque..."
for i in $(seq 1 15); do
  sleep 1
  if curl -sf "http://localhost:$NLWEB_PORT/" -o /dev/null 2>/dev/null; then
    echo " listo."
    break
  fi
  echo -n "."
  if [ "$i" -eq 15 ]; then
    echo ""
    echo "ERROR: NLWeb no arrancó en 15 segundos. Revisa /tmp/nlweb.log"
    exit 1
  fi
done

echo ""
cd "$ROOT/gateway"
if [ ! -f "./target/release/furnova-gateway" ] || [ "src/main.rs" -nt "./target/release/furnova-gateway" ]; then
  echo "==> Compilando gateway Rust (primera vez o cambios detectados)..."
  cargo build --release -q 2>&1
fi
echo "==> Arrancando gateway Rust en puerto $GATEWAY_PORT..."
./target/release/furnova-gateway &
GATEWAY_PID=$!
echo "    PID: $GATEWAY_PID"
sleep 1

echo ""
echo "==> Arrancando frontend SolidJS..."
cd "$ROOT/frontend"
npm run dev -- --open &
FRONTEND_PID=$!
echo "    PID: $FRONTEND_PID"

echo ""
echo "================================================"
echo "  Furnova corriendo en http://localhost:5173"
echo "================================================"
echo "  Frontend  → http://localhost:5173"
echo "  Gateway   → http://localhost:$GATEWAY_PORT"
echo "  NLWeb API → http://localhost:$NLWEB_PORT"
echo "  Qdrant UI → http://localhost:6333/dashboard"
echo "================================================"
echo ""
echo "Ctrl+C para parar todos los servicios."

trap "echo ''; echo 'Parando servicios...'; kill $NLWEB_PID $GATEWAY_PID $FRONTEND_PID 2>/dev/null; echo 'OK'" EXIT INT TERM
wait
