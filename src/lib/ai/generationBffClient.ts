/**
 * Browser client for POST /api/ai/generate.
 * Dev: Vite middleware. Preview: api/ai/generate.ts serverless.
 * Paid mode is never requested from the client in this phase.
 */
import type { DocumentType } from '../../types'
import type { GenerationVars } from './GenerationProvider'

export type BffGenerateResult = {
  mode: 'placeholder' | 'gemini' | 'paid'
  providerId: string
  content: string
}

const BFF_TIMEOUT_MS = 25_000

export async function generateDocumentViaBff(
  documentType: DocumentType,
  vars: GenerationVars,
): Promise<BffGenerateResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), BFF_TIMEOUT_MS)
  try {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentType,
        vars,
        allowPaidCalls: false,
      }),
      signal: controller.signal,
    })
    const data = (await res.json()) as BffGenerateResult & { error?: string }
    if (!res.ok) {
      throw new Error(data.error ?? `BFF generation failed (${res.status})`)
    }
    if (data.mode !== 'placeholder' && data.mode !== 'gemini' && data.mode !== 'paid') {
      throw new Error('Unexpected BFF response mode')
    }
    return data
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('BFF generation timed out')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
