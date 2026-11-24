import type { DocumentType } from '../../types'
import { assemblePrompt } from '../generation/prompts/assemblePrompt'
import type {
  GenerationCallOptions,
  GenerationProvider,
  GenerationVars,
} from './GenerationProvider'

/** New AI Studio keys reject retired 2.x flash IDs; prefer 3.5 lite, then 3.1. */
const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest']
const ATTEMPT_TIMEOUT_MS = 22_000

/**
 * Google Gemini (AI Studio / Generative Language API).
 * Server-only — API key must never reach the browser bundle.
 */
export class GeminiProvider implements GenerationProvider {
  readonly id = 'gemini'
  private readonly apiKey: string
  private readonly preferredModel: string

  constructor(apiKey: string, model = DEFAULT_MODEL) {
    this.apiKey = apiKey
    this.preferredModel = model || DEFAULT_MODEL
  }

  private candidates(): string[] {
    return [
      this.preferredModel,
      ...FALLBACK_MODELS.filter((m) => m !== this.preferredModel),
    ]
  }

  private isRetryable(message: string): boolean {
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
      m.includes('no longer available')
    )
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

    const prompt = assemblePrompt(type, vars)
    const errors: string[] = []

    for (const model of this.candidates()) {
      if (options?.signal?.aborted) {
        const err = new Error('Generation aborted')
        err.name = 'AbortError'
        throw err
      }
      try {
        return await this.generateOnce(model, prompt, options?.signal)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError' && options?.signal?.aborted) {
          throw err
        }
        const message = err instanceof Error ? err.message : 'generation failed'
        errors.push(`${model}: ${message}`)
        if (!this.isRetryable(message)) {
          throw new Error(message)
        }
      }
    }

    throw new Error(errors.join(' | ') || 'All Gemini models failed')
  }

  private async generateOnce(
    model: string,
    prompt: string,
    outerSignal?: AbortSignal,
  ): Promise<string> {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
      `?key=${encodeURIComponent(this.apiKey)}`

    const controller = new AbortController()
    const onOuterAbort = () => controller.abort()
    outerSignal?.addEventListener('abort', onOuterAbort)
    const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.55,
            maxOutputTokens: 8192,
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
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Gemini timed out after ${ATTEMPT_TIMEOUT_MS}ms (${model})`)
      }
      throw err
    } finally {
      clearTimeout(timer)
      outerSignal?.removeEventListener('abort', onOuterAbort)
    }
  }
}
