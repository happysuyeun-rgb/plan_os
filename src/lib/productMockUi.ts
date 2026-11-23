import { SHOW_PRODUCT_MOCK_UI } from '../config'

/**
 * Product surfaces that are Mock-only (N29/F-801 rooms, cross-doc Mock CTA,
 * legacy session review handoff) stay hidden unless explicitly re-enabled.
 *
 * Real paths (AI staff hire, CrewAI enqueue, market research, documents) stay visible.
 * Direct URLs still work for E2E; set VITE_SHOW_MOCK_UI=true to show entry CTAs.
 */
export function showProductMockUi(): boolean {
  return SHOW_PRODUCT_MOCK_UI
}
