#!/usr/bin/env bash
# Ingesta el catálogo de Furnova en Qdrant local vía NLWeb
set -euo pipefail

NLWEB_DIR="/home/javilazaro/Documents/NLWeb/AskAgent/python"
CATALOG_FILE="$(dirname "$0")/../data/catalog/products.jsonl"
SITE="furnova.com"

# Config override: usa nuestros archivos de config, no los de NLWeb
export NLWEB_CONFIG_DIR="$(dirname "$0")/../config"

# Endpoint Ollama (default local)
export OLLAMA_ENDPOINT="${OLLAMA_ENDPOINT:-http://localhost:11434}"

echo "==> Verificando que Ollama está activo..."
if ! curl -sf "${OLLAMA_ENDPOINT}/api/tags" > /dev/null; then
  echo "ERROR: Ollama no responde en ${OLLAMA_ENDPOINT}"
  echo "       Arranca con: ollama serve"
  exit 1
fi

echo "==> Verificando modelo de embeddings (nomic-embed-text)..."
if ! curl -sf "${OLLAMA_ENDPOINT}/api/tags" | grep -q "nomic-embed-text"; then
  echo "Descargando nomic-embed-text..."
  ollama pull nomic-embed-text
fi

echo "==> Lanzando ingesta del catálogo..."
cd "$NLWEB_DIR"
python -m data_loading.db_load \
  "$CATALOG_FILE" \
  "$SITE" \
  --delete-site \
  --database qdrant_local

echo ""
echo "==> Ingesta completada. Productos indexados en Qdrant local."
echo "    Ruta DB: $(dirname "$0")/../data/db"
