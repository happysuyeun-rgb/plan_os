import type { PlanStep } from '../humanPmPlanDraft'
import { supabase } from '../supabase'
import { throwIfError, unwrap } from '../supabaseHelpers'

export type PmPlanStatus =
  | 'draft'
  | 'pending_owner_approval'
  | 'approved'
  | 'rejected'
  | 'needs_revision'

export type PmPlanSource = 'human' | 'ai_suggested'

export type PmPlan = {
  id: string
  project_id: string
  objective: string
  source: PmPlanSource
  status: PmPlanStatus
  version: number
  created_by: string
  created_at: string
  updated_at: string
}

export type PmPlanStep = {
  id: string
  plan_id: string
  position: number
  title: string
  acceptance_criteria: string
  depends_on_step_id: string | null
}

export type PmPlanEvent = {
  id: number
  plan_id: string
  project_id: string
  actor_id: string | null
  event_type:
    | 'draft_saved'
    | 'approval_requested'
    | 'approved'
    | 'rejected'
    | 'needs_revision'
    | 'step_task_linked'
  from_status: string | null
  to_status: string | null
  plan_version: number
  linked_task_id: string | null
  comment: string | null
  created_at: string
}

/** Stale version or illegal transition from the server (SQLSTATE P4001). */
export class PmPlanConflictError extends Error {
  constructor() {
    super('계획이 다른 곳에서 변경되었습니다. 최신 상태를 확인한 뒤 다시 시도하세요.')
    this.name = 'PmPlanConflictError'
  }
}

function throwPlanError(error: { code?: string; message?: string } | null): never {
  if (error?.code === 'P4001') throw new PmPlanConflictError()
  throw error ?? new Error('PM plan request failed')
}

export async function listPmPlans(projectId: string): Promise<PmPlan[]> {
  const { data, error } = await supabase
    .from('pm_plans')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
  throwIfError(error)
  return (data ?? []) as PmPlan[]
}

export async function fetchPmPlan(planId: string): Promise<{ plan: PmPlan; steps: PmPlanStep[] } | null> {
  const { data: plan, error } = await supabase
    .from('pm_plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle()
  throwIfError(error)
  if (!plan) return null
  const { data: steps, error: stepError } = await supabase
    .from('pm_plan_steps')
    .select('*')
    .eq('plan_id', planId)
    .order('position')
  throwIfError(stepError)
  return { plan: plan as PmPlan, steps: (steps ?? []) as PmPlanStep[] }
}

/**
 * Creates a human-authored plan draft (F-401 server persistence).
 * client-generated step ids keep a partial retry from duplicating steps:
 * an already-written step answers 23505 and is skipped.
 */
export async function createPmPlan(
  projectId: string,
  objective: string,
  steps: PlanStep[],
): Promise<PmPlan> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('로그인이 필요합니다.')

  const { data: plan, error } = await supabase
    .from('pm_plans')
    .insert({
      project_id: projectId,
      objective: objective.trim(),
      source: 'human',
      created_by: auth.user.id,
    })
    .select('*')
    .single()
  if (error) throwPlanError(error)
  const created = plan as PmPlan

  const idByClientId = new Map<string, string>()
  for (const [index, step] of steps.entries()) {
    const row = {
      id: step.id,
      plan_id: created.id,
      position: index + 1,
      title: step.title.trim(),
      acceptance_criteria: step.acceptanceCriteria.trim(),
    }
    const { data, error: insertError } = await supabase
      .from('pm_plan_steps')
      .insert(row)
      .select('id')
      .single()
    if (insertError && (insertError as { code?: string }).code !== '23505') {
      throwPlanError(insertError)
    }
    idByClientId.set(step.id, data?.id ?? step.id)
  }
  for (const step of steps) {
    if (!step.dependsOn) continue
    const dependsId = idByClientId.get(step.dependsOn)
    const ownId = idByClientId.get(step.id)
    if (!dependsId || !ownId) continue
    const { error: linkError } = await supabase
      .from('pm_plan_steps')
      .update({ depends_on_step_id: dependsId })
      .eq('id', ownId)
    if (linkError) throwPlanError(linkError)
  }

  return created
}

/** Atomic draft save (objective + steps) guarded by the plan version. */
export async function savePmPlanDraft(
  plan: PmPlan,
  objective: string,
  steps: PlanStep[],
): Promise<PmPlan> {
  const payload = steps.map((step, index) => ({
    title: step.title.trim(),
    acceptance_criteria: step.acceptanceCriteria.trim(),
    depends_on_position: step.dependsOn
      ? steps.findIndex((candidate) => candidate.id === step.dependsOn) + 1 || null
      : null,
    position: index + 1,
  }))
  const { data, error } = await supabase
    .rpc('save_pm_plan_draft', {
      p_plan_id: plan.id,
      p_expected_version: plan.version,
      p_objective: objective.trim(),
      p_steps: payload,
    })
    .single()
  if (error) throwPlanError(error)
  return unwrap(data as PmPlan | null, error)
}

export type PmPlanAction = 'request_approval' | 'approve' | 'reject' | 'needs_revision'

export async function transitionPmPlan(
  plan: PmPlan,
  action: PmPlanAction,
  comment?: string,
): Promise<PmPlan> {
  const { data, error } = await supabase
    .rpc('transition_pm_plan', {
      p_plan_id: plan.id,
      p_expected_version: plan.version,
      p_action: action,
      p_comment: comment?.trim() ? comment.trim() : null,
    })
    .single()
  if (error) throwPlanError(error)
  return unwrap(data as PmPlan | null, error)
}

export async function listPmPlanEvents(planId: string): Promise<PmPlanEvent[]> {
  const { data, error } = await supabase
    .from('pm_plan_approval_events')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true })
  throwIfError(error)
  return (data ?? []) as PmPlanEvent[]
}

export type LinkedPlanTask = {
  id: string
  project_id: string
  title: string
  status: string
  source_plan_id: string | null
  source_plan_step_id: string | null
  version: number
}

/** Idempotent: the same approved step always returns the same S1 task. */
export async function linkPmPlanStepToTask(stepId: string): Promise<LinkedPlanTask> {
  const { data, error } = await supabase
    .rpc('link_pm_plan_step_to_task', { p_step_id: stepId })
    .single()
  if (error) throwPlanError(error)
  return unwrap(data as LinkedPlanTask | null, error)
}

export async function listPlanStepTasks(projectId: string): Promise<LinkedPlanTask[]> {
  const { data, error } = await supabase
    .from('project_tasks')
    .select('id,project_id,title,status,source_plan_id,source_plan_step_id,version')
    .eq('project_id', projectId)
    .not('source_plan_step_id', 'is', null)
  throwIfError(error)
  return (data ?? []) as LinkedPlanTask[]
}
