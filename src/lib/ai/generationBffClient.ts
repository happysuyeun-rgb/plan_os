/**
 * Browser client for POST /api/ai/generate.
 * Dev: Vite middleware. Preview: api/ai/generate.ts serverless.
 * Paid mode is never requested from the client in this phase.
 */
import type { DocumentType } from '../../types'
import type { GenerationVars } from './GenerationProvider'

export type BffGenerateResult = {
  mode: 'placeholder' | 'paid'
  providerId: string
  content: string
}

export async function generateDocumentViaBff(
  documentType: DocumentType,
  vars: GenerationVars,
): Promise<BffGenerateResult> {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documentType,
      vars,
      allowPaidCalls: false,
    }),
  })
  const data = (await res.json()) as BffGenerateResult & { error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? `BFF generation failed (${res.status})`)
  }
  if (data.mode !== 'placeholder' && data.mode !== 'paid') {
    throw new Error('Unexpected BFF response mode')
  }
  return data
}
