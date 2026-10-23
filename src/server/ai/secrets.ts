/**
 * Server-only secret access. Never import this module from browser bundles.
 * Paid provider keys stay in process env / Edge secrets until user approval.
 */

export type AiSecretName =
  | 'PLANOS_LLM_API_KEY'
  | 'PLANOS_LLM_BASE_URL'
  | 'PLANOS_AI_MONTHLY_TOKEN_CAP'
  | 'PLANOS_AI_MONTHLY_COST_CAP_USD'

export function readAiSecret(name: AiSecretName): string | undefined {
  if (typeof window !== 'undefined') {
    throw new Error('Ai secrets must not be read in the browser')
  }
  const value = process.env[name]
  return value && value.trim() ? value.trim() : undefined
}

/** True only when a real provider key is present — still requires spend approval to call. */
export function hasPaidProviderCredentials(): boolean {
  return Boolean(readAiSecret('PLANOS_LLM_API_KEY'))
}
