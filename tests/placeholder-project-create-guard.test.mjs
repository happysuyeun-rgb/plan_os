import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const auth = readFileSync(new URL('../src/lib/localDevAuth.ts', import.meta.url), 'utf8')
const store = readFileSync(new URL('../src/store/projectStore.ts', import.meta.url), 'utf8')
const page = readFileSync(new URL('../src/pages/ProjectCreatePage.tsx', import.meta.url), 'utf8')

test('localDevAuth defines placeholder project-create guard', () => {
  assert.match(auth, /placeholder\.supabase\.co/)
  assert.match(auth, /PLACEHOLDER_SUPABASE_BLOCKED/)
  assert.match(auth, /export function assertCanCreateProjectAgainstEnv/)
  assert.match(auth, /isLocalDevAuth\(\)/)
})

test('projectStore createProject calls guard before API insert', () => {
  const start = store.indexOf('createProject: async (data) =>')
  const end = store.indexOf('updateProject: async (id, data) =>')
  assert.ok(start > 0 && end > start, 'implementation createProject block')
  const createFn = store.slice(start, end)
  assert.match(createFn, /assertCanCreateProjectAgainstEnv\(\)/)
  assert.ok(
    createFn.indexOf('assertCanCreateProjectAgainstEnv') < createFn.indexOf('apiCreateProject'),
    'guard must run before apiCreateProject',
  )
})

test('ProjectCreatePage fails fast on placeholder before createProject', () => {
  assert.match(page, /assertCanCreateProjectAgainstEnv/)
  assert.match(page, /PLACEHOLDER_PROJECT_CREATE_BLOCKED/)
  const start = page.indexOf('const runGeneration = async')
  const end = page.indexOf('const result = await startPipeline')
  assert.ok(start > 0 && end > start)
  const runGen = page.slice(start, end)
  assert.ok(
    runGen.indexOf('assertCanCreateProjectAgainstEnv') < runGen.indexOf('createProject({'),
    'UI guard before createProject call',
  )
})
