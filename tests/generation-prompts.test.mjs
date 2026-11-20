import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(p, 'utf8')

describe('generation prompts', () => {
  it('registers specialized PRD and IA (기능정의서) prompt modules', () => {
    const registry = read('src/lib/generation/prompts/registry.ts')
    const labels = read('src/types/index.ts')
    const voice = read('src/lib/generation/prompts/shared/voice.ts')
    const prdSystem = read('src/lib/generation/prompts/prd/system.ts')
    const prdOutline = read('src/lib/generation/prompts/prd/outline.ts')
    const iaSystem = read('src/lib/generation/prompts/ia/system.ts')
    const iaOutline = read('src/lib/generation/prompts/ia/outline.ts')
    assert.match(registry, /prd:\s*\{/)
    assert.match(registry, /ia:\s*\{/)
    assert.match(labels, /ia: '기능정의서'/)
    assert.doesNotMatch(labels, /ia: '기능명세서'/)
    assert.match(voice, /전문 서비스 기획 AI/)
    assert.match(voice, /\[제안\]/)
    assert.match(voice, /\[결정 필요\]/)
    assert.match(prdSystem, /Product Manager/)
    assert.match(prdOutline, /REQ-001/)
    assert.match(prdOutline, /P0\/P1\/P2/)
    assert.match(iaSystem, /기능정의서/)
    assert.match(iaSystem, /Product Planner/)
    assert.match(iaOutline, /FUNC-001/)
    assert.match(iaOutline, /표 형식은 사용하지 않습니다/)
  })

  it('GeminiProvider uses assemblePrompt instead of inline buildPrompt', () => {
    const gemini = read('src/lib/ai/GeminiProvider.ts')
    assert.match(gemini, /assemblePrompt/)
    assert.doesNotMatch(gemini, /function buildPrompt/)
  })

  it('Vercel Preview BFF and Vite HTTP forward assemblePrompt + priorDocuments', () => {
    const api = read('api/ai/generate.ts')
    const http = read('src/server/ai/generationHttp.ts')
    assert.match(api, /assemblePrompt/)
    assert.doesNotMatch(api, /function buildPrompt/)
    assert.match(api, /priorDocuments/)
    assert.match(http, /priorDocuments/)
    assert.match(http, /approvedSourceDocuments/)
    assert.match(http, /approvedDecisions/)
  })

  it('assemblePrompt wires shared + type + project inputs', () => {
    const assemble = read('src/lib/generation/prompts/assemblePrompt.ts')
    assert.match(assemble, /SHARED_VOICE/)
    assert.match(assemble, /getPromptBundle/)
    assert.match(assemble, /approvedDecisions/)
    assert.match(assemble, /priorDocuments/)
    assert.match(assemble, /pm_plan_draft/)
  })
})
