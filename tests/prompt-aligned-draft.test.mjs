import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const draftSrc = readFileSync(
  new URL('../src/lib/generation/promptAlignedDraft.ts', import.meta.url),
  'utf8',
)
const generation = readFileSync(new URL('../src/lib/api/generation.ts', import.meta.url), 'utf8')
const gemini = readFileSync(new URL('../src/lib/ai/GeminiProvider.ts', import.meta.url), 'utf8')

test('prompt-aligned draft covers specialized PRD/IA shapes and interview', () => {
  assert.match(draftSrc, /# \$\{vars\.title\} PRD/)
  assert.match(draftSrc, /## 1\. 제품 개요/)
  assert.match(draftSrc, /## 7\. 핵심 기능 목록/)
  assert.match(draftSrc, /전체 기능정의서/)
  assert.match(draftSrc, /INTERVIEW_LABELS/)
  assert.match(draftSrc, /isThinGeneratedContent/)
})

test('pipeline prefers Gemini and upgrades thin placeholder to aligned draft', () => {
  assert.match(generation, /buildPromptAlignedDraft/)
  assert.match(generation, /isThinGeneratedContent/)
  assert.doesNotMatch(generation, /buildGeneratedContent/)
})

test('local GeminiProvider cascades models like Preview BFF', () => {
  assert.match(gemini, /FALLBACK_MODELS/)
  assert.match(gemini, /gemini-3\.5-flash-lite/)
  assert.match(gemini, /ATTEMPT_TIMEOUT_MS/)
})
