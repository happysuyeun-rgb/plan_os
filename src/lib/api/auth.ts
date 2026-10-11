import type { User } from '../../types'
import { supabase } from '../supabase'
import { throwIfError, unwrap } from '../supabaseHelpers'

export async function fetchUserProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

export async function signInWithGoogle(redirectPath?: string): Promise<void> {
  const redirectTo = `${window.location.origin}${redirectPath ?? '/dashboard'}`
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  throwIfError(error)
}

export async function signInWithDevPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  throwIfError(error)
}

export async function ensureDevLogin(email: string, password: string): Promise<void> {
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (!signInError && signInData.session) return

  if (signInError?.message === 'Email not confirmed') {
    throw new Error(
      '이메일 확인이 필요합니다. 터미널에서 npm run dev:confirm-user 를 실행하거나 Supabase Auth에서 Confirm email을 끄세요.',
    )
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: '서아', name: '서아' } },
  })

  if (signUpError) {
    if (signUpError.message.includes('rate limit')) {
      throw new Error(
        'Supabase 이메일 가입 한도를 초과했습니다. Dashboard → Authentication → Users에서 dev@example.com 계정을 직접 추가하거나, API의 service_role 키로 npm run dev:user 를 실행하세요.',
      )
    }
    if (signUpError.message.includes('already registered')) {
      const { error: retryError } = await supabase.auth.signInWithPassword({ email, password })
      throwIfError(retryError)
      return
    }
    throw signUpError
  }

  if (signUpData.session) return

  if (signUpData.user) {
    throw new Error(
      '가입은 됐지만 로그인 세션이 없습니다. Supabase Auth → Email → Confirm email을 끄거나 npm run dev:confirm-user 를 실행하세요.',
    )
  }

  const { error: retryError } = await supabase.auth.signInWithPassword({ email, password })
  throwIfError(retryError)
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return '로그인에 실패했습니다'
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  throwIfError(error)
}

export async function completeOnboarding(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ onboarding_completed: true })
    .eq('id', userId)
  throwIfError(error)
}

export async function deleteAccount(userId: string): Promise<void> {
  const { error } = await supabase.from('users').delete().eq('id', userId)
  throwIfError(error)
}

export async function incrementAiGenerations(userId: string, current: number): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update({ ai_generations_this_month: current + 1 })
    .eq('id', userId)
    .select()
    .single()
  return unwrap(data, error)
}
