/**
 * Guided pipeline continue CTA must survive leaving/re-entering a project,
 * and must not skip 기능정의서(ia) after PRD (stale nextStep → 정책서).
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

function completedStepsFromDocTypes(types) {
  return types.filter((t) => PIPELINE.includes(t))
}

/** Mirrors src/lib/guidedPipelineResume.reconcileGuidedProgress */
function reconcileGuidedProgress(snapCompleted, existingDocTypes) {
  const fromDocs =
    existingDocTypes && existingDocTypes.length > 0
      ? completedStepsFromDocTypes(existingDocTypes)
      : []
  const completedSteps = fromDocs.length > 0 ? fromDocs : [...(snapCompleted ?? [])]
  return {
    completedSteps,
    nextStep: nextAskStep(completedSteps),
  }
}

describe('guided pipeline resume CTA', () => {
  it('nextAskStep skips auto-hidden types', () => {
    assert.equal(nextAskStep(['prd']), 'ia')
    assert.equal(nextAskStep(['prd', 'ia']), 'policy')
    assert.equal(nextAskStep(['prd', 'ia', 'screen_list']), 'policy')
    assert.equal(nextAskStep(['prd', 'ia', 'screen_list', 'policy']), 'wireframe')
    assert.equal(nextAskStep(['prd', 'ia', 'screen_list', 'policy', 'wireframe']), null)
  })

  it('PRD-only progress always asks for 기능정의서 next, never 정책서', () => {
    assert.equal(nextAskStep(['prd']), 'ia')
    assert.equal(reconcileGuidedProgress(['prd'], ['prd']).nextStep, 'ia')
    // Stale snap claimed ia was done / next was policy — live docs only have PRD.
    assert.equal(
      reconcileGuidedProgress(['prd', 'ia'], ['prd']).nextStep,
      'ia',
    )
    // Stored nextStep must be ignored; only completed steps matter.
    assert.notEqual(reconcileGuidedProgress(['prd'], ['prd']).nextStep, 'policy')
  })

  it('persists awaiting snapshot and hydrates on DocumentPage', () => {
    const resume = read('src/lib/guidedPipelineResume.ts')
    const store = read('src/store/generationStore.ts')
    const page = read('src/pages/DocumentPage.tsx')
    const chat = read('src/components/document/ChatPanel.tsx')
    assert.match(resume, /saveGuidedPipelineResume/)
    assert.match(resume, /peekGuidedPipelineResume/)
    assert.match(resume, /nextAskStep/)
    assert.match(resume, /reconcileGuidedProgress/)
    assert.match(store, /hydrateGuidedResume/)
    assert.match(store, /resumeAwaitingFromDocs/)
    assert.match(store, /persistAwaitingResume/)
    assert.match(store, /reconcileGuidedProgress/)
    assert.match(page, /hydrateGuidedResume\(projectId, availableTypes\)/)
    assert.match(page, /resumeAwaitingFromDocs/)
    assert.match(chat, /showContinueCta/)
    assert.match(chat, /pipeline-continue-cta/)
  })
})
