import { create } from 'zustand'
import type { NotificationSummary, UserNotification } from '../types'
import {
  fetchNotificationSummary,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/api/notifications'
import { isLocalDevAuth } from '../lib/localDevAuth'

interface NotificationState {
  items: UserNotification[]
  summary: NotificationSummary | null
  isLoading: boolean

  fetchNotifications: (opts?: { limit?: number; projectId?: string }) => Promise<void>
  fetchSummary: () => Promise<void>
  refresh: (opts?: { limit?: number }) => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: (projectId?: string) => Promise<void>
  reset: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  summary: null,
  isLoading: false,

  fetchNotifications: async (opts) => {
    set({ isLoading: true })
    const items = await fetchNotifications(opts)
    set({ items, isLoading: false })
  },

  fetchSummary: async () => {
    const summary = await fetchNotificationSummary()
    set({ summary })
  },

  refresh: async (opts) => {
    if (isLocalDevAuth()) {
      set({ items: [], summary: null, isLoading: false })
      return
    }
    try {
      const [items, summary] = await Promise.all([
        fetchNotifications(opts),
        fetchNotificationSummary(),
      ])
      set({ items, summary, isLoading: false })
    } catch {
      set({ items: [], summary: null, isLoading: false })
    }
  },

  markRead: async (id) => {
    await markNotificationRead(id)
    const { items } = get()
    const now = new Date().toISOString()
    const next = items.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? now } : n))
    set({ items: next })
    await get().fetchSummary()
  },

  markAllRead: async (projectId) => {
    await markAllNotificationsRead(projectId)
    const now = new Date().toISOString()
    set((s) => ({
      items: s.items.map((n) => {
        if (n.read_at) return n
        if (projectId && n.project_id !== projectId) return n
        return { ...n, read_at: now }
      }),
    }))
    await get().fetchSummary()
  },

  reset: () => set({ items: [], summary: null, isLoading: false }),
}))
