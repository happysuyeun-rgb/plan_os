/**
 * Vercel Preview serverless route: POST /api/ai/generate
 * Uses the same type-specific assemblePrompt as Vite GeminiProvider.
 * Never enables paid LLM calls.
 */
import { assemblePrompt } from '../../src/lib/generation/prompts/assemblePrompt'
import type { GenerationVars } from '../../src/lib/ai/GenerationProvider'
import type { DocumentType } from '../../src/types'

type Req = {
  method?: string
  body?: unknown
}

type Res = {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: string): void
}

const DEFAULT_MODEL = 'gemini-3.1-flash-lite'

const DOC_TYPES = new Set<DocumentType>([
  'prd',
  'ia',
  'screen_list',
  'policy',
  'wireframe',
  'cursor_prompt',
])

function placeholderContent(documentType: string, vars: GenerationVars): string {
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

function asDocumentType(value: string): DocumentType | null {
  return DOC_TYPES.has(value as DocumentType) ? (value as DocumentType) : null
}

function parseVars(raw: unknown): GenerationVars | null {
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
        ? (v.approvedSourceDocuments as GenerationVars['approvedSourceDocuments'])
        : undefined,
    priorDocuments:
      v.priorDocuments && typeof v.priorDocuments === 'object'
        ? (v.priorDocuments as GenerationVars['priorDocuments'])
        : undefined,
  }
}

async function generateWithGemini(documentType: DocumentType, vars: GenerationVars): Promise<string> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY missing')
  }
  const model = (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`
  const prompt = assemblePrompt(documentType, vars)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  return text.trim()
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
  let content = placeholderContent(documentType, vars)

  try {
    if ((process.env.GEMINI_API_KEY || '').trim()) {
      content = await generateWithGemini(documentType, vars)
      mode = 'gemini'
      providerId = 'gemini'
    }
  } catch {
    mode = 'placeholder'
    providerId = 'placeholder'
    content = placeholderContent(documentType, vars)
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('X-PlanOS-AI-Runtime', 'vercel-preview')
  res.end(
    JSON.stringify({
      mode,
      providerId,
      content,
      runtime: 'vercel-preview',
      attemptId: typeof body.attemptId === 'string' ? body.attemptId : crypto.randomUUID(),
    }),
  )
}
