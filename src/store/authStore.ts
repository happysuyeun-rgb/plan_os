import { create } from 'zustand'
import type { User } from '../types'
import {
  completeOnboarding as apiCompleteOnboarding,
  ensureDevLogin,
  fetchUserProfile,
  signInWithGoogle as apiSignInWithGoogle,
  signOut as apiSignOut,
  incrementAiGenerations,
} from '../lib/api/auth'
import {
  clearLocalDevUser,
  createLocalDevUser,
  isLocalDevAuth,
  readLocalDevUser,
  writeLocalDevUser,
} from '../lib/localDevAuth'
import { cacheOnboardingDone, clearOnboardingCache, isOnboardingCached } from '../lib/onboardingStorage'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isInitialized: boolean
  isOnboardingCompleted: boolean

  initialize: () => Promise<void>
  signInWithGoogle: (redirectPath?: string) => Promise<void>
  signInWithDevPassword: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  completeOnboarding: () => Promise<void>
  incrementAiGeneration: () => Promise<void>
}

function applyUser(user: User | null, isAuthenticated: boolean) {
  if (!user) {
    return {
      user: null,
      isAuthenticated: false,
      isOnboardingCompleted: false,
    }
  }

  const onboardingCompleted = user.onboarding_completed || isOnboardingCached(user.id)

  return {
    user: onboardingCompleted ? { ...user, onboarding_completed: true } : user,
    isAuthenticated,
    isOnboardingCompleted: onboardingCompleted,
  }
}

async function loadUserFromSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return applyUser(null, false)
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const profile = await fetchUserProfile(session.user.id)
    if (profile) {
      return applyUser(profile, true)
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  throw new Error('사용자 프로필을 불러오지 못했습니다. npm run dev:confirm-user 를 실행해주세요.')
}

let authUnsubscribe: (() => void) | null = null

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  isOnboardingCompleted: false,

  initialize: async () => {
    if (get().isInitialized) return

    if (isLocalDevAuth()) {
      const user = readLocalDevUser()
      set({ ...applyUser(user, Boolean(user)), isLoading: false, isInitialized: true })
      return
    }

    set({ isLoading: true })
    try {
      const state = await loadUserFromSession()
      set({ ...state, isLoading: false, isInitialized: true })
    } catch {
      set({ isLoading: false, isInitialized: true })
    }

    if (!authUnsubscribe) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async () => {
        if (!get().isInitialized) return
        try {
          const state = await loadUserFromSession()
          set(state)
        } catch {
          set(applyUser(null, false))
        }
      })
      authUnsubscribe = () => subscription.unsubscribe()
    }
  },

  signInWithGoogle: async (redirectPath) => {
    await apiSignInWithGoogle(redirectPath)
  },

  signInWithDevPassword: async (email, password) => {
    set({ isLoading: true })
    try {
      if (isLocalDevAuth()) {
        const user = createLocalDevUser(email)
        writeLocalDevUser(user)
        set({ ...applyUser(user, true), isLoading: false, isInitialized: true })
        return
      }

      await ensureDevLogin(email, password)
      const state = await loadUserFromSession()
      set({ ...state, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  signOut: async () => {
    if (isLocalDevAuth()) {
      clearLocalDevUser()
      clearOnboardingCache()
      set(applyUser(null, false))
      return
    }

    await apiSignOut()
    clearOnboardingCache()
    set(applyUser(null, false))
  },

  completeOnboarding: async () => {
    const { user } = get()
    if (!user) return

    if (isLocalDevAuth()) {
      const next = { ...user, onboarding_completed: true }
      writeLocalDevUser(next)
      cacheOnboardingDone(user.id)
      set({ user: next, isOnboardingCompleted: true })
      return
    }

    await apiCompleteOnboarding(user.id)
    cacheOnboardingDone(user.id)
    set({
      user: { ...user, onboarding_completed: true },
      isOnboardingCompleted: true,
    })
  },

  incrementAiGeneration: async () => {
    const { user } = get()
    if (!user) return

    if (isLocalDevAuth()) {
      const next = {
        ...user,
        ai_generations_this_month: user.ai_generations_this_month + 1,
      }
      writeLocalDevUser(next)
      set({ user: next })
      return
    }

    const updated = await incrementAiGenerations(user.id, user.ai_generations_this_month)
    set({ user: updated })
  },
}))
