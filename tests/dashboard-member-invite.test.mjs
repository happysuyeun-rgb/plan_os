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
  assert.match(inviteModal, /data-testid="invite-email-disclaimer"/)
  assert.match(inviteModal, /무과금/)
  assert.doesNotMatch(inviteModal, /실제 메일 발송은 mock/)
})

test('invite link builder and no-billing delivery modes exist', () => {
  assert.match(inviteLink, /export function buildProjectInviteLink/)
  assert.match(inviteLink, /searchParams\.set\('invite', '1'\)/)
  assert.match(membersApi, /isLocalDevAuth\(\)/)
  assert.match(membersApi, /localInviteMember/)
  assert.match(membersApi, /VITE_INVITE_EMAIL_MODE/)
  assert.match(membersApi, /signInWithOtp/)
  assert.match(membersApi, /formatInviteDeliveryToast/)
  assert.match(membersApi, /pending_no_email/)
  assert.doesNotMatch(membersApi, /from ['"]resend['"]|@sendgrid|postmark/i)
  assert.match(localDev, /export function localInviteMember/)
  assert.match(dashboard, /formatInviteDeliveryToast/)
  assert.doesNotMatch(dashboard, /초대를 보냈습니다 \(mock\)/)
})
