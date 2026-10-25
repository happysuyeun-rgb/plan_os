/**
 * AI planning-review RBAC (client + unit-testable; no cross-module runtime imports).
 * Keep in sync with permissions.ts ai.review.* grants.
 * Viewer: view only. Owner/Editor: run, accept→task, request changes.
 */

import type { MemberRole } from '../../types'

export type AiReviewAction = 'view' | 'run' | 'accept' | 'request_changes'

export function canAiReview(role: MemberRole | null, action: AiReviewAction): boolean {
  if (!role) return false
  if (action === 'view') return true
  return role === 'owner' || role === 'editor'
}

export function assertCanAiReview(role: MemberRole | null, action: AiReviewAction): void {
  if (!canAiReview(role, action)) {
    throw new Error(`AI 검수 권한 없음: ${action} (role=${role ?? 'none'})`)
  }
}
