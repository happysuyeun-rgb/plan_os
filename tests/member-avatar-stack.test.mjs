import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const stack = readFileSync(
  new URL('../src/components/project/MemberAvatarStack.tsx', import.meta.url),
  'utf8',
)
const card = readFileSync(new URL('../src/components/project/ProjectCard.tsx', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../src/pages/DashboardPage.tsx', import.meta.url), 'utf8')
const documentPage = readFileSync(new URL('../src/pages/DocumentPage.tsx', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../src/components/project/MemberPanel.tsx', import.meta.url), 'utf8')

test('avatar stack distinguishes pending and active members', () => {
  assert.match(stack, /member-avatar-pending/)
  assert.match(stack, /member-avatar-active/)
  assert.match(stack, /status === 'pending'/)
  assert.match(stack, /bg-emerald-500/)
  assert.match(stack, /bg-amber-400/)
})

test('dashboard and project cards render member avatars', () => {
  assert.match(card, /MemberAvatarStack/)
  assert.match(dashboard, /membersByProject/)
  assert.match(dashboard, /members=\{membersByProject\[project\.id\]\}/)
  assert.match(documentPage, /MemberAvatarStack/)
  assert.match(documentPage, /document-members-open/)
  assert.match(panel, /member-panel-avatar-pending/)
  assert.match(panel, /member-panel-avatar-active/)
})
