import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/pages/ProjectTasksPage.tsx', import.meta.url), 'utf8')

test('soft delete/restore is gated by owner-only canSoftDelete, not canEdit alone', () => {
  assert.match(page, /const canSoftDelete = isOwner/)
  assert.match(page, /ONLY_OWNER_MAY_DELETE_TASK/)
  assert.match(page, /if \(!canSoftDelete \|\| saving\) return/)
  assert.match(page, /data-testid="task-soft-delete"/)
  assert.match(page, /data-testid="task-restore"/)
  assert.match(page, /업무 삭제·복원은 프로젝트 소유자만/)
})

test('editors retain canEdit for create/update without soft-delete buttons on canEdit alone', () => {
  assert.match(page, /canEdit && editingId !== task\.id/)
  assert.doesNotMatch(
    page,
    /canEdit && <div className="mt-3 flex gap-2">[\s\S]*task-soft-delete/,
  )
})
