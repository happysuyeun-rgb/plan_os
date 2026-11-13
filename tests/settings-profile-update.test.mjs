import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const authApi = readFileSync(new URL('../src/lib/api/auth.ts', import.meta.url), 'utf8')
const authStore = readFileSync(new URL('../src/store/authStore.ts', import.meta.url), 'utf8')
const settingsPage = readFileSync(new URL('../src/pages/SettingsPage.tsx', import.meta.url), 'utf8')
const nav = readFileSync(new URL('../src/components/layout/GlobalNavBar.tsx', import.meta.url), 'utf8')
const migration = readFileSync(
  new URL('../supabase/migrations/033_avatars_storage.sql', import.meta.url),
  'utf8',
)

test('avatar upload validates image mime/size and updates profile URL', () => {
  assert.match(authApi, /export function validateAvatarFile/)
  assert.match(authApi, /AVATAR_MAX_BYTES = 2 \* 1024 \* 1024/)
  assert.match(authApi, /JPEG, PNG, WebP, GIF만 첨부할 수 있습니다/)
  assert.match(authApi, /export async function uploadUserAvatar/)
  assert.match(authApi, /storage\.from\('avatars'\)\.upload/)
  assert.match(authApi, /이름은 1~50자로 입력해주세요/)
  assert.doesNotMatch(authApi, /아바타 URL은 https:\/\/ 로 시작해야 합니다/)
})

test('authStore.updateProfile accepts avatarFile and localDev data URL', () => {
  assert.match(authStore, /updateProfile: async \(input\)/)
  assert.match(authStore, /avatarFile/)
  assert.match(authStore, /clearAvatar/)
  assert.match(authStore, /uploadUserAvatar\(user\.id, input\.avatarFile\)/)
  assert.match(authStore, /readFileAsDataUrl\(input\.avatarFile\)/)
  assert.match(authStore, /writeLocalDevUser\(next\)/)
})

test('SettingsPage uses file attach instead of avatar URL input', () => {
  assert.match(settingsPage, /설정 · 마이프로필/)
  assert.match(settingsPage, /data-testid="settings-name-input"/)
  assert.match(settingsPage, /data-testid="settings-avatar-file-input"/)
  assert.match(settingsPage, /data-testid="settings-avatar-pick"/)
  assert.match(settingsPage, /data-testid="settings-profile-save"/)
  assert.match(settingsPage, /이미지 첨부/)
  assert.doesNotMatch(settingsPage, /settings-avatar-url-input/)
  assert.doesNotMatch(settingsPage, /아바타 URL/)
  assert.match(settingsPage, /avatarFile,\s*clearAvatar/)
})

test('avatars storage migration scopes write to own folder', () => {
  assert.match(migration, /bucket_id = 'avatars'/)
  assert.match(migration, /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/)
  assert.match(migration, /file_size_limit,\s*allowed_mime_types/)
})

test('GlobalNavBar avatar links to settings with my-profile label', () => {
  assert.match(nav, /aria-label="설정 · 마이프로필"/)
  assert.match(nav, /title="설정 · 마이프로필"/)
  assert.match(nav, /navigate\('\/settings'\)/)
})
