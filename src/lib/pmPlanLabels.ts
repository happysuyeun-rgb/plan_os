import type { PmPlanStatus } from './api/pmPlans'

export const PM_PLAN_STATUS_LABELS: Record<PmPlanStatus, string> = {
  draft: '초안',
  pending_owner_approval: '소유자 승인 대기',
  approved: '승인됨',
  rejected: '반려됨',
  needs_revision: '수정 요청',
}
