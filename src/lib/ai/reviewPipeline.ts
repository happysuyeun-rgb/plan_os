/**
 * Vertical slice (Phase D): citation findings → human decision → optional S1
 * task → re-review job. Default store is browser-local (survives refresh).
 * DB-backed store (027) remains DRAFT — not applied to ops.
 */

import {
  type ReviewFinding,
  type ReviewJob,
  InMemoryReviewJobStore,
  transitionReviewJob,
} from './reviewJob'
import { type ReviewJobStoreBag } from './browserReviewJobStore'
import { createReviewStore, resolveReviewStoreMode } from './reviewStoreFactory'
import { assertFindingsMatchDocuments, type CitationDocument } from './citationVerify'

export type ReviewJobStore = ReviewJobStoreBag

export type CreateTaskFromFinding = (input: {
  projectId: string
  finding: ReviewFinding
  reviewJobId: string
}) => Promise<{ taskId: string }>

export type ReviewPipelineResult = {
  job: ReviewJob
  createdTaskId?: string
  /** True when taskId came from acceptedFindingTaskIds (no new create). */
  reusedExistingTask?: boolean
  reReviewJob?: ReviewJob
}

function nowIso() {
  return new Date().toISOString()
}

export function createReviewJob(
  projectId: string,
  findings: ReviewFinding[] = [],
  link?: { parentReviewJobId?: string; sourceTaskId?: string },
): ReviewJob {
  const stamp = nowIso()
  return {
    id: crypto.randomUUID(),
    projectId,
    status: 'queued',
    findings,
    acceptedFindingTaskIds: {},
    parentReviewJobId: link?.parentReviewJobId,
    sourceTaskId: link?.sourceTaskId,
    version: 0,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

export type SubmitFindingsMeta = {
  sourceManifest?: ReviewJob['sourceManifest']
  insufficientInput?: boolean
  staffBrief?: ReviewJob['staffBrief']
}

/** queued -> running -> awaiting_human with citation-backed findings. */
export async function submitFindingsForHumanReview(
  store: ReviewJobStore,
  job: ReviewJob,
  findings: ReviewFinding[],
  docs?: CitationDocument[],
  meta: SubmitFindingsMeta = {},
): Promise<ReviewJob> {
  if (docs) {
    assertFindingsMatchDocuments(findings, docs)
  }
  let next = transitionReviewJob(job, 'running')
  next = await store.put(next)
  next = transitionReviewJob(next, 'awaiting_human', {
    findings,
    sourceManifest: meta.sourceManifest,
    insufficientInput: meta.insufficientInput,
    staffBrief: meta.staffBrief,
  })
  return store.put(next)
}

/**
 * Human accepts → create S1 task once per finding (idempotent) → optional re-review.
 */
export async function acceptReviewAndOpenTask(
  store: ReviewJobStore,
  job: ReviewJob,
  opts: {
    createTask?: CreateTaskFromFinding
    findingId?: string
    requestReReview?: boolean
    /** When set, CAS against this version (concurrent tab protection). */
    expectedVersion?: number
  } = {},
): Promise<ReviewPipelineResult> {
  if (job.status !== 'awaiting_human' && job.status !== 'accepted') {
    throw new Error(`accept requires awaiting_human|accepted, got ${job.status}`)
  }
  const finding = opts.findingId
    ? job.findings.find((f) => f.id === opts.findingId)
    : job.findings[0]
  if (!finding) throw new Error('No finding available to link to a task')

  const priorMap = { ...(job.acceptedFindingTaskIds ?? {}) }
  const existingTaskId = priorMap[finding.id]
  let createdTaskId: string | undefined = existingTaskId
  let reusedExistingTask = Boolean(existingTaskId)

  if (!existingTaskId && opts.createTask) {
    const created = await opts.createTask({
      projectId: job.projectId,
      finding,
      reviewJobId: job.id,
    })
    createdTaskId = created.taskId
    priorMap[finding.id] = created.taskId
    reusedExistingTask = false
  }

  const patch: Partial<ReviewJob> = {
    linkedTaskId: createdTaskId ?? job.linkedTaskId,
    acceptedFindingTaskIds: priorMap,
  }

  let accepted: ReviewJob
  if (job.status === 'awaiting_human') {
    const transitioned = transitionReviewJob(job, 'accepted', patch)
    if (opts.expectedVersion != null && store.putCas) {
      accepted = await store.putCas(transitioned, opts.expectedVersion)
    } else {
      accepted = await store.put(transitioned)
    }
  } else {
    // Already accepted — only update finding→task map (idempotent re-click).
    const merged = {
      ...job,
      ...patch,
      updatedAt: nowIso(),
    }
    if (opts.expectedVersion != null && store.putCas) {
      accepted = await store.putCas(merged, opts.expectedVersion)
    } else {
      accepted = await store.put(merged)
    }
  }

  let reReviewJob: ReviewJob | undefined
  if (opts.requestReReview !== false && !reusedExistingTask) {
    reReviewJob = await store.put(
      createReviewJob(job.projectId, [], {
        parentReviewJobId: job.id,
        sourceTaskId: createdTaskId,
      }),
    )
  }

  return { job: accepted, createdTaskId, reusedExistingTask, reReviewJob }
}

export async function rejectReview(
  store: ReviewJobStore,
  job: ReviewJob,
  reason: string,
): Promise<ReviewJob> {
  return store.put(transitionReviewJob(job, 'rejected', { errorMessage: reason }))
}

const resolved = createReviewStore()
export const defaultReviewStore: ReviewJobStore = resolved.store
export const REVIEW_STORE_MODE = resolved.mode

/** @deprecated Prefer defaultReviewStore; kept for tests that need a fresh memory map. */
export function createMemoryReviewStore(): ReviewJobStore {
  return new InMemoryReviewJobStore()
}

export function activeReviewStoreMode() {
  return resolveReviewStoreMode()
}
