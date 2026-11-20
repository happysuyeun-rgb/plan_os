import { create } from 'zustand'
import type { DocumentType } from '../types'
import { DOCUMENT_TYPE_LABELS } from '../types'
import type { GenerationInput, GenerationStep } from '../lib/api/generation'
import {
  generateOneDocument,
  isAutoContinueStep,
  isUiVisibleStep,
  PIPELINE_STEPS,
  remainingPipelineSteps,
} from '../lib/api/generation'
import { logProjectActivity } from '../lib/api/activities'
import { startGenerationRun, finishGenerationRun } from '../lib/api/generationRuns'
import { updateProject } from '../lib/api/projects'
import {
  clearGuidedPipelineHandoff,
  hasGuidedPipelineStarted,
  markGuidedPipelineStarted,
  saveGuidedPipelineHandoff,
  takeGuidedPipelineHandoff,
} from '../lib/guidedPipelineHandoff'
import {
  clearGuidedPipelineResume,
  nextAskStep,
  peekGuidedPipelineResume,
  reconcileGuidedProgress,
  saveGuidedPipelineResume,
} from '../lib/guidedPipelineResume'
import { useAuthStore } from './authStore'
import { useChatStore } from './chatStore'

export type PipelinePhase =
  | 'idle'
  | 'generating'
  | 'awaiting'
  | 'done'
  | 'cancelled'
  | 'paused'

export interface PipelineResult {
  cancelled: boolean
  completedCount: number
  /** True when stopped waiting for user to continue the next visible doc. */
  awaitingContinue?: boolean
  phase: PipelinePhase
}

interface GenerationState {
  currentStep: GenerationStep | null
  completedSteps: GenerationStep[]
  streamText: string
  generatedResults: Partial<Record<DocumentType, string>>
  isGenerating: boolean
  error: string | null
  phase: PipelinePhase
  awaitingUserContinue: boolean
  nextStep: GenerationStep | null
  remainingSteps: GenerationStep[]
  pipelineInput: GenerationInput | null
  /** Set by ProjectCreate; DocumentPage consumes and starts generation in-project. */
  pendingStart: GenerationInput | null
  runId: string | null

  queueGuidedPipeline: (input: GenerationInput) => void
  consumePendingStart: (projectId: string) => GenerationInput | null
  startPipeline: (input: GenerationInput) => Promise<PipelineResult>
  continuePipeline: () => Promise<PipelineResult>
  pausePipeline: () => void
  /** Re-show continue CTA after leaving/re-entering the project document. */
  hydrateGuidedResume: (
    projectId: string,
    existingDocTypes?: DocumentType[],
  ) => boolean
  /** Infer next step from saved docs when memory/session snapshot is missing. */
  resumeAwaitingFromDocs: (
    projectId: string,
    input: GenerationInput,
    existingDocTypes: DocumentType[],
  ) => boolean
  cancelGeneration: () => void
  reset: () => void
}

function persistAwaitingResume(get: () => GenerationState) {
  const s = get()
  const input = s.pipelineInput
  if (!input?.projectId) return
  if (!(s.awaitingUserContinue || s.phase === 'awaiting' || s.phase === 'paused')) return
  // Always derive next from completedSteps so a stale nextStep cannot skip ia.
  const next = nextAskStep(s.completedSteps) ?? s.nextStep
  if (!next) return
  saveGuidedPipelineResume({
    projectId: input.projectId,
    pipelineInput: input,
    completedSteps: s.completedSteps,
    nextStep: next,
    phase: s.phase === 'paused' ? 'paused' : 'awaiting',
    awaitingUserContinue: true,
    savedAt: new Date().toISOString(),
  })
}

function shouldReAskContinue(projectId: string, next: GenerationStep): boolean {
  const locals = useChatStore.getState().localMessagesByProject[projectId] ?? []
  const last = locals[locals.length - 1]
  if (!last || last.role !== 'assistant') return true
  const label = DOCUMENT_TYPE_LABELS[next]
  return !(
    last.content.includes('이어서 작성할까요') ||
    last.content.includes(label)
  )
}

let abortFlag = false
let runLock = false

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function narrate(projectId: string, content: string) {
  if (projectId === 'guest-preview') return
  useChatStore.getState().appendLocalAssistantMessage(projectId, content)
}

function askContinue(projectId: string, next: GenerationStep) {
  const label = DOCUMENT_TYPE_LABELS[next]
  narrate(
    projectId,
    `${label}을(를) 이어서 작성할까요?\n채팅에 「진행해줘」 또는 「아직」이라고 답해 주세요.`,
  )
}

async function persistRunFinish(
  projectId: string,
  runId: string | null,
  isGuest: boolean,
  status: 'cancelled' | 'completed',
  completedSteps: GenerationStep[],
) {
  if (isGuest || !runId) return
  await finishGenerationRun(runId, status, completedSteps)
  await logProjectActivity({
    project_id: projectId,
    action: status === 'cancelled' ? 'pipeline_cancel' : 'pipeline_complete',
    meta: { steps: completedSteps.length },
  })
}

async function runOneStep(
  input: GenerationInput,
  step: GenerationStep,
  set: (partial: Partial<GenerationState> | ((s: GenerationState) => Partial<GenerationState>)) => void,
): Promise<boolean> {
  const label = DOCUMENT_TYPE_LABELS[step]
  if (isUiVisibleStep(step)) {
    narrate(input.projectId, `${label} 작성을 시작합니다.`)
  }

  set({
    phase: 'generating',
    isGenerating: true,
    awaitingUserContinue: false,
    currentStep: step,
    streamText: '',
    nextStep: null,
  })

  const priorDocuments = {
    ...(input.priorDocuments ?? {}),
    ...useGenerationStore.getState().generatedResults,
  }
  const stepInput: GenerationInput = { ...input, priorDocuments }

  for await (const progress of generateOneDocument(stepInput, step)) {
    if (abortFlag) return false
    if (progress.done) {
      set((s) => ({
        completedSteps: [...s.completedSteps, progress.step],
        generatedResults: {
          ...s.generatedResults,
          // Prefer accumulated stream; strip wait placeholder if still present.
          [progress.step]: s.streamText.replace(/^내용을 생성하고 있습니다…\n\n/, ''),
        },
        streamText: '',
      }))
      if (isUiVisibleStep(step)) {
        narrate(input.projectId, `${label} 작성을 마쳤습니다.`)
      }
    } else if (progress.chunk === '\u0000') {
      // Clear the waiting placeholder before real content arrives.
      set({ currentStep: progress.step, streamText: '' })
    } else {
      set((s) => ({
        currentStep: progress.step,
        streamText:
          s.currentStep === progress.step
            ? s.streamText + progress.chunk
            : progress.chunk,
      }))
    }
  }

  return !abortFlag
}

/**
 * After completing `justFinished`, either auto-run hidden steps, ask user, or finish.
 */
async function afterStepComplete(
  set: (partial: Partial<GenerationState> | ((s: GenerationState) => Partial<GenerationState>)) => void,
  get: () => GenerationState,
): Promise<PipelineResult> {
  const input = get().pipelineInput
  if (!input) {
    return { cancelled: false, completedCount: get().completedSteps.length, phase: 'idle' }
  }

  // Auto-continue hidden steps without asking.
  while (!abortFlag) {
    const remaining = remainingPipelineSteps(get().completedSteps)
    set({ remainingSteps: remaining })
    if (remaining.length === 0) break

    const next = remaining[0]
    if (isAutoContinueStep(next)) {
      const ok = await runOneStep(input, next, set)
      if (!ok) break
      continue
    }

    // Visible step → ask user
    set({
      phase: 'awaiting',
      isGenerating: false,
      awaitingUserContinue: true,
      nextStep: next,
      currentStep: null,
      streamText: '',
    })
    persistAwaitingResume(get)
    askContinue(input.projectId, next)
    return {
      cancelled: false,
      completedCount: get().completedSteps.length,
      awaitingContinue: true,
      phase: 'awaiting',
    }
  }

  if (abortFlag) {
    clearGuidedPipelineResume(input.projectId)
    set({
      phase: 'cancelled',
      isGenerating: false,
      awaitingUserContinue: false,
      nextStep: null,
    })
    await persistRunFinish(
      input.projectId,
      get().runId,
      input.projectId === 'guest-preview',
      'cancelled',
      get().completedSteps,
    )
    return {
      cancelled: true,
      completedCount: get().completedSteps.length,
      phase: 'cancelled',
    }
  }

  // All done
  const completed = get().completedSteps
  if (completed.length > 0) {
    useAuthStore.getState().incrementAiGeneration()
  }
  if (input.projectId !== 'guest-preview') {
    await updateProject(input.projectId, {
      memory_summary: `${input.title} | ${input.service_type} | ${input.description.slice(0, 50)}`,
    })
    narrate(
      input.projectId,
      '예정된 산출물 생성을 모두 마쳤습니다. 왼쪽 탭에서 문서를 확인하세요.',
    )
    const entry = input.interviewAnswers?._planning_entry_path
    if (entry === 'with_pm') {
      narrate(
        input.projectId,
        '기본 PM 경로를 선택하셨습니다. 준비가 되면 /plans 에서 PM 계획을 이어갈 수 있습니다.',
      )
    }
  }
  await persistRunFinish(
    input.projectId,
    get().runId,
    input.projectId === 'guest-preview',
    'completed',
    completed,
  )
  clearGuidedPipelineResume(input.projectId)
  set({
    phase: 'done',
    isGenerating: false,
    awaitingUserContinue: false,
    nextStep: null,
    remainingSteps: [],
  })
  return { cancelled: false, completedCount: completed.length, phase: 'done' }
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  currentStep: null,
  completedSteps: [],
  streamText: '',
  generatedResults: {},
  isGenerating: false,
  error: null,
  phase: 'idle',
  awaitingUserContinue: false,
  nextStep: null,
  remainingSteps: [],
  pipelineInput: null,
  pendingStart: null,
  runId: null,

  queueGuidedPipeline: (input) => {
    saveGuidedPipelineHandoff(input)
    set({
      pendingStart: input,
      pipelineInput: input,
      phase: 'idle',
      isGenerating: false,
      awaitingUserContinue: false,
      error: null,
      currentStep: null,
      completedSteps: [],
      streamText: '',
      generatedResults: {},
      nextStep: null,
      remainingSteps: [...PIPELINE_STEPS],
      runId: null,
    })
  },

  consumePendingStart: (projectId) => {
    const fromStore = get().pendingStart
    const pending =
      fromStore?.projectId === projectId
        ? fromStore
        : takeGuidedPipelineHandoff(projectId)
    if (!pending || pending.projectId !== projectId) return null
    set({ pendingStart: null })
    clearGuidedPipelineHandoff()
    return pending
  },

  startPipeline: async (input) => {
    const existing = get()
    // Remount / duplicate nav state must not restart and wipe chat narration.
    if (
      existing.pipelineInput?.projectId === input.projectId &&
      (existing.isGenerating ||
        existing.awaitingUserContinue ||
        existing.phase === 'generating' ||
        existing.phase === 'awaiting' ||
        existing.phase === 'paused' ||
        existing.completedSteps.length > 0)
    ) {
      return {
        cancelled: false,
        completedCount: existing.completedSteps.length,
        awaitingContinue: existing.awaitingUserContinue,
        phase: existing.phase,
      }
    }
    if (runLock) {
      return {
        cancelled: false,
        completedCount: get().completedSteps.length,
        phase: get().phase,
      }
    }
    runLock = true
    abortFlag = false
    markGuidedPipelineStarted(input.projectId)
    set({
      isGenerating: true,
      error: null,
      currentStep: null,
      completedSteps: [],
      streamText: '',
      generatedResults: {},
      phase: 'generating',
      awaitingUserContinue: false,
      nextStep: null,
      remainingSteps: [...PIPELINE_STEPS],
      pipelineInput: input,
      pendingStart: null,
      runId: null,
    })

    const isGuest = input.projectId === 'guest-preview'

    try {
      if (!isGuest) {
        // Never clearLocalMessages here — remounts were wiping progress chat.
        const existingLocal =
          useChatStore.getState().localMessagesByProject[input.projectId] ?? []
        if (existingLocal.length === 0) {
          narrate(
            input.projectId,
            '프로젝트 산출물을 한 종류씩 작성합니다. 각 문서가 끝나면 다음 진행 여부를 물어봅니다.',
          )
        }
        try {
          const run = await startGenerationRun(
            input.projectId,
            input.interviewAnswers ?? {},
          )
          set({ runId: run.id })
        } catch {
          // Run-row is optional for local/preview; do not block PRD generation.
          set({ runId: null })
        }
        try {
          await updateProject(input.projectId, {
            interview_answers: input.interviewAnswers ?? {},
          })
        } catch {
          // Interview answers can sync later; keep generating.
        }
      }

      const first = PIPELINE_STEPS[0]
      const ok = await runOneStep(input, first, set)
      if (!ok || abortFlag) {
        set({
          phase: 'cancelled',
          isGenerating: false,
          awaitingUserContinue: false,
        })
        await persistRunFinish(
          input.projectId,
          get().runId,
          isGuest,
          'cancelled',
          get().completedSteps,
        )
        return {
          cancelled: true,
          completedCount: get().completedSteps.length,
          phase: 'cancelled',
        }
      }

      return await afterStepComplete(set, get)
    } catch {
      set({
        error: '생성에 실패했습니다. 다시 시도해주세요',
        isGenerating: false,
        phase: 'idle',
      })
      return {
        cancelled: abortFlag,
        completedCount: get().completedSteps.length,
        phase: 'idle',
      }
    } finally {
      runLock = false
    }
  },

  continuePipeline: async () => {
    // Capture once — separate get().nextStep calls are not narrowed by TS.
    const {
      pipelineInput: input,
      awaitingUserContinue,
      nextStep: step,
      completedSteps,
      phase,
    } = get()
    const canResume =
      Boolean(input && step) &&
      (awaitingUserContinue || phase === 'awaiting' || phase === 'paused')
    if (!canResume || !input || !step) {
      if (input) {
        narrate(
          input.projectId,
          '지금은 이어서 작성할 단계가 없습니다. PRD 생성이 끝난 뒤 「진행해줘」를 눌러 주세요.',
        )
      }
      return {
        cancelled: false,
        completedCount: completedSteps.length,
        phase,
      }
    }

    // Wait out a brief lock (startPipeline finally / auto screen_list).
    // Do NOT auto-chain continue — that re-created the old “generate everything” feel.
    for (let i = 0; i < 40 && runLock; i++) {
      await delay(50)
    }
    if (runLock) {
      narrate(
        input.projectId,
        '이전 작업이 아직 마무리 중입니다. 잠시 후 「진행해줘」를 다시 눌러 주세요.',
      )
      return {
        cancelled: false,
        completedCount: get().completedSteps.length,
        awaitingContinue: true,
        phase: 'awaiting',
      }
    }

    // Re-read after wait — state may have advanced (e.g. auto screen_list).
    const latest = get()
    const resumeStep = latest.nextStep
    const resumeInput = latest.pipelineInput
    if (
      !resumeInput ||
      !resumeStep ||
      !(latest.awaitingUserContinue || latest.phase === 'awaiting' || latest.phase === 'paused')
    ) {
      return {
        cancelled: false,
        completedCount: latest.completedSteps.length,
        phase: latest.phase,
      }
    }

    runLock = true
    abortFlag = false
    try {
      const ok = await runOneStep(resumeInput, resumeStep, set)
      if (!ok || abortFlag) {
        set({
          phase: 'cancelled',
          isGenerating: false,
          awaitingUserContinue: false,
        })
        await persistRunFinish(
          resumeInput.projectId,
          get().runId,
          resumeInput.projectId === 'guest-preview',
          'cancelled',
          get().completedSteps,
        )
        return {
          cancelled: true,
          completedCount: get().completedSteps.length,
          phase: 'cancelled',
        }
      }
      return await afterStepComplete(set, get)
    } catch {
      set({
        error: '생성에 실패했습니다. 다시 시도해주세요',
        isGenerating: false,
        phase: 'awaiting',
        awaitingUserContinue: true,
      })
      return {
        cancelled: false,
        completedCount: get().completedSteps.length,
        awaitingContinue: true,
        phase: 'awaiting',
      }
    } finally {
      runLock = false
    }
  },

  pausePipeline: () => {
    const input = get().pipelineInput
    if (input) {
      narrate(
        input.projectId,
        '알겠습니다. 지금은 여기서 멈춥니다. 나중에 채팅에 「진행해줘」라고 하시면 이어서 작성합니다.',
      )
    }
    set({
      phase: 'paused',
      isGenerating: false,
      // Keep awaiting semantics so "진행해줘" still works via continuePipeline
      awaitingUserContinue: Boolean(get().nextStep),
    })
    persistAwaitingResume(get)
  },

  hydrateGuidedResume: (projectId, existingDocTypes) => {
    const existing = get()
    // Never let doc-inference overwrite an in-flight generation.
    if (existing.pipelineInput?.projectId === projectId && existing.isGenerating) {
      return true
    }
    if (
      existing.pipelineInput?.projectId === projectId &&
      existing.awaitingUserContinue
    ) {
      // Correct a stale nextStep (e.g. session said policy while only PRD exists).
      const { completedSteps, nextStep } = reconcileGuidedProgress(
        existing.completedSteps,
        existingDocTypes,
      )
      const next = nextStep ?? nextAskStep(existing.completedSteps)
      if (next && next !== existing.nextStep) {
        set({
          completedSteps:
            existingDocTypes && existingDocTypes.length > 0
              ? completedSteps
              : existing.completedSteps,
          nextStep: next,
          remainingSteps: remainingPipelineSteps(
            existingDocTypes && existingDocTypes.length > 0
              ? completedSteps
              : existing.completedSteps,
          ),
        })
      }
      persistAwaitingResume(get)
      return true
    }

    const snap = peekGuidedPipelineResume(projectId)
    if (!snap) return false
    const { completedSteps, nextStep } = reconcileGuidedProgress(
      snap.completedSteps,
      existingDocTypes,
    )
    const next = nextStep
    if (!next) {
      clearGuidedPipelineResume(projectId)
      return false
    }

    set({
      pipelineInput: snap.pipelineInput,
      completedSteps,
      nextStep: next,
      phase: snap.phase,
      awaitingUserContinue: true,
      isGenerating: false,
      remainingSteps: remainingPipelineSteps(completedSteps),
      currentStep: null,
      streamText: '',
      error: null,
    })
    persistAwaitingResume(get)
    if (shouldReAskContinue(projectId, next)) {
      askContinue(projectId, next)
    }
    return true
  },

  resumeAwaitingFromDocs: (projectId, input, existingDocTypes) => {
    const existing = get()
    if (existing.pipelineInput?.projectId === projectId && existing.isGenerating) {
      return true
    }
    if (
      existing.pipelineInput?.projectId === projectId &&
      existing.awaitingUserContinue
    ) {
      const { completedSteps, nextStep } = reconcileGuidedProgress(
        existing.completedSteps,
        existingDocTypes,
      )
      const next = nextStep ?? nextAskStep(existing.completedSteps)
      if (next && next !== existing.nextStep) {
        set({
          completedSteps:
            existingDocTypes.length > 0 ? completedSteps : existing.completedSteps,
          nextStep: next,
          remainingSteps: remainingPipelineSteps(
            existingDocTypes.length > 0 ? completedSteps : existing.completedSteps,
          ),
        })
        persistAwaitingResume(get)
      }
      return true
    }
    if (!hasGuidedPipelineStarted(projectId) && !peekGuidedPipelineResume(projectId)) {
      return false
    }

    const { completedSteps, nextStep } = reconcileGuidedProgress(
      existing.pipelineInput?.projectId === projectId ? existing.completedSteps : undefined,
      existingDocTypes,
    )
    const next = nextStep
    if (!next) {
      clearGuidedPipelineResume(projectId)
      return false
    }

    const pipelineInput = { ...input, projectId }
    set({
      pipelineInput,
      completedSteps,
      nextStep: next,
      phase: 'awaiting',
      awaitingUserContinue: true,
      isGenerating: false,
      remainingSteps: remainingPipelineSteps(completedSteps),
      currentStep: null,
      streamText: '',
      error: null,
      generatedResults: existing.generatedResults,
    })
    persistAwaitingResume(get)
    if (shouldReAskContinue(projectId, next)) {
      askContinue(projectId, next)
    }
    return true
  },

  cancelGeneration: () => {
    abortFlag = true
    const projectId = get().pipelineInput?.projectId
    if (projectId) clearGuidedPipelineResume(projectId)
    set({
      isGenerating: false,
      phase: get().completedSteps.length > 0 ? 'cancelled' : 'idle',
      awaitingUserContinue: false,
    })
  },

  reset: () => {
    abortFlag = false
    runLock = false
    const projectId = get().pipelineInput?.projectId
    if (projectId) clearGuidedPipelineResume(projectId)
    set({
      currentStep: null,
      completedSteps: [],
      streamText: '',
      generatedResults: {},
      isGenerating: false,
      error: null,
      phase: 'idle',
      awaitingUserContinue: false,
      nextStep: null,
      remainingSteps: [],
      pipelineInput: null,
      pendingStart: null,
      runId: null,
    })
  },
}))
