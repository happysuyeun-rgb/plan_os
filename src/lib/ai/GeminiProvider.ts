import type { DocumentType } from '../../types'
import { assemblePrompt } from '../generation/prompts/assemblePrompt'
import type {
  GenerationCallOptions,
  GenerationProvider,
  GenerationVars,
} from './GenerationProvider'

/** New AI Studio keys reject retired 2.x flash IDs; 3.1 lite is available on free credit. */
const DEFAULT_MODEL = 'gemini-3.1-flash-lite'

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
        contents: [{ role: 'user', parts: [{ text: assemblePrompt(type, vars) }] }],
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
  }
}
