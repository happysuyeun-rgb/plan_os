/**
 * Vercel Preview serverless route: POST /api/ai/generate
 * Self-contained (no relative imports into src/) so Node16 ESM resolution on
 * Vercel does not break the function. Vite-dev continues to use generationHttp.
 * Never enables paid LLM calls.
 */
type Req = {
  method?: string
  body?: unknown
}

type Res = {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: string): void
}

type Vars = {
  title?: string
  targetUser?: string
  description?: string
  serviceType?: string
  interviewAnswers?: Record<string, string>
}

const DEFAULT_MODEL = 'gemini-3.1-flash-lite'

function placeholderContent(documentType: string, vars: Vars): string {
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

function buildPrompt(documentType: string, vars: Vars): string {
  const purpose = vars.interviewAnswers?.purpose?.trim()
  if (purpose === 'pm_plan_draft') {
    return [
      '당신은 PlanOS의 시니어 PM입니다.',
      '출력은 한국어 마크다운만. 서론·사과 금지.',
      '형식 고정:',
      '## 목표',
      '(한 단락)',
      '### 단계 1 제목',
      '완료 기준: …',
      '### 단계 2 제목',
      '완료 기준: …',
      '### 단계 3 제목',
      '완료 기준: …',
      '결제·채용·성과 수치·가짜 KPI를 만들지 마세요.',
      '',
      `프로젝트명: ${vars.title}`,
      `목표 사용자: ${vars.targetUser}`,
      `서비스 유형: ${vars.serviceType ?? '미정'}`,
      `서비스 설명: ${vars.description ?? ''}`,
    ].join('\n')
  }

  return [
    '당신은 PlanOS의 시니어 프로덕트 라이터입니다.',
    `요청 산출물: ${documentType}`,
    '반드시 한국어 마크다운만 출력하세요. 서론·사과 금지.',
    `프로젝트명: ${vars.title}`,
    `목표 사용자: ${vars.targetUser}`,
    `서비스 유형: ${vars.serviceType ?? '미정'}`,
    `서비스 설명: ${vars.description ?? ''}`,
    `첫 제목에는 반드시 "${vars.title}"을(를) 포함하세요.`,
  ].join('\n')
}

async function generateWithGemini(documentType: string, vars: Vars): Promise<string> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY missing')
  }
  const model = (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(documentType, vars) }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
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

  const documentType = typeof body.documentType === 'string' ? body.documentType : ''
  const vars =
    body.vars && typeof body.vars === 'object' ? (body.vars as Vars) : ({} as Vars)
  // Gate C closed: Preview API never honors client paid flags.
  const unpaidGuard = { allowPaidCalls: false }
  if (body.allowPaidCalls === true && unpaidGuard.allowPaidCalls === false) {
    // Ignore paid request — Gemini credit path is still non-Gate-C template/BFF only.
  }

  if (!documentType || !vars.title || !vars.targetUser) {
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
