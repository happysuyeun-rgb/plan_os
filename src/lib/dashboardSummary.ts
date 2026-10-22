export interface TaskCountRow {
  project_id: string
  status: string
}

export interface ProjectWorkSummary {
  projectId: string
  total: number
  done: number
  inProgress: number
  inReview: number
  blocked: number
  pendingApprovals: number
  /** 등록 업무 완료율. 등록(보드의 업무) 업무 완료율만 의미한다. */
  completionRate: number | null
}

export interface DashboardTotals {
  projectCount: number
  doneTotal: number
  taskTotal: number
  blockedTotal: number
  pendingApprovalsTotal: number
  /** 등록 업무 완료율(프로젝트 전체 완성도 아님). 업무가 없을 때 null. */
  completionRate: number | null
}

function rate(done: number, total: number): number | null {
  return total > 0 ? Math.round((done / total) * 100) : null
}

export function buildWorkSummaries(
  projectIds: string[],
  taskRows: TaskCountRow[],
  pendingApprovals: Map<string, number>,
): ProjectWorkSummary[] {
  const perProject = new Map<string, ProjectWorkSummary>()
  for (const projectId of projectIds) {
    perProject.set(projectId, {
      projectId,
      total: 0,
      done: 0,
      inProgress: 0,
      inReview: 0,
      blocked: 0,
      pendingApprovals: pendingApprovals.get(projectId) ?? 0,
      completionRate: null,
    })
  }
  for (const row of taskRows) {
    const summary = perProject.get(row.project_id)
    if (!summary) continue
    summary.total += 1
    if (row.status === 'done') summary.done += 1
    else if (row.status === 'in_progress') summary.inProgress += 1
    else if (row.status === 'in_review') summary.inReview += 1
    else if (row.status === 'blocked') summary.blocked += 1
  }
  for (const summary of perProject.values()) {
    summary.completionRate = rate(summary.done, summary.total)
  }
  return [...perProject.values()]
}

export function summarizeTotals(summaries: ProjectWorkSummary[]): DashboardTotals {
  const doneTotal = summaries.reduce((sum, s) => sum + s.done, 0)
  const taskTotal = summaries.reduce((sum, s) => sum + s.total, 0)
  return {
    projectCount: summaries.length,
    doneTotal,
    taskTotal,
    blockedTotal: summaries.reduce((sum, s) => sum + s.blocked, 0),
    pendingApprovalsTotal: summaries.reduce((sum, s) => sum + s.pendingApprovals, 0),
    completionRate: rate(doneTotal, taskTotal),
  }
}

export interface DashboardProjectRow {
  projectId: string
  title: string
  serviceType: string
  updatedAt: string
  summary: ProjectWorkSummary
}

/** 차단 업무 → PM 승인 대기 → 최근 업데이트 → 프로젝트명 순으로 정렬한다. */
export function sortDashboardRows(rows: DashboardProjectRow[]): DashboardProjectRow[] {
  return [...rows].sort((a, b) => {
    const blockedDiff = (b.summary.blocked > 0 ? 1 : 0) - (a.summary.blocked > 0 ? 1 : 0)
    if (blockedDiff !== 0) return blockedDiff
    const blockedCountDiff = b.summary.blocked - a.summary.blocked
    if (blockedCountDiff !== 0) return blockedCountDiff
    const pendingDiff = b.summary.pendingApprovals - a.summary.pendingApprovals
    if (pendingDiff !== 0) return pendingDiff
    const updatedDiff = +new Date(b.updatedAt) - +new Date(a.updatedAt)
    if (updatedDiff !== 0) return updatedDiff
    return a.title.localeCompare(b.title, 'ko')
  })
}

export function formatCompletionRate(summary: ProjectWorkSummary): string {
  if (summary.total === 0) return '업무 미등록'
  return `${summary.done} / ${summary.total} · ${summary.completionRate}%`
}
