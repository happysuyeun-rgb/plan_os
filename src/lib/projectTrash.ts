import type { Project, TrashedProject } from '../types'

export const TRASH_RETENTION_DAYS = 30

const TRASH_LIMITS = { free: 10, pro: 50, team: 100 } as const

export function daysUntilPurge(deletedAt: string): number {
  const deleted = new Date(deletedAt).getTime()
  const purgeAt = deleted + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000
  return Math.max(0, Math.ceil((purgeAt - Date.now()) / (24 * 60 * 60 * 1000)))
}

export function toTrashedProject(project: Project): TrashedProject {
  if (!project.deleted_at) {
    throw new Error('휴지통에 없는 프로젝트입니다')
  }
  return {
    ...project,
    deleted_at: project.deleted_at,
    days_until_purge: daysUntilPurge(project.deleted_at),
  }
}

export function getTrashLimit(plan: 'free' | 'pro' | 'team'): number {
  return TRASH_LIMITS[plan]
}

export function isProjectTrashed(project: Project | null): boolean {
  return !!project?.deleted_at
}
