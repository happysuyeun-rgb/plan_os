/**
 * ReviewJob store selection contract:
 *   VITE_AI_REVIEW_STORE=browser (default) → BrowserReviewJobStore / memory
 *   VITE_AI_REVIEW_STORE=server → ServerReviewJobStore (requires 027 on DB)
 *
 * Never imply ops durability without 027 applied + approval.
 */

import {
  createDefaultReviewStore,
  REVIEW_STORE_MODE_BROWSER,
  REVIEW_STORE_MODE_MEMORY,
  type ReviewJobStoreBag,
} from './browserReviewJobStore'
import { REVIEW_STORE_MODE_SERVER, ServerReviewJobStore } from './serverReviewJobStore'

export type ReviewStoreMode =
  | typeof REVIEW_STORE_MODE_BROWSER
  | typeof REVIEW_STORE_MODE_MEMORY
  | typeof REVIEW_STORE_MODE_SERVER

export function resolveReviewStoreMode(
  env: { VITE_AI_REVIEW_STORE?: string } = import.meta.env as { VITE_AI_REVIEW_STORE?: string },
): ReviewStoreMode {
  const raw = (env.VITE_AI_REVIEW_STORE ?? 'browser').toLowerCase()
  if (raw === 'server') return REVIEW_STORE_MODE_SERVER
  if (typeof localStorage === 'undefined') return REVIEW_STORE_MODE_MEMORY
  return REVIEW_STORE_MODE_BROWSER
}

export function createReviewStore(
  env?: { VITE_AI_REVIEW_STORE?: string },
): { store: ReviewJobStoreBag; mode: ReviewStoreMode } {
  const mode = resolveReviewStoreMode(env)
  if (mode === REVIEW_STORE_MODE_SERVER) {
    return { store: new ServerReviewJobStore(), mode }
  }
  return { store: createDefaultReviewStore(), mode }
}
