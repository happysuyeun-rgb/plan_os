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

export type UserProfileUpdate = {
  name: string
  avatar_url: string
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const AVATAR_ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export function normalizeUserProfileUpdate(input: UserProfileUpdate): UserProfileUpdate {
  return {
    name: input.name.trim(),
    avatar_url: input.avatar_url.trim(),
  }
}

export function isDisplayableAvatarUrl(url: string): boolean {
  return (
    url.startsWith('https://') ||
    url.startsWith('http://') ||
    url.startsWith('data:image/')
  )
}

/** name: 1~50자, avatar_url: 빈 문자열 · http(s) · data:image/ (파일 업로드 결과) */
export function validateUserProfileUpdate(input: UserProfileUpdate): string | null {
  const { name, avatar_url } = normalizeUserProfileUpdate(input)
  if (name.length < 1 || name.length > 50) {
    return '이름은 1~50자로 입력해주세요'
  }
  if (avatar_url !== '' && !isDisplayableAvatarUrl(avatar_url)) {
    return '아바타 이미지가 올바르지 않습니다'
  }
  return null
}

export function validateAvatarFile(file: File): string | null {
  if (!(AVATAR_ALLOWED_MIME as readonly string[]).includes(file.type)) {
    return 'JPEG, PNG, WebP, GIF만 첨부할 수 있습니다'
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return '이미지는 2MB 이하여야 합니다'
  }
  return null
}

function avatarExtension(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    default:
      return 'jpg'
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('이미지 읽기에 실패했습니다'))
    reader.readAsDataURL(file)
  })
}

/** Supabase Storage `avatars/{userId}/avatar.*` 업로드 후 public URL 반환 */
export async function uploadUserAvatar(userId: string, file: File): Promise<string> {
  const fileError = validateAvatarFile(file)
  if (fileError) throw new Error(fileError)

  const ext = avatarExtension(file.type)
  const path = `${userId}/avatar.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: '3600',
  })
  throwIfError(error)

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}

export async function updateUserProfile(
  userId: string,
  input: UserProfileUpdate,
): Promise<User> {
  const normalized = normalizeUserProfileUpdate(input)
  const validationError = validateUserProfileUpdate(normalized)
  if (validationError) {
    throw new Error(validationError)
  }

  const { data, error } = await supabase
    .from('users')
    .update({ name: normalized.name, avatar_url: normalized.avatar_url })
    .eq('id', userId)
    .select()
    .single()
  return unwrap(data, error)
}
