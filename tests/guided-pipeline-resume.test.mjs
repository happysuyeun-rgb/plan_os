/**
 * Guided pipeline continue CTA must survive leaving/re-entering a project.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const read = (p) => readFileSync(p, 'utf8')

const PIPELINE = ['prd', 'ia', 'screen_list', 'policy', 'wireframe', 'cursor_prompt']
const AUTO = new Set(['screen_list', 'cursor_prompt'])

function nextAskStep(completed) {
  const done = new Set(completed)
  for (const step of PIPELINE.filter((s) => !done.has(s))) {
    if (!AUTO.has(step)) return step
  }
  return null
}

describe('guided pipeline resume CTA', () => {
  it('nextAskStep skips auto-hidden types', () => {
    assert.equal(nextAskStep(['prd']), 'ia')
    assert.equal(nextAskStep(['prd', 'ia']), 'policy')
    assert.equal(nextAskStep(['prd', 'ia', 'screen_list']), 'policy')
    assert.equal(nextAskStep(['prd', 'ia', 'screen_list', 'policy']), 'wireframe')
    assert.equal(nextAskStep(['prd', 'ia', 'screen_list', 'policy', 'wireframe']), null)
  })

  it('persists awaiting snapshot and hydrates on DocumentPage', () => {
    const resume = read('src/lib/guidedPipelineResume.ts')
    const store = read('src/store/generationStore.ts')
    const page = read('src/pages/DocumentPage.tsx')
    const chat = read('src/components/document/ChatPanel.tsx')
    assert.match(resume, /saveGuidedPipelineResume/)
    assert.match(resume, /peekGuidedPipelineResume/)
    assert.match(resume, /nextAskStep/)
    assert.match(store, /hydrateGuidedResume/)
    assert.match(store, /resumeAwaitingFromDocs/)
    assert.match(store, /persistAwaitingResume/)
    assert.match(page, /hydrateGuidedResume/)
    assert.match(page, /resumeAwaitingFromDocs/)
    assert.match(chat, /showContinueCta/)
    assert.match(chat, /pipeline-continue-cta/)
  })
})
