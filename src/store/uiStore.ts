import { create } from 'zustand'
import type { Toast, ToastType } from '../types'

interface UIState {
  toasts: Toast[]
  showToast: (type: ToastType, message: string, options?: { animation?: 'completion' }) => void
  removeToast: (id: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],

  showToast: (type, message, options) => {
    const id = crypto.randomUUID()
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, animation: options?.animation }],
    }))
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))
