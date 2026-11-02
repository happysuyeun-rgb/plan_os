#!/usr/bin/env bash
# Shared disposable local stack for specialist F-A/F-B/F-C CI E2E.
# Usage: bash scripts/ci-disposable-specialist-e2e.sh <fa|fb|fc>
set -euo pipefail

MODE="${1:?mode required: fa|fb|fc}"
case "$MODE" in
  fa)
    : "${PLANOS_LOCAL_SUPABASE_DIR:=/tmp/planos-fa-contract-supabase}"
    START_LOG=/tmp/planos-fa-start.log
    VITE_LOG=/tmp/planos-vite-fa.log
    VITE_PID=/tmp/planos-vite-fa.pid
    RLS_SCRIPT=tests/rls/test_local_supabase_agent_contracts.mjs
    BROWSER_SCRIPT=tests/e2e/browser_agent_contract.mjs
    ;;
  fb)
    : "${PLANOS_LOCAL_SUPABASE_DIR:=/tmp/planos-fb-runs-supabase}"
    START_LOG=/tmp/planos-fb-start.log
    VITE_LOG=/tmp/planos-vite-fb.log
    VITE_PID=/tmp/planos-vite-fb.pid
    RLS_SCRIPT=tests/rls/test_local_supabase_ai_runs.mjs
    BROWSER_SCRIPT=tests/e2e/browser_ai_run_mock.mjs
    ;;
  fc)
    : "${PLANOS_LOCAL_SUPABASE_DIR:=/tmp/planos-fc-artifacts-supabase}"
    START_LOG=/tmp/planos-fc-start.log
    VITE_LOG=/tmp/planos-vite-fc.log
    VITE_PID=/tmp/planos-vite-fc.pid
    RLS_SCRIPT=tests/rls/test_local_supabase_ai_artifacts.mjs
    BROWSER_SCRIPT=tests/e2e/browser_ai_artifact_accept.mjs
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    exit 1
    ;;
esac

cleanup() {
  if [ -f "$VITE_PID" ]; then kill "$(cat "$VITE_PID")" || true; fi
  rm -f .env.local
  if [ -d "$PLANOS_LOCAL_SUPABASE_DIR/supabase" ]; then
    ( cd "$PLANOS_LOCAL_SUPABASE_DIR" && supabase stop --no-backup ) || true
  fi
}
trap cleanup EXIT

if ! command -v psql >/dev/null; then
  sudo apt-get update -qq
  sudo apt-get install -qq -y postgresql-client
fi

for variable in SUPABASE_ACCESS_TOKEN SUPABASE_DB_URL SUPABASE_DB_PASSWORD; do
  if [ -n "$(printenv "$variable" || true)" ]; then
    echo "::error::Unexpected hosted Supabase configuration"
    exit 1
  fi
done

mkdir -p "$PLANOS_LOCAL_SUPABASE_DIR"
(
  cd "$PLANOS_LOCAL_SUPABASE_DIR"
  supabase init
  if ! supabase start --exclude realtime,storage-api,imgproxy,studio,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit > "$START_LOG" 2>&1; then
    grep -Ei 'error|failed' "$START_LOG" | head -40 || true
    exit 1
  fi
)

export PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres PGSSLMODE=disable
for migration in supabase/migrations/*.sql; do
  psql -X -v ON_ERROR_STOP=1 -f "$migration"
done

npm ci --ignore-scripts
node "$RLS_SCRIPT"
node tests/e2e/local_browser_env.mjs
npm install --ignore-scripts --no-save --package-lock=false playwright@1.58.2
node node_modules/playwright/cli.js install --with-deps chromium

(npm run dev -- --host 127.0.0.1 > "$VITE_LOG" 2>&1 & echo $! > "$VITE_PID")
ready=0
for attempt in $(seq 1 50); do
  if curl -fsS -o /dev/null http://127.0.0.1:5173/login; then ready=1; break; fi
  sleep 1
done
if [ "$ready" != 1 ]; then
  tail -n 80 "$VITE_LOG" || true
  exit 1
fi

node "$BROWSER_SCRIPT"
