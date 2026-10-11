import type { DocumentType } from '../../types'
import { DOCUMENT_TYPE_ORDER } from '../documentTypes'
import { buildGeneratedContent } from '../generation/placeholderContent'
import { fetchDocument, upsertDocument } from './documents'
import { updateProject } from './projects'

export type GenerationStep = DocumentType

const PIPELINE_STEPS: GenerationStep[] = [...DOCUMENT_TYPE_ORDER]

export interface GenerationInput {
  projectId: string
  title: string
  description: string
  service_type: string
  targetUser: string
  interviewAnswers?: Record<string, string>
}

export interface GenerationProgress {
  step: GenerationStep
  chunk: string
  done: boolean
}

const STREAM_DELAY_MS = 8

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function* runGenerationPipeline(
  input: GenerationInput,
): AsyncGenerator<GenerationProgress> {
  for (const step of PIPELINE_STEPS) {
    const content = buildGeneratedContent(step, {
      title: input.title,
      targetUser: input.targetUser,
    })

    let accumulated = ''
    for (const char of content.split('')) {
      await delay(STREAM_DELAY_MS)
      accumulated += char
      yield { step, chunk: char, done: false }
    }

    if (input.projectId !== 'guest-preview') {
      await upsertDocument({
        project_id: input.projectId,
        type: step,
        content: accumulated,
      })
    }

    yield { step, chunk: '', done: true }
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

export async function regenerateDocument(
  projectId: string,
  type: DocumentType,
  title: string,
  targetUser: string,
): Promise<string> {
  const content = buildGeneratedContent(type, { title, targetUser })
  const existing = await fetchDocument(projectId, type)
  await upsertDocument({
    id: existing?.id,
    project_id: projectId,
    type,
    content,
  })
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
