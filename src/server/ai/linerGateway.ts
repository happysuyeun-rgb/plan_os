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
