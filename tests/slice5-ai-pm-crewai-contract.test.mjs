import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('Slice 5 AI PM CrewAI contract', () => {
  it('ships 037 local_only RPC for ai_pm_v1 only', () => {
    assert.equal(existsSync('supabase/local_only/037_ai_pm_contract.sql'), true)
    assert.equal(existsSync('supabase/drafts/037_ai_pm_contract_DRAFT.sql'), true)
    assert.equal(existsSync('supabase/migrations/037_ai_pm_contract.sql'), false)
    const sql = readFileSync('supabase/local_only/037_ai_pm_contract.sql', 'utf8')
    assert.match(sql, /create_ai_pm_contract_draft/)
    assert.match(sql, /ai_pm_v1/)
    assert.match(sql, /PLAN_NOT_APPROVED/)
    assert.match(sql, /planApprovedDoesNotEnqueue/)
    assert.match(sql, /paidLlmAllowed', false/)
  })

  it('exposes createAiPmContractDraft client wrapper', () => {
    const api = readFileSync('src/lib/api/agentContracts.ts', 'utf8')
    assert.match(api, /export async function createAiPmContractDraft/)
    assert.match(api, /p_pm_plan_id/)
  })

  it('keeps approve separate from CrewAI enqueue on plan detail', () => {
    const page = readFileSync('src/pages/PmPlanDetailPage.tsx', 'utf8')
    assert.match(page, /data-testid="pm-plan-crewai-followup"/)
    assert.match(page, /data-testid="pm-plan-crewai-specialist-link"/)
    assert.match(page, /AI 실행·결제는 시작되지 않았습니다/)
    assert.match(page, /specialists\/request\?fromPlan=/)
    assert.doesNotMatch(page, /transitionPmPlan\(plan, 'approve'[\s\S]*enqueueForCrewAiWorker/)
  })

  it('specialist request prefills from approved plan query', () => {
    const page = readFileSync('src/pages/SpecialistRequestMockPage.tsx', 'utf8')
    assert.match(page, /fromPlan/)
    assert.match(page, /fetchPmPlan/)
    assert.match(page, /승인된 PM 계획/)
  })

  it('worker already defines ai_pm_v1 role', () => {
    const roles = readFileSync('workers/crewai/src/planos_crewai/roles.py', 'utf8')
    assert.match(roles, /slug="ai_pm_v1"/)
  })
})
