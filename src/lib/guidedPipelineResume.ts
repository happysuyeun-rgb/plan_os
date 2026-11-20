import type { DocumentType } from '../types'
import type { GenerationInput, GenerationStep } from './api/generation'
import {
  isAutoContinueStep,
  remainingPipelineSteps,
} from './api/generation'

const RESUME_KEY = 'planos_guided_resume_v1'

export type GuidedResumePhase = 'awaiting' | 'paused'

export type GuidedPipelineResumeSnapshot = {
  projectId: string
  pipelineInput: GenerationInput
  completedSteps: GenerationStep[]
  nextStep: GenerationStep | null
  phase: GuidedResumePhase
  awaitingUserContinue: boolean
  savedAt: string
}

function readAll(): Record<string, GuidedPipelineResumeSnapshot> {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, GuidedPipelineResumeSnapshot>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(map: Record<string, GuidedPipelineResumeSnapshot>) {
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify(map))
  } catch {
    // ignore quota / private mode
  }
}

/** First remaining step that needs a user continue confirmation (skips auto-hidden types). */
export function nextAskStep(completed: GenerationStep[]): GenerationStep | null {
  for (const step of remainingPipelineSteps(completed)) {
    if (!isAutoContinueStep(step)) return step
  }
  return null
}

export function saveGuidedPipelineResume(snapshot: GuidedPipelineResumeSnapshot): void {
  const map = readAll()
  map[snapshot.projectId] = snapshot
  writeAll(map)
}

export function peekGuidedPipelineResume(
  projectId: string,
): GuidedPipelineResumeSnapshot | null {
  const snap = readAll()[projectId]
  if (!snap || snap.projectId !== projectId) return null
  return snap
}

export function takeGuidedPipelineResume(
  projectId: string,
): GuidedPipelineResumeSnapshot | null {
  const map = readAll()
  const snap = map[projectId]
  if (!snap || snap.projectId !== projectId) return null
  // Keep snapshot while awaiting so remounts can re-hydrate; cleared on done/cancel.
  return snap
}

export function clearGuidedPipelineResume(projectId: string): void {
  const map = readAll()
  if (!map[projectId]) return
  delete map[projectId]
  writeAll(map)
}

/** Treat existing project documents as completed pipeline steps for resume inference. */
export function completedStepsFromDocTypes(types: DocumentType[]): GenerationStep[] {
  return types.filter((t): t is GenerationStep =>
    (
      [
        'prd',
        'ia',
        'screen_list',
        'policy',
        'wireframe',
        'cursor_prompt',
      ] as DocumentType[]
    ).includes(t),
  )
}
