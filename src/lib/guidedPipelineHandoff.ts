import type { GenerationInput } from './api/generation'

const STORAGE_KEY = 'planos_guided_pipeline_v1'
const STARTED_KEY = 'planos_guided_started_v1'

/** Survive navigate / StrictMode remount so PRD always starts inside DocumentPage. */
export function saveGuidedPipelineHandoff(input: GenerationInput): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(input))
    // Allow a fresh start for this project when queueing from create flow.
    const started = readStartedSet()
    started.delete(input.projectId)
    sessionStorage.setItem(STARTED_KEY, JSON.stringify([...started]))
  } catch {
    // ignore quota / private mode
  }
}

export function takeGuidedPipelineHandoff(projectId: string): GenerationInput | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GenerationInput
    if (!parsed?.projectId || parsed.projectId !== projectId) return null
    sessionStorage.removeItem(STORAGE_KEY)
    return parsed
  } catch {
    sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function clearGuidedPipelineHandoff(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

function readStartedSet(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STARTED_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

/** True if guided startPipeline already began for this project in this tab. */
export function hasGuidedPipelineStarted(projectId: string): boolean {
  return readStartedSet().has(projectId)
}

export function markGuidedPipelineStarted(projectId: string): void {
  try {
    const started = readStartedSet()
    started.add(projectId)
    sessionStorage.setItem(STARTED_KEY, JSON.stringify([...started]))
  } catch {
    // ignore
  }
}
