#!/usr/bin/env bash
# C-02 disposable PostgreSQL Revision CAS verification (no Supabase, no
# hosted DB). Creates a throwaway postgres:17 container, applies bootstrap
# + migrations 001..016 + 018 (017 DRAFT is intentionally excluded), seeds
# synthetic users/projects, runs the CAS role/conflict matrix, then races
# two real concurrent CAS sessions against one revision.
# Usage: bash tests/rls/run_c02_local_pg.sh
set -euo pipefail

NAME=planos-g1-c02-pg
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" \
  -e POSTGRES_PASSWORD=c02test -e POSTGRES_DB=planos_c02 \
  -p 55433:5432 postgres:17-alpine >/dev/null

for i in $(seq 1 30); do
  if docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done

docker cp "$ROOT/tests/rls/bootstrap_postgres.sql" "$NAME:/tmp/bootstrap.sql"
docker cp "$ROOT/supabase/migrations" "$NAME:/tmp/migrations"
docker cp "$ROOT/tests/rls/seed_members.sql" "$NAME:/tmp/seed_members.sql"
docker cp "$ROOT/tests/rls/test_c02_revision_cas.sql" "$NAME:/tmp/test_c02.sql"
docker cp "$ROOT/tests/rls/test_c02_concurrent.sql" "$NAME:/tmp/test_concurrent.sql"

psql_in() { docker exec "$NAME" psql -U postgres -d planos_c02 -v ON_ERROR_STOP=1 "$@"; }

psql_in -q -f /tmp/bootstrap.sql
for f in \
  001_initial_schema.sql 002_fix_project_members_rls.sql \
  003_generation_runs_rls.sql 004_add_wireframe_document_type.sql \
  005_project_comments.sql 006_member_project_access_rls.sql \
  007_user_notifications.sql 008_project_chat_title.sql \
  011_project_tasks.sql 012_audit_source_manifests.sql \
  013_fix_project_members_select_recursion.sql \
  014_harden_comments_notifications_versions.sql \
  015_atomic_document_version_restore.sql \
  016_atomic_chat_document_edit.sql \
  018_document_revision_cas.sql \
  019_harden_can_edit_null_check.sql; do
  echo "apply $f"
  psql_in -q -f "/tmp/migrations/$f"
done
# 017_document_revision_cas_DRAFT.sql is NOT applied by design.

psql_in -q -f /tmp/seed_members.sql
psql_in -f /tmp/test_c02.sql

echo 'C02-12 two concurrent CAS saves on one revision: exactly one commits'
DOC_ID=$(docker exec "$NAME" psql -U postgres -d planos_c02 -At -c \
  "insert into public.documents(project_id,type,content) values ('11111111-1111-1111-1111-111111111111','screen_list','concurrency base') returning id")
echo "concurrency document: $DOC_ID"

run_race() {
  docker exec "$NAME" psql -U postgres -d planos_c02 -v ON_ERROR_STOP=1 \
    -v doc_id="$DOC_ID" -v expected_rev=0 -v body="$1" \
    -v claim_sub='00000000-0000-0000-0000-000000000002' \
    -q -f /tmp/test_concurrent.sql >/dev/null 2>&1
}

run_race 'race-writer-A' & PA=$!
run_race 'race-writer-B' & PB=$!
A_OK=0; B_OK=0
wait $PA && A_OK=1 || true
wait $PB && B_OK=1 || true
TOTAL_OK=$((A_OK + B_OK))
if [ "$TOTAL_OK" -ne 1 ]; then
  echo "FAIL: expected exactly one concurrent CAS winner, got $TOTAL_OK"
  exit 1
fi
FINAL=$(docker exec "$NAME" psql -U postgres -d planos_c02 -At -c \
  "select content || ' @ rev ' || content_revision from public.documents where id='$DOC_ID'")
case "$FINAL" in
  "race-writer-A @ rev 1"|"race-writer-B @ rev 1") echo "winner state: $FINAL" ;;
  *) echo "FAIL: unexpected final state: $FINAL"; exit 1 ;;
esac

echo "C-02 local PG verification finished. Remove with: docker rm -f $NAME"
