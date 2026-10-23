import type { GenerationProvider, ProviderSelection } from './GenerationProvider'
import { PlaceholderProvider } from './PlaceholderProvider'

const placeholder = new PlaceholderProvider()

const registry: Record<string, GenerationProvider> = {
  [placeholder.id]: placeholder,
}

/** Resolve the active generation provider. Never selects a paid provider by default. */
export function resolveGenerationProvider(selection: ProviderSelection = {}): GenerationProvider {
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
