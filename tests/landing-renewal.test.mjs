import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/pages/LandingPage.tsx', import.meta.url), 'utf8')
const hero = readFileSync(
  new URL('../src/components/landing/LandingHero.tsx', import.meta.url),
  'utf8',
)
const shell = readFileSync(
  new URL('../src/components/landing/LandingShell.tsx', import.meta.url),
  'utf8',
)
const value = readFileSync(
  new URL('../src/components/landing/LandingValueStrip.tsx', import.meta.url),
  'utf8',
)
const how = readFileSync(
  new URL('../src/components/landing/LandingHowItWorks.tsx', import.meta.url),
  'utf8',
)
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

test('landing page wires shell hero and service sections', () => {
  assert.match(page, /LandingShell/)
  assert.match(page, /LandingHero/)
  assert.match(page, /LandingValueStrip/)
  assert.match(page, /LandingHowItWorks/)
  assert.match(page, /LandingAfterLogin/)
  assert.match(page, /무료로 체험하기|handleStartInterview/)
})

test('hero keeps guest idea CTA with white and brand purple', () => {
  assert.match(hero, /무료로 체험하기/)
  assert.match(hero, /PlanOS/)
  assert.match(hero, /text-brand-700/)
  assert.match(shell, /text-brand-700/)
})

test('service sections describe deliverables and steps', () => {
  assert.match(value, /무엇을 만드나요/)
  assert.match(value, /PRD/)
  assert.match(value, /Cursor 프롬프트/)
  assert.match(how, /어떻게 쓰나요/)
  assert.match(how, /짧은 인터뷰/)
})

test('landing css uses white base and brand purple accent', () => {
  assert.match(css, /--landing-accent:\s*#7c3aed/)
  assert.match(css, /#ffffff/)
  assert.match(css, /\.landing-root/)
  assert.match(css, /Sora/)
  assert.doesNotMatch(css, /2dd4bf/)
})
