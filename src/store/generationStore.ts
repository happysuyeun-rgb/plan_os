import { create } from 'zustand'
import type { DocumentType } from '../types'
import type { GenerationStep } from '../lib/api/generation'
import { runGenerationPipeline } from '../lib/api/generation'
import { logProjectActivity } from '../lib/api/activities'
import { startGenerationRun, finishGenerationRun } from '../lib/api/generationRuns'
import { updateProject } from '../lib/api/projects'
import { useAuthStore } from './authStore'

export interface PipelineResult {
  cancelled: boolean
  completedCount: number
}

interface GenerationState {
  currentStep: GenerationStep | null
  completedSteps: GenerationStep[]
  streamText: string
  generatedResults: Partial<Record<DocumentType, string>>
  isGenerating: boolean
  error: string | null

  startPipeline: (input: Parameters<typeof runGenerationPipeline>[0]) => Promise<PipelineResult>
  cancelGeneration: () => void
  reset: () => void
}

let abortFlag = false

export const useGenerationStore = create<GenerationState>((set, get) => ({
  currentStep: null,
  completedSteps: [],
  streamText: '',
  generatedResults: {},
  isGenerating: false,
  error: null,

  startPipeline: async (input) => {
    abortFlag = false
    set({
      isGenerating: true,
      error: null,
      currentStep: null,
      completedSteps: [],
      streamText: '',
      generatedResults: {},
    })

    let runId: string | null = null
    const isGuest = input.projectId === 'guest-preview'

    try {
      if (!isGuest) {
        const run = await startGenerationRun(
          input.projectId,
          input.interviewAnswers ?? {},
        )
        runId = run.id
        await updateProject(input.projectId, {
          interview_answers: input.interviewAnswers ?? {},
        })
      }

      for await (const progress of runGenerationPipeline(input)) {
        if (abortFlag) break

        if (progress.done) {
          set((s) => ({
            completedSteps: [...s.completedSteps, progress.step],
            generatedResults: {
              ...s.generatedResults,
              [progress.step]: s.streamText,
            },
            streamText: '',
          }))
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

      const { completedSteps } = get()
      if (completedSteps.length > 0 && !abortFlag) {
        useAuthStore.getState().incrementAiGeneration()
      }

      if (!isGuest && runId) {
        await finishGenerationRun(
          runId,
          abortFlag ? 'cancelled' : 'completed',
          completedSteps,
        )
        await logProjectActivity({
          project_id: input.projectId,
          action: abortFlag ? 'pipeline_cancel' : 'pipeline_complete',
          meta: { steps: completedSteps.length },
        })
      }

      return { cancelled: abortFlag, completedCount: completedSteps.length }
    } catch {
      set({ error: '생성에 실패했습니다. 다시 시도해주세요' })
      return { cancelled: abortFlag, completedCount: get().completedSteps.length }
    } finally {
      set({ isGenerating: false })
    }
  },

  cancelGeneration: () => {
    abortFlag = true
    set({ isGenerating: false })
  },

  reset: () => {
    abortFlag = false
    set({
      currentStep: null,
      completedSteps: [],
      streamText: '',
      generatedResults: {},
      isGenerating: false,
      error: null,
    })
  },
}))
