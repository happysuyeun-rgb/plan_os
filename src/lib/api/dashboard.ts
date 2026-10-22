import type { Project } from '../../types'
import {
  buildWorkSummaries,
  type ProjectWorkSummary,
} from '../dashboardSummary'
import { fetchProjects } from './projects'
import { supabase } from '../supabase'
import { throwIfError } from '../supabaseHelpers'

/** 소유(owner) 또는 활성 멤버인 프로젝트를 모두 반환한다 (fetchProjects의 owner 전용 범위를 보완). */
export async function fetchDashboardProjects(userId: string): Promise<Project[]> {
  const ownProjects = await fetchProjects(userId)

  const { data: memberships, error: membershipError } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)
    .eq('status', 'active')
  throwIfError(membershipError)

  const memberProjectIds = (memberships ?? [])
    .map((row) => row.project_id as string)
    .filter((projectId) => !ownProjects.some((project) => project.id === projectId))

  let memberProjects: Project[] = []
  if (memberProjectIds.length > 0) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .in('id', memberProjectIds)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
    throwIfError(error)
    memberProjects = data ?? []
  }

  return [...ownProjects, ...memberProjects]
}

/** 프로젝트 전체를 한 번에 조회해 서버(RLS) 범위 안에서 집계한다. 프로젝트별 N+1 조회를 하지 않는다. */
export async function fetchWorkSummaries(
  projectIds: string[],
): Promise<ProjectWorkSummary[]> {
  if (projectIds.length === 0) return []

  const { data: taskRows, error: taskError } = await supabase
    .from('project_tasks')
    .select('project_id, status')
    .in('project_id', projectIds)
    .is('deleted_at', null)
  throwIfError(taskError)

  const pendingApprovals = new Map<string, number>()
  try {
    const { data: plans, error: planError } = await supabase
      .from('pm_plans')
      .select('project_id')
      .in('project_id', projectIds)
      .eq('status', 'pending_owner_approval')
    throwIfError(planError)
    for (const plan of plans ?? []) {
      const projectId = plan.project_id as string
      pendingApprovals.set(projectId, (pendingApprovals.get(projectId) ?? 0) + 1)
    }
  } catch {
    // PM 승인(022) 구간이 적용되지 않은 환경에서는 승인 지표를 강제하지 않는다.
  }

  return buildWorkSummaries(
    projectIds,
    (taskRows ?? []) as { project_id: string; status: string }[],
    pendingApprovals,
  )
}
