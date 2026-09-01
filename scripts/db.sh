#!/usr/bin/env bash
# Minimal TimescaleDB harness. Uses plain `docker run` so it works with or
# without the docker compose plugin.
set -euo pipefail

NAME="${TIGERLAB_CONTAINER:-tigerdb-lab}"
IMAGE="${TIGERLAB_IMAGE:-timescale/timescaledb-ha:pg17}"
PORT="${PGPORT:-5433}"
PASSWORD="${PGPASSWORD:-tigerlab}"
DATABASE="${PGDATABASE:-tigerlab}"

running() { [ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null || echo false)" = "true" ]; }
exists()  { docker inspect "$NAME" >/dev/null 2>&1; }

# pg_isready succeeds against the image's temporary bootstrap server, so we
# additionally require a real query to succeed twice in a row before continuing.
wait_ready() {
  printf 'Waiting for PostgreSQL'
  hits=0
  for _ in $(seq 1 120); do
    if docker exec "$NAME" psql -U postgres -d "$DATABASE" -qtAc 'SELECT 1' >/dev/null 2>&1; then
      hits=$((hits + 1))
      [ "$hits" -ge 2 ] && { printf ' ready.\n'; return 0; }
    else
      hits=0
    fi
    printf '.'
    sleep 1
  done
  printf '\nDatabase did not become ready in time. Check: %s logs\n' "$0" >&2
  return 1
}

up() {
  if running; then
    echo "Container '$NAME' is already running on port $PORT."
  else
    if exists; then
      echo "Starting existing container '$NAME'..."
      docker start "$NAME" >/dev/null
    else
      echo "Creating container '$NAME' from $IMAGE..."
      docker run -d --name "$NAME" \
        -e POSTGRES_PASSWORD="$PASSWORD" \
        -e POSTGRES_DB="$DATABASE" \
        -p "$PORT:5432" \
        "$IMAGE" >/dev/null
    fi
  fi
  wait_ready
  version=''
  for _ in $(seq 1 15); do
    docker exec "$NAME" psql -U postgres -d "$DATABASE" -qtAc \
      "CREATE EXTENSION IF NOT EXISTS timescaledb; CREATE EXTENSION IF NOT EXISTS timescaledb_toolkit;" >/dev/null 2>&1 || true
    version=$(docker exec "$NAME" psql -U postgres -d "$DATABASE" -qtAc \
      "SELECT extversion FROM pg_extension WHERE extname='timescaledb';" 2>/dev/null | tr -d '[:space:]')
    [ -n "$version" ] && break
    sleep 1
  done
  echo "TimescaleDB ${version:-<not installed>} is up at postgres://postgres@localhost:$PORT/$DATABASE"
  echo "Next: npm run seed"
}

down() {
  if exists; then
    echo "Stopping '$NAME'..."
    docker stop "$NAME" >/dev/null
    echo "Stopped. Data is preserved - use 'reset' to wipe it."
  else
    echo "No container named '$NAME'."
  fi
}

reset() {
  if exists; then
    echo "Removing '$NAME' and all its data..."
    docker rm -f "$NAME" >/dev/null
  fi
  up
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  reset) reset ;;
  psql) exec docker exec -it "$NAME" psql -U postgres -d "$DATABASE" ;;
  logs) exec docker logs -f "$NAME" ;;
  *)
    echo "Usage: $0 {up|down|reset|psql|logs}"
    exit 1
    ;;
esac
