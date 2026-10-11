import { create } from 'zustand'
import type {
  CommentFilter,
  CommentThread,
  CommentCounts,
  RegionAnchor,
} from '../types'
import {
  fetchCommentThreads as apiFetchThreads,
  fetchCommentCounts as apiFetchCounts,
  createRootComment as apiCreateRoot,
  replyToComment as apiReply,
  setThreadResolved as apiResolve,
  setMyCompletion as apiComplete,
  toggleCommentReaction as apiToggleReaction,
} from '../lib/api/comments'
import { logProjectActivity } from '../lib/api/activities'

interface PendingSelection {
  rect_norm: { x: number; y: number; w: number; h: number }
  anchor_meta: RegionAnchor
}

interface CommentState {
  threads: CommentThread[]
  counts: CommentCounts | null
  isLoading: boolean
  filter: CommentFilter
  search: string
  isCommentMode: boolean
  showSidebar: boolean
  activeThreadId: string | null
  pendingSelection: PendingSelection | null
  replyToId: string | null

  fetchThreads: (projectId: string, documentId?: string) => Promise<void>
  fetchCounts: (projectId: string) => Promise<void>
  setFilter: (filter: CommentFilter) => void
  setSearch: (search: string) => void
  setCommentMode: (on: boolean) => void
  setShowSidebar: (show: boolean) => void
  setActiveThreadId: (id: string | null) => void
  setPendingSelection: (sel: PendingSelection | null) => void
  setReplyToId: (id: string | null) => void
  createRootComment: (
    projectId: string,
    documentId: string,
    body: string,
    anchor: RegionAnchor,
  ) => Promise<void>
  replyToComment: (parentId: string, body: string, threadRootId: string) => Promise<void>
  resolveThread: (threadRootId: string, resolved: boolean) => Promise<void>
  setMyCompletion: (threadRootId: string, completed: boolean) => Promise<void>
  toggleReaction: (commentId: string, emoji: string, threadRootId: string) => Promise<void>
  reset: () => void
}

export const useCommentStore = create<CommentState>((set, get) => ({
  threads: [],
  counts: null,
  isLoading: false,
  filter: 'all',
  search: '',
  isCommentMode: false,
  showSidebar: true,
  activeThreadId: null,
  pendingSelection: null,
  replyToId: null,

  fetchThreads: async (projectId, documentId) => {
    set({ isLoading: true })
    const { filter, search } = get()
    const threads = await apiFetchThreads(projectId, documentId, filter, search)
    set({ threads, isLoading: false })
  },

  fetchCounts: async (projectId) => {
    const counts = await apiFetchCounts(projectId)
    set({ counts })
  },

  setFilter: (filter) => set({ filter }),
  setSearch: (search) => set({ search }),
  setCommentMode: (on) => set({ isCommentMode: on, pendingSelection: on ? get().pendingSelection : null }),
  setShowSidebar: (show) => set({ showSidebar: show }),
  setActiveThreadId: (id) => set({ activeThreadId: id }),
  setPendingSelection: (sel) => set({ pendingSelection: sel }),
  setReplyToId: (id) => set({ replyToId: id }),

  createRootComment: async (projectId, documentId, body, anchor) => {
    const comment = await apiCreateRoot({
      project_id: projectId,
      document_id: documentId,
      body,
      anchor_meta: anchor,
    })
    await logProjectActivity({
      project_id: projectId,
      document_id: documentId,
      action: 'comment_create',
      meta: { comment_id: comment.id, pin_index: anchor.pin_index },
    })
    set({ pendingSelection: null, activeThreadId: comment.id })
    await get().fetchThreads(projectId, documentId)
    await get().fetchCounts(projectId)
  },

  replyToComment: async (parentId, body, threadRootId) => {
    const comment = await apiReply(parentId, body)
    const projectId = comment.project_id
    await logProjectActivity({
      project_id: projectId,
      document_id: comment.document_id ?? undefined,
      action: 'comment_reply',
      meta: { parent_id: parentId, comment_id: comment.id, thread_root_id: threadRootId },
    })
    set({ replyToId: null })
    await get().fetchThreads(projectId, comment.document_id ?? undefined)
  },

  resolveThread: async (threadRootId, resolved) => {
    await apiResolve(threadRootId, resolved)
    const root = get().threads.find((t) => t.root.id === threadRootId)
    if (root) {
      await logProjectActivity({
        project_id: root.root.project_id,
        document_id: root.root.document_id ?? undefined,
        action: resolved ? 'comment_resolve' : 'comment_reopen',
        meta: { thread_root_id: threadRootId },
      })
      await get().fetchThreads(root.root.project_id, root.root.document_id ?? undefined)
      await get().fetchCounts(root.root.project_id)
    }
  },

  setMyCompletion: async (threadRootId, completed) => {
    await apiComplete(threadRootId, completed)
    const root = get().threads.find((t) => t.root.id === threadRootId)
    if (root) {
      await logProjectActivity({
        project_id: root.root.project_id,
        document_id: root.root.document_id ?? undefined,
        action: 'comment_complete',
        meta: { thread_root_id: threadRootId, completed },
      })
      await get().fetchThreads(root.root.project_id, root.root.document_id ?? undefined)
    }
  },

  toggleReaction: async (commentId, emoji, threadRootId) => {
    await apiToggleReaction(commentId, emoji)
    const root = get().threads.find((t) => t.root.id === threadRootId)
    if (root) {
      await logProjectActivity({
        project_id: root.root.project_id,
        document_id: root.root.document_id ?? undefined,
        action: 'comment_reaction',
        meta: { comment_id: commentId, emoji, thread_root_id: threadRootId },
      })
      await get().fetchThreads(root.root.project_id, root.root.document_id ?? undefined)
    }
  },

  reset: () =>
    set({
      threads: [],
      counts: null,
      isLoading: false,
      filter: 'all',
      search: '',
      isCommentMode: false,
      showSidebar: true,
      activeThreadId: null,
      pendingSelection: null,
      replyToId: null,
    }),
}))
