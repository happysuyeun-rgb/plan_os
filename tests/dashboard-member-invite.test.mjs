import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboard = readFileSync(new URL('../src/pages/DashboardPage.tsx', import.meta.url), 'utf8')
const inviteModal = readFileSync(
  new URL('../src/components/project/InviteMemberModal.tsx', import.meta.url),
  'utf8',
)
const inviteLink = readFileSync(new URL('../src/lib/inviteLink.ts', import.meta.url), 'utf8')
const membersApi = readFileSync(new URL('../src/lib/api/members.ts', import.meta.url), 'utf8')
const localDev = readFileSync(new URL('../src/lib/localDevData.ts', import.meta.url), 'utf8')

test('dashboard exposes member invite entry', () => {
  assert.match(dashboard, /data-testid="dashboard-invite-open"/)
  assert.match(dashboard, /멤버 초대/)
  assert.match(dashboard, /InviteMemberModal/)
  assert.match(dashboard, /handleDashboardInvite/)
})

test('invite modal supports email and link tabs', () => {
  assert.match(inviteModal, /invite-tab-\$\{id\}/)
  assert.match(inviteModal, /data-testid="invite-link-copy"/)
  assert.match(inviteModal, /buildProjectInviteLink/)
  assert.match(inviteModal, /projects\?:/)
})

test('invite link builder and localDev member invite exist', () => {
  assert.match(inviteLink, /export function buildProjectInviteLink/)
  assert.match(inviteLink, /searchParams\.set\('invite', '1'\)/)
  assert.match(membersApi, /isLocalDevAuth\(\)/)
  assert.match(membersApi, /localInviteMember/)
  assert.match(localDev, /export function localInviteMember/)
})
