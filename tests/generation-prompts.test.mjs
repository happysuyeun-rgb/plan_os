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
    assert.match(iaSystem, /시니어 서비스 기획자/)
    assert.match(iaSystem, /v2\.1/)
    assert.match(iaOutline, /F-001/)
    assert.match(iaOutline, /표 형식은 사용하지 않습니다/)
    assert.match(iaOutline, /주요 처리 규칙/)
  })

  it('GeminiProvider uses assemblePrompt instead of inline buildPrompt', () => {
    const gemini = read('src/lib/ai/GeminiProvider.ts')
    assert.match(gemini, /assemblePrompt/)
    assert.doesNotMatch(gemini, /function buildPrompt/)
  })

  it('Vercel Preview BFF uses self-contained type prompts (no src import)', () => {
    const api = read('api/ai/generate.ts')
    const assemble = read('api/ai/prompts/assembleDocumentPrompt.ts')
    const registry = read('api/ai/prompts/registry.ts')
    const http = read('src/server/ai/generationHttp.ts')
    assert.match(api, /assembleDocumentPrompt/)
    // Node ESM on Vercel (nodejs24) requires explicit .js extensions.
    assert.match(api, /from ['\"]\.\/prompts\/assembleDocumentPrompt\.js['\"]/)
    assert.match(assemble, /from ['\"]\.\/registry\.js['\"]/)
    assert.match(registry, /from ['\"]\.\/ia\/outline\.js['\"]/)
    assert.match(api, /gemini-3\.5-flash-lite/)
    assert.match(api, /GEMINI_ATTEMPT_TIMEOUT_MS/)
    assert.doesNotMatch(api, /from ['\"]\.\.\/\.\.\/src\//)
    assert.doesNotMatch(api, /function buildPrompt/)
    assert.match(api, /priorDocuments/)
    assert.match(api, /promptKind/)
    assert.match(assemble, /SHARED_VOICE/)
    assert.match(registry, /prd:\s*\{/)
    assert.match(registry, /ia:\s*\{/)
    assert.match(http, /priorDocuments/)
    assert.match(http, /approvedSourceDocuments/)
    assert.match(http, /approvedDecisions/)
  })

  it('api prompt pack stays aligned with src specialized prompts', () => {
    const srcVoice = read('src/lib/generation/prompts/shared/voice.ts')
    const apiVoice = read('api/ai/prompts/shared/voice.ts')
    const srcIa = read('src/lib/generation/prompts/ia/system.ts')
    const apiIa = read('api/ai/prompts/ia/system.ts')
    const srcPrd = read('src/lib/generation/prompts/prd/outline.ts')
    const apiPrd = read('api/ai/prompts/prd/outline.ts')
    assert.equal(apiVoice, srcVoice)
    assert.equal(apiIa, srcIa)
    assert.equal(apiPrd, srcPrd)
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
