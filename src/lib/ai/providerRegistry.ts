import type { GenerationProvider, ProviderSelection } from './GenerationProvider'
import { GeminiProvider } from './GeminiProvider'
import { PlaceholderProvider } from './PlaceholderProvider'

const placeholder = new PlaceholderProvider()

const registry: Record<string, GenerationProvider> = {
  [placeholder.id]: placeholder,
}

/** Resolve the active generation provider. Gemini registers only when a key is supplied. */
export function resolveGenerationProvider(
  selection: ProviderSelection = {},
  opts?: { geminiApiKey?: string; geminiModel?: string },
): GenerationProvider {
  if (opts?.geminiApiKey) {
    registry.gemini = new GeminiProvider(opts.geminiApiKey, opts.geminiModel)
  }

  const id = selection.preferredId ?? placeholder.id
  const provider = registry[id]
  if (!provider) {
    throw new Error(`Unknown generation provider: ${id}`)
  }
  return provider
}

export function listRegisteredProviders(): readonly string[] {
  return Object.keys(registry)
}
