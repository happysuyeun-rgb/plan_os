/**
 * Dual-entry start path (E-01). UX default only — not a mode lock, not billing.
 * Stored in project.interview_answers under a reserved key (no DDL).
 */

export type PlanningEntryPath = 'direct' | 'with_pm'

export const PLANNING_ENTRY_ANSWER_KEY = '_planning_entry_path'

export const PLANNING_ENTRY_LABELS: Record<PlanningEntryPath, string> = {
  direct: '직접 기획',
  with_pm: '기본 PM과 진행',
}

export const PLANNING_ENTRY_HINTS: Record<PlanningEntryPath, string> = {
  direct:
    '기존처럼 문서·인터뷰로 바로 시작합니다. 진행 중에도 AI 직원을 투입할 수 있습니다.',
  with_pm:
    '같은 프로젝트를 만든 뒤 사람 PM 계획(/plans)으로 이어집니다. AI 실행·결제 동의가 아닙니다.',
}

export function isPlanningEntryPath(value: unknown): value is PlanningEntryPath {
  return value === 'direct' || value === 'with_pm'
}

export function readPlanningEntryPath(
  interviewAnswers: Record<string, string> | null | undefined,
): PlanningEntryPath | null {
  const raw = interviewAnswers?.[PLANNING_ENTRY_ANSWER_KEY]
  return isPlanningEntryPath(raw) ? raw : null
}

export function withPlanningEntryPath(
  interviewAnswers: Record<string, string>,
  path: PlanningEntryPath,
): Record<string, string> {
  return { ...interviewAnswers, [PLANNING_ENTRY_ANSWER_KEY]: path }
}

/** After create+generate, where to send the user for this entry preference. */
export function postCreateDestination(
  projectId: string,
  path: PlanningEntryPath,
): string {
  if (path === 'with_pm') return `/projects/${projectId}/plans`
  return `/projects/${projectId}/prd`
}
