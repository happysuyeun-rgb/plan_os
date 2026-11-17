import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const sql = 'supabase/local_only/036_task_assignee_kind.sql'
const draft = 'supabase/drafts/036_task_assignee_kind_DRAFT.sql'

describe('Slice 3 F-105 server assignee contract', () => {
  it('ships 036 in local_only only', () => {
    assert.equal(existsSync(sql), true)
    assert.equal(existsSync(draft), true)
    assert.equal(existsSync('supabase/migrations/036_task_assignee_kind.sql'), false)
    const body = readFileSync(sql, 'utf8')
    assert.match(body, /assignee_kind/)
    assert.match(body, /agent_role_id/)
    assert.match(body, /requirements_auditor_v1/)
    assert.match(body, /FORBIDDEN/)
  })

  it('API maps optional assignee_kind and detects missing-column errors', () => {
    const api = readFileSync('src/lib/api/projectTasks.ts', 'utf8')
    assert.match(api, /assignee_kind/)
    assert.match(api, /agent_role_id/)
    assert.match(api, /isMissingAssigneeKindColumnError/)
    assert.match(api, /assigneeKind\?:/)
  })

  it('flag gates server dual-write and keeps LS fallback helpers', () => {
    const lib = readFileSync('src/lib/taskAiAssigneeMock.ts', 'utf8')
    assert.match(lib, /VITE_F105_SERVER_ASSIGNEE/)
    assert.match(lib, /isF105ServerAssigneeEnabled/)
    assert.match(lib, /resolveTaskAiAssignee/)
    assert.match(lib, /writeTaskAiAssignee/)
  })
})
