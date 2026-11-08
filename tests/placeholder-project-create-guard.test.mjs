import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const auth = readFileSync(new URL('../src/lib/localDevAuth.ts', import.meta.url), 'utf8')
const projectsApi = readFileSync(new URL('../src/lib/api/projects.ts', import.meta.url), 'utf8')
const store = readFileSync(new URL('../src/store/projectStore.ts', import.meta.url), 'utf8')
const page = readFileSync(new URL('../src/pages/ProjectCreatePage.tsx', import.meta.url), 'utf8')
const localData = readFileSync(new URL('../src/lib/localDevData.ts', import.meta.url), 'utf8')

test('localDevAuth defines placeholder detection helpers', () => {
  assert.match(auth, /placeholder\.supabase\.co/)
  assert.match(auth, /PLACEHOLDER_SUPABASE_BLOCKED/)
  assert.match(auth, /export function assertCanCreateProjectAgainstEnv/)
  assert.match(auth, /export function isLocalDevAuth/)
})

test('projects API uses localDevData on placeholder instead of remote insert', () => {
  assert.match(projectsApi, /isLocalDevAuth\(\)/)
  assert.match(projectsApi, /localCreateProject/)
  assert.match(localData, /local-project/)
  assert.match(localData, /planos-local-dev-projects/)
})

test('projectStore skips remote guard when localDevAuth', () => {
  const start = store.indexOf('createProject: async (data) =>')
  const end = store.indexOf('updateProject: async (id, data) =>')
  assert.ok(start > 0 && end > start, 'implementation createProject block')
  const createFn = store.slice(start, end)
  assert.match(createFn, /isLocalDevAuth\(\)/)
  assert.match(createFn, /assertCanCreateProjectAgainstEnv\(\)/)
  assert.ok(
    createFn.indexOf('isLocalDevAuth') < createFn.indexOf('apiCreateProject'),
    'localDev check must run before apiCreateProject',
  )
})

test('ProjectCreatePage allows localDev create on placeholder', () => {
  assert.match(page, /isLocalDevAuth/)
  assert.match(page, /assertCanCreateProjectAgainstEnv/)
  const start = page.indexOf('const runGeneration = async')
  const end = page.indexOf('const result = await startPipeline')
  assert.ok(start > 0 && end > start)
  const runGen = page.slice(start, end)
  assert.match(runGen, /!isLocalDevAuth\(\)/)
  assert.ok(
    runGen.indexOf('createProject({') > 0,
    'createProject still called after local/remote branch',
  )
})
