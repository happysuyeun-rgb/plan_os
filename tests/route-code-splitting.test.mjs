import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

test('heavy screens are React.lazy route chunks; landing/login stay eager', () => {
  assert.match(app, /lazy\(\(\) => import\('\.\/pages\/DocumentPage'\)\)/)
  assert.match(app, /lazy\(\(\) => import\('\.\/pages\/ProjectAiReviewPage'\)\)/)
  assert.match(app, /lazy\(\(\) => import\('\.\/pages\/PmPlanListPage'\)\)/)
  assert.match(app, /lazy\(\(\) => import\('\.\/pages\/AiStaffHubPage'\)\)/)
  assert.match(app, /import LandingPage from '\.\/pages\/LandingPage'/)
  assert.match(app, /import LoginPage from '\.\/pages\/LoginPage'/)
  assert.match(app, /Suspense/)
  assert.doesNotMatch(app, /import DocumentPage from '\.\/pages\/DocumentPage'/)
})
