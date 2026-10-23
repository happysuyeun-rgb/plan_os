/**
 * Vertical slice (Phase D): citation findings → human decision → optional S1
 * task → re-review job. Persistence adapters are injected; default is memory
 * (MOCK). DB-backed store lands with draft migration 027 — not applied to ops.
 */

import {
  type ReviewFinding,
  type ReviewJob,
  InMemoryReviewJobStore,
  transitionReviewJob,
} from './reviewJob'

export type ReviewJobStore = {
  put(job: ReviewJob): ReviewJob | Promise<ReviewJob>
  get(id: string): ReviewJob | undefined | Promise<ReviewJob | undefined>
}

export type CreateTaskFromFinding = (input: {
  projectId: string
  finding: ReviewFinding
  reviewJobId: string
}) => Promise<{ taskId: string }>

export type ReviewPipelineResult = {
  job: ReviewJob
  createdTaskId?: string
  reReviewJob?: ReviewJob
}

function nowIso() {
  return new Date().toISOString()
}

export function createReviewJob(projectId: string, findings: ReviewFinding[] = []): ReviewJob {
  const stamp = nowIso()
  return {
    id: crypto.randomUUID(),
    projectId,
    status: 'queued',
    findings,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

/** queued → running → awaiting_human with citation-backed findings. */
export async function submitFindingsForHumanReview(
  store: ReviewJobStore,
  job: ReviewJob,
  findings: ReviewFinding[],
): Promise<ReviewJob> {
  let next = transitionReviewJob(job, 'running')
  await store.put(next)
  next = transitionReviewJob(next, 'awaiting_human', { findings })
  return store.put(next)
}

/**
 * Human accepts → optionally create an S1 task from the primary finding →
 * enqueue a follow-up review job (re-review), still placeholder/MOCK until
 * a real reviewer provider is approved.
 */
export async function acceptReviewAndOpenTask(
  store: ReviewJobStore,
  job: ReviewJob,
  opts: {
    createTask?: CreateTaskFromFinding
    findingId?: string
    requestReReview?: boolean
  } = {},
): Promise<ReviewPipelineResult> {
  if (job.status !== 'awaiting_human') {
    throw new Error(`accept requires awaiting_human, got ${job.status}`)
  }
  const finding = opts.findingId
    ? job.findings.find((f) => f.id === opts.findingId)
    : job.findings[0]
  if (!finding) throw new Error('No finding available to link to a task')

  let createdTaskId: string | undefined
  if (opts.createTask) {
    const created = await opts.createTask({
      projectId: job.projectId,
      finding,
      reviewJobId: job.id,
    })
    createdTaskId = created.taskId
  }

  const accepted = await store.put(
    transitionReviewJob(job, 'accepted', { linkedTaskId: createdTaskId }),
  )

  let reReviewJob: ReviewJob | undefined
  if (opts.requestReReview !== false) {
    reReviewJob = await store.put(createReviewJob(job.projectId, []))
  }

  return { job: accepted, createdTaskId, reReviewJob }
}

export async function rejectReview(
  store: ReviewJobStore,
  job: ReviewJob,
  reason: string,
): Promise<ReviewJob> {
  return store.put(transitionReviewJob(job, 'rejected', { errorMessage: reason }))
}

/** Default MOCK store — not evidence of durable AI review completion. */
export const defaultReviewStore: ReviewJobStore = new InMemoryReviewJobStore()

export const REVIEW_STORE_MODE = 'MOCK_IN_MEMORY' as const
