import type { DocumentType } from '../../types'
import { DOCUMENT_TYPE_LABELS } from '../../types'
import type {
  GenerationCallOptions,
  GenerationProvider,
  GenerationVars,
} from './GenerationProvider'

/** New AI Studio keys reject retired 2.x flash IDs; 3.1 lite is available on free credit. */
const DEFAULT_MODEL = 'gemini-3.1-flash-lite'

function buildPrompt(type: DocumentType, vars: GenerationVars): string {
  const label = DOCUMENT_TYPE_LABELS[type] ?? type
  const interview =
    vars.interviewAnswers && Object.keys(vars.interviewAnswers).length > 0
      ? Object.entries(vars.interviewAnswers)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join('\n')
      : '(없음)'

  return [
    '당신은 PlanOS의 시니어 프로덕트 라이터입니다.',
    `요청 산출물: ${label} (${type})`,
    '반드시 한국어 마크다운만 출력하세요. 서론·사과·가상 프로젝트 제안 금지. 본문 제목부터 시작하세요.',
    '아래 프로젝트 정보를 그대로 사용하세요. 다른 서비스로 바꾸거나 빈 칸/[?] 템플릿을 만들지 마세요.',
    '',
    `프로젝트명: ${vars.title}`,
    `목표 사용자: ${vars.targetUser}`,
    `서비스 유형: ${vars.serviceType ?? '미정'}`,
    `서비스 설명: ${vars.description ?? ''}`,
    '인터뷰 답변:',
    interview,
    '',
    `첫 제목에는 반드시 "${vars.title}"을(를) 포함하세요.`,
    '실무에서 바로 쓸 수 있게 구체적 섹션·체크리스트·예시 포함.',
  ].join('\n')
}

/**
 * Google Gemini (AI Studio / Generative Language API).
 * Server-only — API key must never reach the browser bundle.
 */
export class GeminiProvider implements GenerationProvider {
  readonly id = 'gemini'
  private readonly apiKey: string
  private readonly model: string

  constructor(apiKey: string, model = DEFAULT_MODEL) {
    this.apiKey = apiKey
    this.model = model
  }

  async generateDocument(
    type: DocumentType,
    vars: GenerationVars,
    options?: GenerationCallOptions,
  ): Promise<string> {
    if (options?.signal?.aborted) {
      const err = new Error('Generation aborted')
      err.name = 'AbortError'
      throw err
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent` +
      `?key=${encodeURIComponent(this.apiKey)}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: options?.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(type, vars) }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
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
    if (!text.trim()) {
      throw new Error('Gemini returned empty content')
    }
    return text.trim()
  }
}
