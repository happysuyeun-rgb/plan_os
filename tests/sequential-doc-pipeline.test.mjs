/**
 * Guided sequential document generation + chat continue/pause.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { parseContinueIntent } from '../src/lib/generationContinueIntent.ts'

const read = (p) => readFileSync(p, 'utf8')

const PIPELINE_STEPS = [
  'prd',
  'ia',
  'screen_list',
  'policy',
  'wireframe',
  'cursor_prompt',
]

describe('sequential document pipeline', () => {
  it('exports generateOneDocument and auto-continue for screen_list', () => {
    const api = read('src/lib/api/generation.ts')
    assert.match(api, /export async function\* generateOneDocument/)
    assert.match(api, /export function isAutoContinueStep/)
    assert.match(api, /step === 'screen_list' \|\| step === 'cursor_prompt'/)
    assert.match(api, /yield\* generateOneDocument/)
    // Mirror remainingPipelineSteps contract without importing browser BFF deps.
    const remaining = (completed) => {
      const done = new Set(completed)
      return PIPELINE_STEPS.filter((s) => !done.has(s))
    }
    assert.deepEqual(remaining(['prd']), [
      'ia',
      'screen_list',
      'policy',
      'wireframe',
      'cursor_prompt',
    ])
    assert.equal(remaining(['prd', 'ia'])[0], 'screen_list')
  })

  it('generationStore awaits user between visible steps', () => {
    const store = read('src/store/generationStore.ts')
    assert.match(store, /awaitingUserContinue/)
    assert.match(store, /continuePipeline/)
    assert.match(store, /pausePipeline/)
    assert.match(store, /askContinue/)
    assert.match(store, /이어서 작성할까요/)
    assert.match(store, /isAutoContinueStep/)
  })

  it('parses continue/pause intents', () => {
    assert.equal(parseContinueIntent('진행해줘'), 'continue')
    assert.equal(parseContinueIntent('네'), 'continue')
    assert.equal(parseContinueIntent('다음'), 'continue')
    assert.equal(
      parseContinueIntent('기능정의서 작성해줘', { nextStepLabel: '기능정의서' }),
      'continue',
    )
    assert.equal(parseContinueIntent('작성해줘'), 'continue')
    assert.equal(parseContinueIntent('아직'), 'pause')
    assert.equal(parseContinueIntent('나중에'), 'pause')
    assert.equal(parseContinueIntent('아니요'), 'pause')
    assert.equal(parseContinueIntent('PRD 요약 부분을 수정해줘'), 'unknown')
  })

  it('ProjectCreate queues pipeline and DocumentPage starts PRD in-project', () => {
    const page = read('src/pages/ProjectCreatePage.tsx')
    const doc = read('src/pages/DocumentPage.tsx')
    const store = read('src/store/generationStore.ts')
    const handoff = read('src/lib/guidedPipelineHandoff.ts')
    assert.match(page, /queueGuidedPipeline/)
    assert.match(page, /guidedPipeline: pipelineInput/)
    assert.match(page, /navigate\(`\/projects\/\$\{projectId\}\/prd`/)
    assert.doesNotMatch(page, /startPipeline/)
    assert.doesNotMatch(page, /postCreateDestination\(projectId/)
    assert.match(doc, /consumePendingStart/)
    assert.match(doc, /startPipeline\(pending\)/)
    assert.match(doc, /guidedStartRef/)
    assert.match(doc, /in-project-pipeline-editor/)
    assert.match(store, /queueGuidedPipeline/)
    assert.match(store, /saveGuidedPipelineHandoff/)
    assert.match(store, /takeGuidedPipelineHandoff/)
    assert.match(handoff, /planos_guided_pipeline_v1/)
  })

  it('ChatPanel intercepts awaiting replies and shows continue CTA', () => {
    const panel = read('src/components/document/ChatPanel.tsx')
    assert.match(panel, /parseContinueIntent/)
    assert.match(panel, /continuePipeline/)
    assert.match(panel, /pausePipeline/)
    assert.match(panel, /pipeline-continue-cta/)
    assert.match(panel, /localMessagesByProject/)
  })

  it('GenerationStep exposes guest continue/pause CTAs', () => {
    const step = read('src/components/project/GenerationStep.tsx')
    assert.match(step, /awaitingContinue/)
    assert.match(step, /onContinue/)
    assert.match(step, /guest-pipeline-continue/)
  })
})
