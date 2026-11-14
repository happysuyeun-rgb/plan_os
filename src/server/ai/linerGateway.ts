/**
 * Liner Router API adapter (server-only).
 * Docs: https://liner.com/ko/developers/docs/router-api
 *
 * Env (never VITE_*):
 *   LINER_API_KEY — required for live calls
 *   PLANOS_LINER_BASE_URL — default https://platform.liner.com/api/v1
 *   PLANOS_LINER_MODEL — default liner-gemini-router
 *
 * Gemini document BFF (GEMINI_API_KEY) stays separate.
 */

export const LINER_DEFAULT_BASE_URL = 'https://platform.liner.com/api/v1'
export const LINER_DEFAULT_MODEL = 'liner-gemini-router'

export type LinerChatResult = {
  dryRun: boolean
  model: string
  outputText: string
  usage: {
    inputTokens: number | null
    outputTokens: number | null
    cost: number | null
    rawModel: string | null
  }
}

export function readLinerConfig() {
  const apiKey = process.env.LINER_API_KEY?.trim() || ''
  const baseUrl = (process.env.PLANOS_LINER_BASE_URL || LINER_DEFAULT_BASE_URL).replace(/\/$/, '')
  const model = process.env.PLANOS_LINER_MODEL || LINER_DEFAULT_MODEL
  const maxCalls = Number(process.env.PLANOS_LINER_MAX_CALLS_PER_REQUEST || '4')
  return {
    apiKey,
    baseUrl,
    model,
    maxCalls: Number.isFinite(maxCalls) && maxCalls > 0 ? maxCalls : 4,
    configured: Boolean(apiKey),
  }
}

export type LinerSearchAgentResult = {
  dryRun: boolean
  answer: string
  references: Array<Record<string, unknown>>
  latencyMs: number
  raw: Record<string, unknown> | null
}

export type LinerWebSearchResult = {
  dryRun: boolean
  results: Array<Record<string, unknown>>
  requestId: string | null
  latencyMs: number
  raw: Record<string, unknown> | null
}

/** Search Agent (stream:false) — primary market research engine. */
export async function linerSearchAgent(
  query: string,
  options: { dryRun?: boolean; lang?: string; mode?: string; requestId?: string } = {},
): Promise<LinerSearchAgentResult> {
  const cfg = readLinerConfig()
  const dryRun = options.dryRun === true || !cfg.configured
  if (dryRun) {
    return {
      dryRun: true,
      answer: '[dry-run] LINER_API_KEY missing — no live Search Agent call.',
      references: [],
      latencyMs: 0,
      raw: null,
    }
  }
  const started = Date.now()
  const res = await fetch(`${cfg.baseUrl}/agents/search`, {
    method: 'POST',
    headers: {
      'x-api-key': cfg.apiKey,
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: query }],
      model: null,
      lang: options.lang ?? 'ko',
      mode: options.mode ?? 'general',
      stream: false,
      request_id: options.requestId,
    }),
  })
  const latencyMs = Date.now() - started
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Liner search agent failed: ${res.status} ${body.slice(0, 500)}`)
  }
  const data = (await res.json()) as {
    answer?: string
    references?: Array<Record<string, unknown>>
  }
  return {
    dryRun: false,
    answer: data.answer || '',
    references: Array.isArray(data.references) ? data.references : [],
    latencyMs,
    raw: data as Record<string, unknown>,
  }
}

/** Web search tool — include_knowledge:false for lower cost. */
export async function linerWebSearch(
  query: string,
  options: {
    dryRun?: boolean
    lang?: string
    countryCode?: string
    maxResults?: number
  } = {},
): Promise<LinerWebSearchResult> {
  const cfg = readLinerConfig()
  const dryRun = options.dryRun === true || !cfg.configured
  if (dryRun) {
    return {
      dryRun: true,
      results: [],
      requestId: null,
      latencyMs: 0,
      raw: null,
    }
  }
  const started = Date.now()
  const res = await fetch(`${cfg.baseUrl}/tools/search/web`, {
    method: 'POST',
    headers: {
      'x-api-key': cfg.apiKey,
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      lang: options.lang ?? 'ko',
      country_code: options.countryCode,
      max_results: options.maxResults ?? 8,
      include_knowledge: false,
    }),
  })
  const latencyMs = Date.now() - started
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Liner web search failed: ${res.status} ${body.slice(0, 500)}`)
  }
  const data = (await res.json()) as {
    requestId?: string
    results?: Array<Record<string, unknown>>
  }
  return {
    dryRun: false,
    results: Array.isArray(data.results) ? data.results : [],
    requestId: data.requestId ?? null,
    latencyMs,
    raw: data as Record<string, unknown>,
  }
}

/** OpenAI-compatible Chat Completions against Liner Router. */
export async function linerChatCompletion(
  prompt: string,
  options: { dryRun?: boolean } = {},
): Promise<LinerChatResult> {
  const cfg = readLinerConfig()
  const dryRun = options.dryRun === true || !cfg.configured
  if (dryRun) {
    return {
      dryRun: true,
      model: cfg.model,
      outputText: '[dry-run] LINER_API_KEY missing — no live Liner call.',
      usage: { inputTokens: 0, outputTokens: 0, cost: 0, rawModel: null },
    }
  }

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Liner chat failed: ${res.status} ${body.slice(0, 500)}`)
  }
  const data = (await res.json()) as {
    model?: string
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
  }
  return {
    dryRun: false,
    model: cfg.model,
    outputText: data.choices?.[0]?.message?.content || '',
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? null,
      outputTokens: data.usage?.completion_tokens ?? null,
      cost: data.usage?.cost ?? null,
      rawModel: data.model ?? null,
    },
  }
}
