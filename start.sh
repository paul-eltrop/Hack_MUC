#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/.run"
VENV_DIR="$ROOT_DIR/.venv"
AGENT_QDRANT_PATH="${AGENT_QDRANT_PATH:-$ROOT_DIR/.run/qdrant_agent_storage}"
PORTAL_QDRANT_PATH="${PORTAL_QDRANT_PATH:-$ROOT_DIR/.run/qdrant_portal_storage}"

mkdir -p "$RUN_DIR"
mkdir -p "$AGENT_QDRANT_PATH"
mkdir -p "$PORTAL_QDRANT_PATH"

log() {
  printf '[start] %s\n' "$*"
}

warn() {
  printf '[warn] %s\n' "$*" >&2
}

die() {
  printf '[error] %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Command missing: $1"
}

ensure_node_version() {
  require_cmd node
  local version major
  version="$(node -v 2>/dev/null || true)"
  major="${version#v}"
  major="${major%%.*}"

  if [[ -z "$major" ]]; then
    die "Unable to detect Node.js version"
  fi

  # Next.js 15 is reliably supported on active LTS lines.
  if (( major < 18 || major > 22 )); then
    die "Unsupported Node.js version: $version. Please use Node 20 or 22 (LTS)."
  fi
}

is_running() {
  local pid_file="$1"
  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi

  local pid
  pid="$(cat "$pid_file")"
  [[ -n "$pid" ]] || return 1

  if kill -0 "$pid" >/dev/null 2>&1; then
    return 0
  fi

  rm -f "$pid_file"
  return 1
}

start_bg() {
  local name="$1"
  local cmd="$2"
  local pid_file="$RUN_DIR/$name.pid"
  local log_file="$RUN_DIR/$name.log"

  if is_running "$pid_file"; then
    log "$name running already (PID $(cat "$pid_file"))"
    return
  fi

  log "Starting $name ..."
  nohup bash -lc "$cmd" >"$log_file" 2>&1 &
  echo "$!" > "$pid_file"
  sleep 1

  if ! is_running "$pid_file"; then
    warn "$name could not be started. Last log lines:"
    tail -n 30 "$log_file" || true
    die "Failed to start "
  fi

  log "$name running (PID $(cat "$pid_file"))"
}

stop_one() {
  local name="$1"
  local pid_file="$RUN_DIR/$name.pid"

  if ! is_running "$pid_file"; then
    log "$name is not running"
    return
  fi

  local pid
  pid="$(cat "$pid_file")"
  log "Stopping $name (PID $pid) ..."
  kill "$pid" >/dev/null 2>&1 || true

  for _ in {1..10}; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if kill -0 "$pid" >/dev/null 2>&1; then
    warn "$name did not respond, sending SIGKILL"
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi

  rm -f "$pid_file"
  log "$name stopped"
}

show_status() {
  for svc in portal agent_cron frontend; do
    local pid_file="$RUN_DIR/$svc.pid"
    if is_running "$pid_file"; then
      printf '%-12s RUNNING (PID %s)\n' "$svc" "$(cat "$pid_file")"
    else
      printf '%-12s STOPPED\n' "$svc"
    fi
  done
}

load_env() {
  local env_file="$ROOT_DIR/.env"
  [[ -f "$env_file" ]] || die ".env not found in $ROOT_DIR"

  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a

  [[ -n "${MANEX_API_URL:-}" ]] || die "MANEX_API_URL is missing in .env"
  [[ -n "${MANEX_API_KEY:-}" ]] || die "MANEX_API_KEY is missing in .env"
  [[ -n "${MANEX_DB_URL:-}" ]] || die "MANEX_DB_URL is missing in .env"
}

check_health() {
  if [[ "${SKIP_HEALTHCHECK:-0}" == "1" ]]; then
    warn "Health check skipped (SKIP_HEALTHCHECK=1)"
    return 0
  fi
  log "Checking Manex API ..."
  curl -sf -o /dev/null \
    -H "Authorization: Bearer $MANEX_API_KEY" \
    "$MANEX_API_URL/defect?limit=1" || die "Manex API unreachable: $MANEX_API_URL"
  log "Manex API erreichbar"
}

ensure_frontend_env() {
  local fe_env="$ROOT_DIR/frontend/.env.local"
  if [[ ! -f "$fe_env" ]]; then
    log "Create frontend/.env.local"
    cat > "$fe_env" <<'EOT'
NEXT_PUBLIC_PORTAL_URL=http://localhost:8000
EOT
  fi
}

ensure_python_env() {
  require_cmd python3

  if [[ ! -d "$VENV_DIR" ]]; then
    log "Creating Python venv (.venv)"
    python3 -m venv "$VENV_DIR"
  fi

  # shellcheck disable=SC1091
  source "$VENV_DIR/bin/activate"

  if ! python -c "import fastapi, uvicorn, openai, qdrant_client, dotenv, anthropic, psycopg2" >/dev/null 2>&1; then
    log "Installing Python dependencies"
    pip install --upgrade pip >/dev/null
    pip install -r "$ROOT_DIR/portal/requirements.txt" -r "$ROOT_DIR/agent_service/requirements.txt" >/dev/null
  fi
}

ensure_frontend_deps() {
  ensure_node_version
  require_cmd npm
  if [[ ! -x "$ROOT_DIR/frontend/node_modules/.bin/next" ]]; then
    log "Installing/repairing frontend dependencies (npm ci)"
    if ! (cd "$ROOT_DIR/frontend" && npm ci); then
      warn "npm ci failed; retrying after clean node_modules"
      (cd "$ROOT_DIR/frontend" && rm -rf node_modules && npm ci)
    fi
  fi
}

run_initial_agent_async() {
  log "Starting initialen Agent-Snapshot im Hintergrund"
  (
    cd "$ROOT_DIR"
    # shellcheck disable=SC1091
    source "$VENV_DIR/bin/activate"
    export QDRANT_PATH="$AGENT_QDRANT_PATH"
    python -m agent_service.loop
  ) >"$RUN_DIR/agent_init.log" 2>&1 &
}

start_all() {
  require_cmd curl
  require_cmd nohup

  load_env
  ensure_node_version
  check_health
  ensure_python_env
  ensure_frontend_env
  ensure_frontend_deps

  start_bg "portal" "cd '$ROOT_DIR' && source '$VENV_DIR/bin/activate' && export QDRANT_PATH='$PORTAL_QDRANT_PATH' && uvicorn portal.main:app --host 0.0.0.0 --port 8000"
  start_bg "agent_cron" "cd '$ROOT_DIR' && source '$VENV_DIR/bin/activate' && export QDRANT_PATH='$AGENT_QDRANT_PATH' && python -m agent_service.cron"
  start_bg "frontend" "cd '$ROOT_DIR/frontend' && rm -rf .next && NODE_OPTIONS=--no-experimental-webstorage ./node_modules/.bin/next dev --port 3000"
  run_initial_agent_async

  log ""
  log "Done. URLs:"
  log "  Frontend: http://localhost:3000"
  log "  Portal API: http://localhost:8000/docs"
  log ""
  log "Logs:"
  log "  $RUN_DIR/frontend.log"
  log "  $RUN_DIR/portal.log"
  log "  $RUN_DIR/agent_cron.log"
  log "  $RUN_DIR/agent_init.log"
}

case "${1:-start}" in
  start)
    start_all
    ;;
  stop)
    stop_one frontend
    stop_one agent_cron
    stop_one portal
    ;;
  restart)
    "$0" stop
    "$0" start
    ;;
  status)
    show_status
    ;;
  logs)
    exec tail -f "$RUN_DIR"/*.log
    ;;
  *)
    cat <<USAGE
Usage: $0 [start|stop|restart|status|logs]
USAGE
    exit 1
    ;;
esac
