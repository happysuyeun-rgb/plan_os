/**
 * PR-C: Preview/product default = CrewAI queue; Mock = E2E only.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const read = (p) => readFileSync(p, 'utf8')

describe('PR-C CrewAI default path', () => {
  it('centralizes mock vs crewai flags in aiExecutionPath', () => {
    const mod = read('src/lib/aiExecutionPath.ts')
    assert.match(mod, /export function isMockAiRunAllowed/)
    assert.match(mod, /export function defaultAiExecutionPath/)
    assert.match(mod, /return 'crewai'/)
    assert.match(mod, /VITE_ALLOW_MOCK_AI_RUN/)
    assert.match(mod, /VITE_S3_E2E_FIXTURE/)
    assert.match(mod, /never the Preview default/i)
  })

  it('specialist request defaults CrewAI CTA before gated Mock CTA', () => {
    const page = read('src/pages/SpecialistRequestMockPage.tsx')
    assert.match(page, /from '\.\.\/lib\/aiExecutionPath'/)
    assert.match(page, /isMockAiRunAllowed/)
    assert.match(page, /crewai-worker-enqueue/)
    assert.match(page, /CrewAI 실실행 큐에 넣기 \(기본\)/)
    assert.match(page, /mockAiRunAllowed && \(/)
    assert.match(page, /Mock worker \(E2E 전용/)
    assert.match(page, /crewai-default-path-note/)
    const crewIdx = page.indexOf('crewai-worker-enqueue')
    const mockIdx = page.indexOf('mock-worker-run')
    assert.ok(crewIdx > 0 && mockIdx > crewIdx, 'CrewAI CTA must appear before Mock CTA in source')
  })

  it('catalog capability no longer claims AI execution unavailable', () => {
    const card = read('src/lib/mockSpecialistRequest.ts')
    assert.match(card, /CrewAI 실실행 큐/)
    assert.doesNotMatch(card, /현재 AI 실행 불가/)
  })

  it('enqueueForCrewAiWorker never calls process_mock', () => {
    const api = read('src/lib/api/aiRuns.ts')
    const start = api.indexOf('export async function enqueueForCrewAiWorker')
    assert.ok(start > 0)
    const preamble = api.slice(Math.max(0, start - 220), start + 200)
    assert.match(preamble, /Never calls process_mock_ai_run/)
    assert.match(preamble, /enqueueForCrewAiWorker/)
    assert.doesNotMatch(api.slice(start, start + 200), /processMockAiRun\(/)
  })
})

