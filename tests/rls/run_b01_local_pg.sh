#!/usr/bin/env bash
# B-01 disposable PostgreSQL RLS verification (no Supabase, no hosted DB).
# Requires Docker. Creates a throwaway postgres:17 container, applies
# bootstrap + migrations 001..016 (017 DRAFT is intentionally excluded),
# seeds synthetic users/projects, and runs the role/JWT test matrices.
# Usage: bash tests/rls/run_b01_local_pg.sh
set -euo pipefail

NAME=planos-g1-b01-pg
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" \
  -e POSTGRES_PASSWORD=b01test -e POSTGRES_DB=planos_b01 \
  -p 55432:5432 postgres:17-alpine >/dev/null

for i in $(seq 1 30); do
  if docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done

docker cp "$ROOT/tests/rls/bootstrap_postgres.sql" "$NAME:/tmp/bootstrap.sql"
docker cp "$ROOT/supabase/migrations" "$NAME:/tmp/migrations"
docker cp "$ROOT/tests/rls/seed_members.sql" "$NAME:/tmp/seed_members.sql"
docker cp "$ROOT/tests/rls/test_member_select_009.sql" "$NAME:/tmp/test_members.sql"
docker cp "$ROOT/tests/rls/test_b01_role_matrix.sql" "$NAME:/tmp/test_b01.sql"

psql_in() { docker exec "$NAME" psql -U postgres -d planos_b01 -v ON_ERROR_STOP=1 "$@"; }

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
  016_atomic_chat_document_edit.sql; do
  echo "apply $f"
  psql_in -q -f "/tmp/migrations/$f"
done
# 017_document_revision_cas_DRAFT.sql is NOT applied by design.

psql_in -q -f /tmp/seed_members.sql
psql_in -f /tmp/test_members.sql
psql_in -f /tmp/test_b01.sql

echo "B-01 local PG verification finished. Remove with: docker rm -f $NAME"
