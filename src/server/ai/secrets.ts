/**
 * Server-only secret access. Never import this module from browser bundles.
 * Paid provider keys stay in process env / Edge secrets until user approval.
 */

export type AiSecretName =
  | 'GEMINI_API_KEY'
  | 'GEMINI_MODEL'
  | 'PLANOS_LLM_API_KEY'
  | 'PLANOS_LLM_BASE_URL'
  | 'PLANOS_AI_MONTHLY_TOKEN_CAP'
  | 'PLANOS_AI_MONTHLY_COST_CAP_USD'

export function readAiSecret(name: AiSecretName): string | undefined {
  // Avoid referencing DOM `window` (not in Node/tsc lib); detect browser via globalThis.
  const g = globalThis as { window?: unknown }
  if (typeof g.window !== 'undefined') {
    throw new Error('Ai secrets must not be read in the browser')
  }
  const value = process.env[name]
  return value && value.trim() ? value.trim() : undefined
}

/** Gemini free-credit / AI Studio key (preferred for current local MVP). */
export function hasGeminiCredentials(): boolean {
  return Boolean(readAiSecret('GEMINI_API_KEY'))
}

/** Legacy paid LLM key slot — still requires explicit spend approval to call. */
export function hasPaidProviderCredentials(): boolean {
  return Boolean(readAiSecret('PLANOS_LLM_API_KEY'))
}
