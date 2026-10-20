import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const sql = readFileSync(new URL('../supabase/migrations/011_project_tasks.sql', import.meta.url), 'utf8')
test('SQL dollar-quoted functions are balanced', () => {
  const delimiters = sql.match(/\$\$/g) ?? []
  assert.equal(delimiters.length % 2, 0, 'unbalanced PostgreSQL $$ quote delimiter')
  assert.ok(delimiters.length >= 6, 'expected at least three quoted functions')
  assert.doesNotMatch(sql, /\bas \$\s*\n/, 'invalid single-dollar quoting')
})
test('tasks and audit events enforce RLS', () => {
  assert.match(sql, /alter table public\.project_tasks enable row level security;/)
  assert.match(sql, /alter table public\.project_task_events enable row level security;/)
  assert.match(sql, /revoke insert, update, delete on public\.project_task_events from anon, authenticated;/)
})
test('task changes require version, owner-gated soft delete and immutable tenant', () => {
  assert.match(sql, /new\.version <> old\.version \+ 1/)
  assert.match(sql, /ONLY_OWNER_MAY_RESTORE_TASK/)
  assert.match(sql, /ONLY_OWNER_MAY_DELETE_TASK/)
  assert.match(sql, /new\.project_id is distinct from old\.project_id/)
})

test('S2 manifests use immutable owner-only RPC and idempotency guard', () => {
  const migration = readFileSync(new URL('../supabase/migrations/012_audit_source_manifests.sql', import.meta.url), 'utf8')
  assert.match(migration, /enable row level security/)
  assert.match(migration, /request_key uuid not null/)
  assert.match(migration, /unique index audit_manifest_request_unique/)
  assert.match(migration, /REQUEST_KEY_CONFLICT/)
  assert.match(migration, /public\.get_project_role\(p_project_id\)/)
  assert.match(migration, /is_audit_source_manifest_current/)
  assert.doesNotMatch(migration, /as \$\s*\n/)
  assert.equal((migration.match(/\$\$/g) ?? []).length % 2, 0)
})
