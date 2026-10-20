import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname, sep } from 'node:path'

const root = process.cwd()
const docs = [
  'README.md',
  'docs/README.md',
  'docs/TECH_SPEC.md',
  'docs/archive/README.md',
  'docs/archive/legacy-v1/TECH_SPEC.md',
  'docs/DOCUMENT_INVENTORY_2026-10-21.md',
]
let checked = 0
const failures = []
for (const relativePath of docs) {
  const file = resolve(root, relativePath)
  if (!existsSync(file)) {
    failures.push(relativePath + ': file missing')
    continue
  }
  const text = readFileSync(file, 'utf8')
  const markdownLinks = [...text.matchAll(/\]\(([^)]+)\)/g)]
  for (const match of markdownLinks) {
    const raw = match[1].split('#')[0].split('?')[0]
    if (!raw || /^(?:[a-z]+:|\/\/|mailto:)/i.test(raw)) continue
    const target = resolve(dirname(file), decodeURIComponent(raw))
    checked++
    if (!target.startsWith(root + sep) && target !== root) {
      failures.push(relativePath + ': link escapes repository: ' + raw)
    } else if (!existsSync(target)) {
      failures.push(relativePath + ': missing target: ' + raw)
    }
  }
}
console.log('Checked ' + checked + ' local links across ' + docs.length + ' documents.')
if (failures.length) {
  for (const f of failures) console.error(f)
  process.exitCode = 1
} else {
  console.log('PASS: moved documentation and navigation relative links resolve.')
}
