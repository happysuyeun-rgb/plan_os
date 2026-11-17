/**
 * Slice 2: freeze 027 as apply-ready draft — never assert hosted apply.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, it } from 'node:test'

const EXEC = 'supabase/local_only/027_ai_review_jobs.sql'
const DRAFT = 'supabase/drafts/027_ai_review_jobs_DRAFT.sql'
const EXPECTED_SHA256 =
  'a426460752c875f57e90d4d2736b668c54f5fafd7e18387960ceb81a1f6e0457'

describe('Slice 2 DDL 027 draft freeze', () => {
  it('keeps executable SQL in local_only and pointer in drafts', () => {
    assert.equal(existsSync(EXEC), true)
    assert.equal(existsSync(DRAFT), true)
    assert.equal(existsSync('supabase/migrations/027_ai_review_jobs.sql'), false)
  })

  it('pins SHA256 of executable SQL in draft pointer', () => {
    const sql = readFileSync(EXEC)
    const sha = createHash('sha256').update(sql).digest('hex')
    assert.equal(sha, EXPECTED_SHA256)
    const pointer = readFileSync(DRAFT, 'utf8')
    assert.match(pointer, new RegExp(EXPECTED_SHA256))
    assert.match(pointer, /FORBIDDEN without explicit user approval/)
    assert.match(pointer, /local_only\/027_ai_review_jobs\.sql/)
  })

  it('executable SQL retains CAS bind RLS contracts', () => {
    const sql = readFileSync(EXEC, 'utf8')
    assert.match(sql, /create table if not exists public\.ai_review_jobs/)
    assert.match(sql, /cas_ai_review_job/)
    assert.match(sql, /AI_REVIEW_VERSION_CONFLICT/)
    assert.match(sql, /P4001/)
    assert.match(sql, /bind_ai_review_finding_task/)
    assert.match(sql, /can_access_project/)
    assert.match(sql, /can_edit_project_content/)
    assert.match(sql, /source_manifest/)
    assert.match(sql, /insufficient_input/)
    assert.doesNotMatch(sql, /planos\.supabase\.co|amazonaws/i)
  })

  it('migrations skip 027 number (026 then 028+)', () => {
    const files = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'))
    assert.equal(files.some((f) => f.startsWith('027_')), false)
    assert.equal(files.some((f) => f.startsWith('026_')), true)
    assert.equal(files.some((f) => f.startsWith('028_')), true)
  })

  it('loopback apply script refuses hosted env', () => {
    const script = readFileSync('scripts/apply-027-local-only.mjs', 'utf8')
    assert.match(script, /SUPABASE_ACCESS_TOKEN/)
    assert.match(script, /Refusing non-loopback/)
    assert.match(script, /local_only/)
  })
})
