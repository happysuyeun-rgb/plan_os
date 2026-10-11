import type { User } from '../types'

const STORAGE_KEY = 'planos-local-dev-user'

/** 실제 Supabase 프로젝트가 없을 때 쓰는 로컬 개발 로그인 */
export function isLocalDevAuth(): boolean {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  return !url || url.includes('placeholder.supabase.co')
}

export function readLocalDevUser(): User | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function writeLocalDevUser(user: User): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

export function clearLocalDevUser(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function createLocalDevUser(email: string): User {
  return {
    id: 'local-dev-user',
    email,
    name: '서아',
    avatar_url: '',
    plan: 'pro',
    ai_generations_this_month: 0,
    onboarding_completed: true,
    created_at: new Date().toISOString(),
  }
}
