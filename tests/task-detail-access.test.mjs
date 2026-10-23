import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

/**
 * Contract: Owner/Editor/Viewer may SELECT project_tasks + project_task_events;
 * outsiders get zero rows via can_access_project. Mutations stay editor+owner
 * (existing task RLS). This is the Preview permission matrix for S1 detail.
 */
test('011 task RLS grants member read on tasks and events', () => {
  const sql = readFileSync('supabase/migrations/011_project_tasks.sql', 'utf8')
  assert.match(sql, /create policy "task_members_read"/)
  assert.match(sql, /can_access_project\(project_id\)/)
  assert.match(sql, /create policy "task_events_project_read"/)
  assert.match(sql, /revoke insert, update, delete on public\.project_task_events/)
  assert.match(sql, /task_editors_create/)
  assert.match(sql, /task_editors_update/)
})

test('task detail page surfaces role and history API', () => {
  const page = readFileSync('src/pages/ProjectTaskDetailPage.tsx', 'utf8')
  const api = readFileSync('src/lib/api/projectTasks.ts', 'utf8')
  assert.match(page, /listServerTaskEvents/)
  assert.match(page, /task-detail-role/)
  assert.match(page, /canViewTasks/)
  assert.match(api, /from\('project_task_events'\)/)
})

test('Preview checklist documents Owner\/Editor\/Viewer S1 detail verification', () => {
  const guide = readFileSync('docs/plans/PREVIEW_S1_TASK_DETAIL_CHECKLIST_2026-10-23.md', 'utf8')
  assert.match(guide, /Owner/)
  assert.match(guide, /Editor/)
  assert.match(guide, /Viewer/)
  assert.match(guide, /VITE_S1_SERVER_TASKS/)
  assert.match(guide, /체크하지 않는다/)
  assert.match(guide, /미해당 \(완료 금지\)/)
})
