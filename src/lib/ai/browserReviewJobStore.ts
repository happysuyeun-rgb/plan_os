/**
 * Browser-local durable ReviewJob store (survives refresh).
 * NOT migration 027 / ops DB — Preview/dev only until 027 is approved.
 */

import type { ReviewJob } from './reviewJob'

const PREFIX = 'planos:ai-review-jobs:v1:'

export class ReviewJobConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReviewJobConflictError'
  }
}

export type ReviewJobStoreBag = {
  put(job: ReviewJob): ReviewJob | Promise<ReviewJob>
  get(id: string): ReviewJob | undefined | Promise<ReviewJob | undefined>
  listByProject?(projectId: string): ReviewJob[] | Promise<ReviewJob[]>
  putCas?(job: ReviewJob, expectedVersion: number): ReviewJob | Promise<ReviewJob>
}

type Bucket = {
  jobs: Record<string, ReviewJob>
}

function key(projectId: string) {
  return PREFIX + encodeURIComponent(projectId)
}

function readBucket(projectId: string): Bucket {
  try {
    const raw = localStorage.getItem(key(projectId))
    if (!raw) return { jobs: {} }
    const parsed = JSON.parse(raw) as Bucket
    if (!parsed || typeof parsed !== 'object' || !parsed.jobs) return { jobs: {} }
    return { jobs: parsed.jobs }
  } catch {
    return { jobs: {} }
  }
}

function writeBucket(projectId: string, bucket: Bucket): void {
  localStorage.setItem(key(projectId), JSON.stringify(bucket))
}

function withVersion(job: ReviewJob): ReviewJob {
  return {
    ...job,
    version: typeof job.version === 'number' ? job.version : 0,
    acceptedFindingTaskIds: job.acceptedFindingTaskIds ?? {},
  }
}

/** localStorage-backed store scoped per projectId embedded in each job. */
export class BrowserReviewJobStore implements ReviewJobStoreBag {
  put(job: ReviewJob): ReviewJob {
    const next = withVersion({
      ...job,
      version: (typeof job.version === 'number' ? job.version : 0) + 1,
      updatedAt: new Date().toISOString(),
    })
    const bucket = readBucket(job.projectId)
    bucket.jobs[next.id] = next
    writeBucket(job.projectId, bucket)
    return next
  }

  putCas(job: ReviewJob, expectedVersion: number): ReviewJob {
    const bucket = readBucket(job.projectId)
    const existing = bucket.jobs[job.id]
    const current = existing?.version ?? 0
    if (current !== expectedVersion) {
      throw new ReviewJobConflictError(
        `ReviewJob CAS conflict: expected v${expectedVersion}, have v${current}`,
      )
    }
    const next = withVersion({
      ...job,
      version: expectedVersion + 1,
      updatedAt: new Date().toISOString(),
    })
    bucket.jobs[next.id] = next
    writeBucket(job.projectId, bucket)
    return next
  }

  get(id: string): ReviewJob | undefined {
    // localStorage is project-scoped; use getFromProject(projectId, id) instead.
    void id
    return undefined
  }

  getFromProject(projectId: string, id: string): ReviewJob | undefined {
    return readBucket(projectId).jobs[id]
  }

  listByProject(projectId: string): ReviewJob[] {
    return Object.values(readBucket(projectId).jobs).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )
  }
}

/** In-memory CAS store for unit/E2E without DOM localStorage. */
export class MemoryCasReviewJobStore implements ReviewJobStoreBag {
  private readonly jobs = new Map<string, ReviewJob>()

  put(job: ReviewJob): ReviewJob {
    const next = withVersion({
      ...job,
      version: (typeof job.version === 'number' ? job.version : 0) + 1,
      updatedAt: new Date().toISOString(),
    })
    this.jobs.set(next.id, next)
    return next
  }

  putCas(job: ReviewJob, expectedVersion: number): ReviewJob {
    const existing = this.jobs.get(job.id)
    const current = existing?.version ?? 0
    if (current !== expectedVersion) {
      throw new ReviewJobConflictError(
        `ReviewJob CAS conflict: expected v${expectedVersion}, have v${current}`,
      )
    }
    const next = withVersion({
      ...job,
      version: expectedVersion + 1,
      updatedAt: new Date().toISOString(),
    })
    this.jobs.set(next.id, next)
    return next
  }

  get(id: string): ReviewJob | undefined {
    return this.jobs.get(id)
  }

  listByProject(projectId: string): ReviewJob[] {
    return [...this.jobs.values()].filter((j) => j.projectId === projectId)
  }
}

export function createDefaultReviewStore(): ReviewJobStoreBag {
  if (typeof localStorage !== 'undefined') {
    return new BrowserReviewJobStore()
  }
  return new MemoryCasReviewJobStore()
}

export const REVIEW_STORE_MODE_BROWSER = 'BROWSER_LOCAL_V1' as const
export const REVIEW_STORE_MODE_MEMORY = 'MOCK_IN_MEMORY' as const
