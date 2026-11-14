/**
 * Contract checks for CrewAI real-worker scaffolding (no live LLM / no Docker).
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { describe, it } from 'node:test'

const read = (p) => readFileSync(p, 'utf8')

describe('CrewAI real worker contract', () => {
  it('keeps mock process path and adds enqueueForCrewAiWorker', () => {
    const api = read('src/lib/api/aiRuns.ts')
    assert.match(api, /export async function processMockAiRun/)
    assert.match(api, /export async function enqueueForCrewAiWorker/)
    assert.match(api, /Never calls process_mock_ai_run/)
  })

  it('exposes CrewAI enqueue CTA without removing mock button', () => {
    const page = read('src/pages/SpecialistRequestMockPage.tsx')
    assert.match(page, /data-testid="mock-worker-run"/)
    assert.match(page, /data-testid="crewai-worker-enqueue"/)
    assert.match(page, /enqueueForCrewAiWorker/)
    assert.match(page, /data-testid="execution-refresh"/)
    assert.match(page, /data-testid="artifact-publish-from-run"/)
  })

  it('ships local_only 034 claim/complete RPCs (not migrations/)', () => {
    assert.equal(existsSync('supabase/local_only/034_crewai_worker_rpcs.sql'), true)
    assert.equal(existsSync('supabase/migrations/034_crewai_worker_rpcs.sql'), false)
    const sql = read('supabase/local_only/034_crewai_worker_rpcs.sql')
    assert.match(sql, /claim_crewai_ai_run/)
    assert.match(sql, /complete_crewai_ai_run/)
    assert.match(sql, /service_role/)
    assert.doesNotMatch(sql, /create or replace function public\.process_mock_ai_run/)
  })

  it('defines MetaGPT-mapped roles including requirements_auditor_v1', () => {
    const roles = read('workers/crewai/src/planos_crewai/roles.py')
    for (const slug of [
      'ai_pm_v1',
      'service_planner_v1',
      'requirements_auditor_v1',
      'ux_ui_auditor_v1',
      'developer_v1',
      'qa_engineer_v1',
    ]) {
      assert.match(roles, new RegExp(slug))
    }
    assert.match(roles, /metagpt\/roles\/product_manager\.py/)
  })

  it('documents Liner LINER_API_KEY server secret', () => {
    const llm = read('workers/crewai/src/planos_crewai/llm.py')
    assert.match(llm, /LINER_API_KEY/)
    assert.match(llm, /platform\.liner\.com\/api\/v1/)
    const gw = read('src/server/ai/linerGateway.ts')
    assert.match(gw, /LINER_API_KEY/)
    assert.doesNotMatch(gw, /VITE_LINER/)
  })
})
