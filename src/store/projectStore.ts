import { create } from 'zustand'
import type { Project, TrashedProject } from '../types'
import {
  createProject as apiCreateProject,
  fetchProject as apiFetchProject,
  fetchProjects as apiFetchProjects,
  fetchTrashedProjects as apiFetchTrashedProjects,
  purgeProject as apiPurgeProject,
  restoreProject as apiRestoreProject,
  trashProject as apiTrashProject,
  updateProject as apiUpdateProject,
} from '../lib/api/projects'
import { logProjectActivity } from '../lib/api/activities'
import { assertCanCreateProjectAgainstEnv, isLocalDevAuth } from '../lib/localDevAuth'
import { useAuthStore } from './authStore'
import { usePlanStore } from './planStore'

interface ProjectState {
  projects: Project[]
  trashedProjects: TrashedProject[]
  currentProject: Project | null
  searchQuery: string
  serviceTypeFilter: string
  isLoading: boolean
  isTrashLoading: boolean

  fetchProjects: () => Promise<void>
  fetchTrashedProjects: () => Promise<void>
  createProject: (data: Omit<Parameters<typeof apiCreateProject>[0], 'user_id'>) => Promise<Project>
  updateProject: (id: string, data: Partial<Project>) => Promise<void>
  trashProject: (id: string) => Promise<void>
  restoreProject: (id: string) => Promise<void>
  purgeProject: (id: string) => Promise<void>
  setCurrentProject: (id: string) => Promise<void>
  setSearchQuery: (query: string) => void
  setServiceTypeFilter: (filter: string) => void
  getFilteredProjects: () => Project[]
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  trashedProjects: [],
  currentProject: null,
  searchQuery: '',
  serviceTypeFilter: '전체',
  isLoading: false,
  isTrashLoading: false,

  fetchProjects: async () => {
    set({ isLoading: true })
    const userId = useAuthStore.getState().user?.id
    if (!userId || isLocalDevAuth()) {
      set({ projects: [], isLoading: false })
      return
    }
    try {
      const projects = await apiFetchProjects(userId)
      set({ projects, isLoading: false })
    } catch {
      set({ projects: [], isLoading: false })
    }
  },

  fetchTrashedProjects: async () => {
    set({ isTrashLoading: true })
    const userId = useAuthStore.getState().user?.id
    if (!userId || isLocalDevAuth()) {
      set({ trashedProjects: [], isTrashLoading: false })
      return
    }
    try {
      const trashedProjects = await apiFetchTrashedProjects(userId)
      set({ trashedProjects, isTrashLoading: false })
    } catch {
      set({ trashedProjects: [], isTrashLoading: false })
    }
  },

  createProject: async (data) => {
    const userId = useAuthStore.getState().user?.id
    if (!userId) throw new Error('로그인이 필요합니다')
    // Fail fast on placeholder URL — avoids hung local E2E against fake host.
    assertCanCreateProjectAgainstEnv()
    const project = await apiCreateProject({ ...data, user_id: userId })
    set((s) => ({ projects: [project, ...s.projects] }))
    return project
  },

  updateProject: async (id, data) => {
    const updated = await apiUpdateProject(id, data)
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? updated : p)),
      trashedProjects: s.trashedProjects.map((p) => (p.id === id ? { ...updated, days_until_purge: p.days_until_purge } as TrashedProject : p)),
      currentProject: s.currentProject?.id === id ? updated : s.currentProject,
    }))
  },

  trashProject: async (id) => {
    const userId = useAuthStore.getState().user?.id
    if (!userId) throw new Error('로그인이 필요합니다')

    const { trashedProjects } = get()
    if (!usePlanStore.getState().canMoveToTrash(trashedProjects.length)) {
      throw new Error('휴지통이 가득 찼습니다. 항목을 비운 후 다시 시도하세요.')
    }

    const project = get().projects.find((p) => p.id === id)
    const trashed = await apiTrashProject(id, userId)
    await logProjectActivity({
      project_id: id,
      action: 'project_trash',
      meta: { title: project?.title ?? trashed.title },
    })
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      currentProject: s.currentProject?.id === id ? null : s.currentProject,
    }))
    await get().fetchTrashedProjects()
  },

  restoreProject: async (id) => {
    const userId = useAuthStore.getState().user?.id
    if (!userId) throw new Error('로그인이 필요합니다')
    const trashed = get().trashedProjects.find((p) => p.id === id)
    const restored = await apiRestoreProject(id, userId)
    await logProjectActivity({
      project_id: id,
      action: 'project_restore',
      meta: { title: trashed?.title ?? restored.title },
    })
    set((s) => ({
      trashedProjects: s.trashedProjects.filter((p) => p.id !== id),
      projects: [restored, ...s.projects],
    }))
  },

  purgeProject: async (id) => {
    const trashed = get().trashedProjects.find((p) => p.id === id)
    await apiPurgeProject(id)
    await logProjectActivity({
      project_id: id,
      action: 'project_purge',
      meta: { title: trashed?.title ?? id },
    })
    set((s) => ({
      trashedProjects: s.trashedProjects.filter((p) => p.id !== id),
      currentProject: s.currentProject?.id === id ? null : s.currentProject,
    }))
  },

  setCurrentProject: async (id) => {
    // Isolated browser E2E only: never enabled in a production build.
    if (import.meta.env.DEV && import.meta.env.VITE_S3_E2E_FIXTURE === 'true') {
      const viewer = id === 'fixture-viewer'
      const project = id.startsWith('fixture-') && id !== 'fixture-missing' ? {
        id, user_id: viewer ? 'some-other-owner' : 'local-dev-user',
        title: 'S3 E2E fixture', description: '', service_type: 'mock', target_user: '',
        memory_summary: '', chat_title: '', interview_answers: {},
        deleted_at: id === 'fixture-deleted' ? new Date(0).toISOString() : null,
        deleted_by: null, created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString(),
      } : null
      set({ currentProject: project })
      return
    }
    const project = await apiFetchProject(id)
    set({ currentProject: project })
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setServiceTypeFilter: (filter) => set({ serviceTypeFilter: filter }),

  getFilteredProjects: () => {
    const { projects, searchQuery, serviceTypeFilter } = get()
    return projects.filter((p) => {
      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = serviceTypeFilter === '전체' || p.service_type === serviceTypeFilter
      return matchesSearch && matchesType
    })
  },
}))
