import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const authApi = readFileSync(new URL('../src/lib/api/auth.ts', import.meta.url), 'utf8')
const authStore = readFileSync(new URL('../src/store/authStore.ts', import.meta.url), 'utf8')
const settingsPage = readFileSync(new URL('../src/pages/SettingsPage.tsx', import.meta.url), 'utf8')
const nav = readFileSync(new URL('../src/components/layout/GlobalNavBar.tsx', import.meta.url), 'utf8')

test('updateUserProfile validates name 1~50 and https avatar_url', () => {
  assert.match(authApi, /export function validateUserProfileUpdate/)
  assert.match(authApi, /이름은 1~50자로 입력해주세요/)
  assert.match(authApi, /avatar_url !== '' && !avatar_url\.startsWith\('https:\/\/'\)/)
  assert.match(authApi, /export async function updateUserProfile/)
  assert.match(authApi, /\.update\(\{ name: normalized\.name, avatar_url: normalized\.avatar_url \}\)/)
})

test('authStore.updateProfile wires Supabase and localDev', () => {
  assert.match(authStore, /updateProfile: async \(input\)/)
  assert.match(authStore, /writeLocalDevUser\(next\)/)
  assert.match(authStore, /apiUpdateUserProfile\(user\.id, input\)/)
  assert.match(authStore, /normalizeUserProfileUpdate/)
  assert.match(authStore, /validateUserProfileUpdate/)
})

test('SettingsPage exposes editable name/avatar fields and save CTA', () => {
  assert.match(settingsPage, /설정 · 마이프로필/)
  assert.match(settingsPage, /data-testid="settings-name-input"/)
  assert.match(settingsPage, /data-testid="settings-avatar-url-input"/)
  assert.match(settingsPage, /data-testid="settings-profile-save"/)
  assert.match(settingsPage, /updateProfile\(\{ name: trimmedName, avatar_url: trimmedAvatar \}\)/)
  assert.match(settingsPage, /프로필이 저장되었습니다/)
})

test('GlobalNavBar avatar links to settings with my-profile label', () => {
  assert.match(nav, /aria-label="설정 · 마이프로필"/)
  assert.match(nav, /title="설정 · 마이프로필"/)
  assert.match(nav, /navigate\('\/settings'\)/)
})
