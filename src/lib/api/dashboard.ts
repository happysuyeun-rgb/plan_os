import type { Project } from '../../types'
import {
  buildWorkSummariesFromCounts,
  type ProjectWorkSummary,
  type TaskCountAggregate,
} from '../dashboardSummary'
import { fetchProjects } from './projects'
import { supabase } from '../supabase'
import { throwIfError } from '../supabaseHelpers'

/** 소유(owner) 또는 활성 멤버인 프로젝트를 모두 반환한다 (fetchProjects의 owner 전용 범위를 보완). */
export async function fetchDashboardProjects(
  userId: string,
  signal?: AbortSignal,
): Promise<Project[]> {
  const ownProjects = await fetchProjects(userId)

  let membershipQuery = supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)
    .eq('status', 'active')
  if (signal) membershipQuery = membershipQuery.abortSignal(signal)
  const { data: memberships, error: membershipError } = await membershipQuery
  throwIfError(membershipError)

  const memberProjectIds = (memberships ?? [])
    .map((row) => row.project_id as string)
    .filter((projectId) => !ownProjects.some((project) => project.id === projectId))

  let memberProjects: Project[] = []
  if (memberProjectIds.length > 0) {
    let projectQuery = supabase
      .from('projects')
      .select('*')
      .in('id', memberProjectIds)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
    if (signal) projectQuery = projectQuery.abortSignal(signal)
    const { data, error } = await projectQuery
    throwIfError(error)
    memberProjects = data ?? []
  }

  return [...ownProjects, ...memberProjects]
}

export interface WorkSummariesResult {
  summaries: ProjectWorkSummary[]
  /**
   * false면 PM 승인 집계를 연결하지 못한 상태다. 이때 승인 대기 건수는
   * 실제 0건이 아니므로 화면은 숫자를 단정하지 않고 '미연결'로 표시한다.
   */
  approvalsAvailable: boolean
}

/**
 * 서버(RLS) 안에서 집계하는 RPC로 업무 현황을 읽는다. 브라우저가 행을
 * 세지 않으므로 PostgREST 응답 상한에 잘려 완료율이 틀어질 수 없다.
 */
export async function fetchWorkSummaries(
  projectIds: string[],
  signal?: AbortSignal,
): Promise<WorkSummariesResult> {
  if (projectIds.length === 0) return { summaries: [], approvalsAvailable: true }

  let taskQuery = supabase.rpc('get_dashboard_task_counts', { p_project_ids: projectIds })
  if (signal) taskQuery = taskQuery.abortSignal(signal)
  const { data: counts, error: taskError } = await taskQuery
  if (taskError) throw taskError

  const pendingApprovals = new Map<string, number>()
  let approvalsAvailable = true
  try {
    let approvalQuery = supabase.rpc('get_dashboard_pending_approvals', {
      p_project_ids: projectIds,
    })
    if (signal) approvalQuery = approvalQuery.abortSignal(signal)
    const { data: approvals, error: approvalError } = await approvalQuery
    if (approvalError) throw approvalError
    for (const row of approvals ?? []) {
      pendingApprovals.set(row.project_id as string, Number(row.pending_approvals))
    }
  } catch (approvalLoadError) {
    // PM 구간 미적용·권한·네트워크 오류를 승인 대기 0건으로 위장하지 않는다.
    if (signal?.aborted) throw approvalLoadError
    approvalsAvailable = false
  }

  return {
    summaries: buildWorkSummariesFromCounts(
      projectIds,
      (counts ?? []) as TaskCountAggregate[],
      pendingApprovals,
    ),
    approvalsAvailable,
  }
}
