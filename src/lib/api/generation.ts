import type { DocumentType } from '../../types'
import { generateDocumentViaBff } from '../ai/generationBffClient'
import { DOCUMENT_TYPE_ORDER, DOCUMENT_TYPE_UI_ORDER } from '../documentTypes'
import { buildGeneratedContent } from '../generation/placeholderContent'
import { fetchDocument, insertDocument, saveDocumentContentCas } from './documents'
import { updateProject } from './projects'

export type GenerationStep = DocumentType

export const PIPELINE_STEPS: GenerationStep[] = [...DOCUMENT_TYPE_ORDER]

export interface GenerationInput {
  projectId: string
  title: string
  description: string
  service_type: string
  targetUser: string
  interviewAnswers?: Record<string, string>
  /** Earlier pipeline drafts for prompt context (e.g. PRD → 기능정의서). */
  priorDocuments?: Partial<Record<DocumentType, string>>
}

export interface GenerationProgress {
  step: GenerationStep
  chunk: string
  done: boolean
}

const STREAM_CHUNK_SIZE = 24
const STREAM_DELAY_MS = 4

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Hidden from UI tabs — auto-continue without asking the user. */
export function isAutoContinueStep(step: GenerationStep): boolean {
  return step === 'screen_list' || step === 'cursor_prompt'
}

export function isUiVisibleStep(step: GenerationStep): boolean {
  return (DOCUMENT_TYPE_UI_ORDER as DocumentType[]).includes(step)
}

export function remainingPipelineSteps(
  completed: GenerationStep[],
): GenerationStep[] {
  const done = new Set(completed)
  return PIPELINE_STEPS.filter((s) => !done.has(s))
}

/**
 * Generate + stream + persist a single document type.
 * Used by guided sequential pipeline and by the full runGenerationPipeline.
 */
export async function* generateOneDocument(
  input: GenerationInput,
  step: GenerationStep,
): AsyncGenerator<GenerationProgress> {
  // Heartbeat so the project UI is not blank while the BFF/Gemini call runs.
  yield { step, chunk: '내용을 생성하고 있습니다…\n\n', done: false }

  const vars = {
    title: input.title,
    targetUser: input.targetUser,
    description: input.description,
    serviceType: input.service_type,
    interviewAnswers: input.interviewAnswers,
    priorDocuments: input.priorDocuments,
    approvedSourceDocuments: input.priorDocuments,
  }
  let content: string
  let usedFallback = false
  try {
    const result = await generateDocumentViaBff(step, vars)
    content = result.content
  } catch {
    usedFallback = true
    // Local fallback if BFF/Gemini is unavailable or timed out.
    content = buildGeneratedContent(step, {
      title: input.title,
      targetUser: input.targetUser,
    })
  }

  // Replace the waiting placeholder with real content chunks.
  yield { step, chunk: '\u0000', done: false }
  if (usedFallback) {
    yield {
      step,
      chunk: '(모델 응답이 지연되어 로컬 초안으로 작성합니다.)\n\n',
      done: false,
    }
  }

  let accumulated = ''
  for (let i = 0; i < content.length; i += STREAM_CHUNK_SIZE) {
    const chunk = content.slice(i, i + STREAM_CHUNK_SIZE)
    await delay(STREAM_DELAY_MS)
    accumulated += chunk
    yield { step, chunk, done: false }
  }

  if (input.projectId !== 'guest-preview') {
    await writeGeneratedDocument(input.projectId, step, accumulated)
  }

  yield { step, chunk: '', done: true }
}

/** Legacy full-run helper (tests / callers that still want all steps). */
export async function* runGenerationPipeline(
  input: GenerationInput,
): AsyncGenerator<GenerationProgress> {
  for (const step of PIPELINE_STEPS) {
    yield* generateOneDocument(input, step)
  }

  if (input.projectId !== 'guest-preview') {
    await updateProject(input.projectId, {
      memory_summary: `${input.title} | ${input.service_type} | ${input.description.slice(0, 50)}`,
    })
  }
}

export const CASCADE_STEPS: Record<DocumentType, DocumentType[]> = {
  prd: ['prd', 'ia', 'screen_list', 'policy', 'wireframe', 'cursor_prompt'],
  ia: ['ia', 'screen_list', 'policy', 'wireframe', 'cursor_prompt'],
  screen_list: ['screen_list', 'policy', 'wireframe', 'cursor_prompt'],
  policy: ['policy', 'wireframe', 'cursor_prompt'],
  wireframe: ['wireframe', 'cursor_prompt'],
  cursor_prompt: ['cursor_prompt'],
}

/**
 * Generated content lands through Revision CAS whenever the document
 * already exists, so generation/regeneration can never silently overwrite
 * a concurrent edit with an unconditional UPDATE. First creation stays
 * INSERT-only: when two requests race to create the same document, the
 * loser gets DocumentAlreadyExistsError, the winner's document is never
 * overwritten, and the caller retries explicitly — the next attempt sees
 * the existing document and goes through CAS. Callers run this inside the
 * per-document replace lane, which serializes it against local autosaves.
 */
export async function writeGeneratedDocument(
  projectId: string,
  type: DocumentType,
  content: string,
): Promise<void> {
  const existing = await fetchDocument(projectId, type)
  if (existing) {
    await saveDocumentContentCas(existing.id, existing.content_revision, content)
  } else {
    await insertDocument({ project_id: projectId, type, content })
  }
}

export async function regenerateDocument(
  projectId: string,
  type: DocumentType,
  title: string,
  targetUser: string,
): Promise<string> {
  let content: string
  try {
    content = (await generateDocumentViaBff(type, { title, targetUser })).content
  } catch {
    content = buildGeneratedContent(type, { title, targetUser })
  }
  await writeGeneratedDocument(projectId, type, content)
  return content
}

export async function regenerateCascade(
  projectId: string,
  fromType: DocumentType,
  title: string,
  targetUser: string,
): Promise<Partial<Record<DocumentType, string>>> {
  const steps = CASCADE_STEPS[fromType]
  const results: Partial<Record<DocumentType, string>> = {}

  for (const step of steps) {
    results[step] = await regenerateDocument(projectId, step, title, targetUser)
  }

  await updateProject(projectId, {
    memory_summary: `${title} | 연쇄 재생성 (${fromType})`,
  })

  return results
}
