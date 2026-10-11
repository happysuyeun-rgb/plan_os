import { create } from 'zustand'
import type { ProjectActivity } from '../types'
import {
  fetchProjectActivities,
  logProjectActivity,
  type LogActivityInput,
} from '../lib/api/activities'

interface ActivityState {
  activities: ProjectActivity[]
  isLoading: boolean

  fetchActivities: (projectId: string, documentId?: string) => Promise<void>
  logActivity: (input: LogActivityInput) => Promise<void>
  reset: () => void
}

export const useActivityStore = create<ActivityState>((set) => ({
  activities: [],
  isLoading: false,

  fetchActivities: async (projectId, documentId) => {
    set({ isLoading: true })
    const activities = await fetchProjectActivities(projectId, documentId)
    set({ activities, isLoading: false })
  },

  logActivity: async (input) => {
    const activity = await logProjectActivity(input)
    set((s) => ({ activities: [activity, ...s.activities] }))
  },

  reset: () => set({ activities: [], isLoading: false }),
}))
