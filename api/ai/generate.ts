/**
 * Vercel Preview serverless route: POST /api/ai/generate
 * Self-contained under api/ (no src/ imports) — type-specific prompts live in ./prompts.
 * Never enables paid LLM calls.
 */
import { assembleDocumentPrompt } from './prompts/assembleDocumentPrompt.js'
import type { ApiDocumentType, ApiGenerationVars } from './prompts/types.js'

type Req = {
  method?: string
  body?: unknown
}

type Res = {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: string): void
}

/** Prefer env; then cascade when a model is overloaded / unavailable. */
const DEFAULT_MODEL = 'gemini-3.1-flash-lite'
const FALLBACK_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
]
/** Keep each attempt under the browser BFF timeout budget. */
const GEMINI_ATTEMPT_TIMEOUT_MS = 12_000

const DOC_TYPES = new Set<ApiDocumentType>([
  'prd',
  'ia',
  'screen_list',
  'policy',
  'wireframe',
  'cursor_prompt',
])

function placeholderContent(documentType: string, vars: ApiGenerationVars): string {
  const title = vars.title ?? '프로젝트'
  const target = vars.targetUser ?? '사용자'
  return [
    `# ${documentType.toUpperCase()} (템플릿)`,
    '',
    `## 개요`,
    `${title} 문서 초안입니다.`,
    '',
    `## 목표 사용자`,
    target,
    '',
    `## 설명`,
    vars.description ?? '',
  ].join('\n')
}

function asDocumentType(value: string): ApiDocumentType | null {
  return DOC_TYPES.has(value as ApiDocumentType) ? (value as ApiDocumentType) : null
}

function parseVars(raw: unknown): ApiGenerationVars | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, unknown>
  if (typeof v.title !== 'string' || typeof v.targetUser !== 'string') return null
  return {
    title: v.title,
    targetUser: v.targetUser,
    description: typeof v.description === 'string' ? v.description : undefined,
    serviceType: typeof v.serviceType === 'string' ? v.serviceType : undefined,
    interviewAnswers:
      v.interviewAnswers && typeof v.interviewAnswers === 'object'
        ? (v.interviewAnswers as Record<string, string>)
        : undefined,
    approvedDecisions:
      typeof v.approvedDecisions === 'string' ? v.approvedDecisions : undefined,
    approvedSourceDocuments:
      v.approvedSourceDocuments && typeof v.approvedSourceDocuments === 'object'
        ? (v.approvedSourceDocuments as ApiGenerationVars['approvedSourceDocuments'])
        : undefined,
    priorDocuments:
      v.priorDocuments && typeof v.priorDocuments === 'object'
        ? (v.priorDocuments as ApiGenerationVars['priorDocuments'])
        : undefined,
  }
}

function modelCandidates(): string[] {
  const preferred = (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL
  return [preferred, ...FALLBACK_MODELS.filter((m) => m !== preferred)]
}

function isRetryableGeminiError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('high demand') ||
    m.includes('resource_exhausted') ||
    m.includes('quota') ||
    m.includes('unavailable') ||
    m.includes('timed out') ||
    m.includes('timeout') ||
    m.includes('503') ||
    m.includes('429') ||
    m.includes('not found') ||
    m.includes('is not found')
  )
}

async function generateWithGeminiModel(
  model: string,
  documentType: ApiDocumentType,
  vars: ApiGenerationVars,
  apiKey: string,
): Promise<{ content: string; promptKind: string; model: string }> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`
  const { prompt, promptKind } = assembleDocumentPrompt(documentType, vars)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEMINI_ATTEMPT_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.55, maxOutputTokens: 8192 },
      }),
    })
    const raw = (await res.json()) as {
      error?: { message?: string }
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    if (!res.ok) {
      throw new Error(raw.error?.message ?? `Gemini HTTP ${res.status}`)
    }
    const text = raw.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    if (!text.trim()) throw new Error('Gemini returned empty content')
    return { content: text.trim(), promptKind, model }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Gemini timed out after ${GEMINI_ATTEMPT_TIMEOUT_MS}ms (${model})`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function generateWithGemini(
  documentType: ApiDocumentType,
  vars: ApiGenerationVars,
): Promise<{ content: string; promptKind: string; model: string }> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY missing')
  }

  const errors: string[] = []
  for (const model of modelCandidates()) {
    try {
      return await generateWithGeminiModel(model, documentType, vars, apiKey)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'generation failed'
      errors.push(`${model}: ${message}`)
      if (!isRetryableGeminiError(message)) {
        throw new Error(message)
      }
    }
  }
  throw new Error(errors.join(' | ') || 'All Gemini models failed')
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Allow', 'POST')
    res.end('Method Not Allowed')
    return
  }

  const raw = req.body
  const body =
    typeof raw === 'string'
      ? (JSON.parse(raw || '{}') as Record<string, unknown>)
      : ((raw ?? {}) as Record<string, unknown>)

  const documentTypeRaw = typeof body.documentType === 'string' ? body.documentType : ''
  const documentType = asDocumentType(documentTypeRaw)
  const vars = parseVars(body.vars)
  // Gate C closed: Preview API never honors client paid flags.
  const unpaidGuard = { allowPaidCalls: false }
  if (body.allowPaidCalls === true && unpaidGuard.allowPaidCalls === false) {
    // Ignore paid request — Gemini credit path is still non-Gate-C template/BFF only.
  }

  if (!documentType || !vars) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('X-PlanOS-AI-Runtime', 'vercel-preview')
    res.end(
      JSON.stringify({
        error: 'documentType and vars.title/targetUser required',
        mode: 'placeholder',
      }),
    )
    return
  }

  let mode: 'gemini' | 'placeholder' = 'placeholder'
  let providerId = 'placeholder'
  let promptKind = assembleDocumentPrompt(documentType, vars).promptKind
  let content = placeholderContent(documentType, vars)
  let fallbackReason: string | undefined
  let modelUsed: string | undefined

  try {
    if ((process.env.GEMINI_API_KEY || '').trim()) {
      const result = await generateWithGemini(documentType, vars)
      content = result.content
      promptKind = result.promptKind
      mode = 'gemini'
      providerId = 'gemini'
      modelUsed = result.model
    } else {
      fallbackReason = 'GEMINI_API_KEY missing'
    }
  } catch (err) {
    mode = 'placeholder'
    providerId = 'placeholder'
    content = placeholderContent(documentType, vars)
    fallbackReason = err instanceof Error ? err.message : 'generation failed'
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('X-PlanOS-AI-Runtime', 'vercel-preview')
  res.setHeader('X-PlanOS-Prompt-Kind', promptKind)
  if (modelUsed) res.setHeader('X-PlanOS-Gemini-Model', modelUsed)
  res.end(
    JSON.stringify({
      mode,
      providerId,
      promptKind,
      content,
      runtime: 'vercel-preview',
      ...(modelUsed ? { model: modelUsed } : {}),
      ...(fallbackReason ? { fallbackReason } : {}),
      attemptId: typeof body.attemptId === 'string' ? body.attemptId : crypto.randomUUID(),
    }),
  )
}
