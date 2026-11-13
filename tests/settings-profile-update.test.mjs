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

test('SettingsPage uses inline avatar/name editors, not form list fields', () => {
  assert.match(settingsPage, /설정 · 마이프로필/)
  assert.match(settingsPage, /data-testid="settings-name-display"/)
  assert.match(settingsPage, /data-testid="settings-name-pencil"/)
  assert.match(settingsPage, /onDoubleClick=\{enterNameEdit\}/)
  assert.match(settingsPage, /data-testid="settings-name-input"/)
  assert.match(settingsPage, /data-testid="settings-avatar-file-input"/)
  assert.match(settingsPage, /data-testid="settings-avatar-pick"/)
  assert.match(settingsPage, /aria-label="프로필 이미지 선택"/)
  assert.match(settingsPage, /<Camera /)
  assert.match(settingsPage, /<Pencil/)
  assert.match(settingsPage, /data-testid="settings-profile-save"/)
  assert.match(settingsPage, /flex flex-col items-center gap-3/)
  assert.match(settingsPage, /className="w-72"/)
  assert.match(settingsPage, /data-testid="settings-sign-out"/)
  assert.match(
    settingsPage,
    /settings-profile-save[\s\S]*?settings-sign-out/,
  )
  assert.match(settingsPage, /data-testid="settings-delete-account"/)
  assert.match(settingsPage, /text-gray-800/)
  assert.doesNotMatch(settingsPage, /<Input[\s\S]*label="표시 이름"/)
  assert.doesNotMatch(settingsPage, /이미지 첨부/)
  assert.doesNotMatch(settingsPage, /settings-avatar-url-input/)
  assert.match(settingsPage, /avatarFile,\s*clearAvatar/)
})

test('avatars storage migration scopes write to own folder', () => {
  assert.match(migration, /bucket_id = 'avatars'/)
  assert.match(migration, /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/)
  assert.match(migration, /file_size_limit,\s*allowed_mime_types/)
})

test('GlobalNavBar profile menu has settings and logout, no top trash nav', () => {
  assert.match(nav, /aria-label="프로필 메뉴"/)
  assert.match(nav, /data-testid="nav-profile-menu"/)
  assert.match(nav, /data-testid="nav-profile-menu-settings"/)
  assert.match(nav, /data-testid="nav-profile-menu-logout"/)
  assert.match(nav, /navigate\('\/settings'\)/)
  assert.match(nav, /signOut/)
  assert.doesNotMatch(nav, /to: '\/projects\/trash'/)
  assert.doesNotMatch(nav, /label: '휴지통'/)
})

test('Settings sidebar has profile and trash; subscription lives in profile', () => {
  assert.match(settingsPage, /data-testid="settings-side-nav"/)
  assert.match(settingsPage, /data-testid="settings-trash-link"/)
  assert.match(settingsPage, /to="\/projects\/trash"/)
  assert.match(settingsPage, /UserRound/)
  assert.match(settingsPage, /Trash2/)
  assert.match(settingsPage, /data-testid="settings-notification-section"/)
  assert.match(settingsPage, /data-testid="settings-notif-comments"/)
  assert.match(settingsPage, /data-testid="settings-notif-chat"/)
  assert.match(settingsPage, /data-testid="settings-subscription-section"/)
  assert.match(settingsPage, />\s*구독\s*</)
  assert.match(settingsPage, /\{user\.plan\} 구독/)
  assert.doesNotMatch(settingsPage, /key: 'plan'/)
  assert.doesNotMatch(settingsPage, /label: '플랜'/)
  const notifIdx = settingsPage.indexOf('settings-notification-section')
  const subIdx = settingsPage.indexOf('settings-subscription-section')
  assert.ok(notifIdx > 0 && subIdx > notifIdx)
})
