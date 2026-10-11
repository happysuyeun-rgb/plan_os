import { create } from 'zustand'
import type { PlanType } from '../types'
import { getTrashLimit } from '../lib/projectTrash'
import { useAuthStore } from './authStore'

const PLAN_LIMITS = {
  free: { projects: 3, generations: 10, versions: 10, members: 3 },
  pro: { projects: Infinity, generations: Infinity, versions: 50, members: 10 },
  team: { projects: Infinity, generations: Infinity, versions: Infinity, members: Infinity },
} as const

interface PlanState {
  canCreateProject: (currentCount: number) => boolean
  canMoveToTrash: (trashedCount: number) => boolean
  canGenerate: () => boolean
  canSaveVersion: (currentCount: number) => boolean
  canInviteMember: (currentCount: number) => boolean
  getMemberLimit: () => number | 'unlimited'
  getRemainingGenerations: () => number | 'unlimited'
  getPlan: () => PlanType
}

function getUser() {
  return useAuthStore.getState().user
}

export const usePlanStore = create<PlanState>(() => ({
  getPlan: () => getUser()?.plan ?? 'free',

  canCreateProject: (currentCount) => {
    const plan = getUser()?.plan ?? 'free'
    return currentCount < PLAN_LIMITS[plan].projects
  },

  canMoveToTrash: (trashedCount) => {
    const plan = getUser()?.plan ?? 'free'
    return trashedCount < getTrashLimit(plan)
  },

  canGenerate: () => {
    const user = getUser()
    if (!user) return false
    const limit = PLAN_LIMITS[user.plan].generations
    if (limit === Infinity) return true
    return user.ai_generations_this_month < limit
  },

  canSaveVersion: (currentCount) => {
    const plan = getUser()?.plan ?? 'free'
    return currentCount < PLAN_LIMITS[plan].versions
  },

  canInviteMember: (currentCount) => {
    const plan = getUser()?.plan ?? 'free'
    const limit = PLAN_LIMITS[plan].members
    if (limit === Infinity) return true
    return currentCount < limit
  },

  getMemberLimit: () => {
    const plan = getUser()?.plan ?? 'free'
    return PLAN_LIMITS[plan].members
  },

  getRemainingGenerations: () => {
    const user = getUser()
    if (!user) return 0
    const limit = PLAN_LIMITS[user.plan].generations
    if (limit === Infinity) return 'unlimited'
    return Math.max(0, limit - user.ai_generations_this_month)
  },
}))
