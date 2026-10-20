import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname, sep } from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const all = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
const docs = all.filter((file) => file.toLowerCase().endsWith('.md'))
const failures = []
let checked = 0
const ignored = []
for (const relativePath of docs) {
  const file = resolve(root, relativePath)
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(/\]\((<[^>]+>|[^\s)]+)(?:\s+["'][^"']+["'])?\)/g)) {
    let raw = match[1].replace(/^<|>$/g, '').split('#')[0].split('?')[0]
    if (!raw || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(raw)) continue
    try { raw = decodeURIComponent(raw) } catch { failures.push(relativePath + ': malformed URL: ' + raw); continue }
    const target = resolve(dirname(file), raw)
    checked++
    if (!target.startsWith(root + sep) && target !== root) failures.push(relativePath + ': escaped repo: ' + raw)
    else if (!existsSync(target)) failures.push(relativePath + ': missing ' + raw)
  }
  // Wiki links, reference-style markdown and quoted paths are not fully parsed.
}
console.log('Tracked Markdown documents: ' + docs.length + '; relative links inspected: ' + checked)
console.log('Tracked docs paths:\n' + docs.filter((p) => p.startsWith('docs/')).join('\n'))
if (failures.length) {
  for (const fail of failures) console.error('BROKEN: ' + fail)
  console.error(failures.length + ' broken links; update references or record explicit legacy exceptions.')
  process.exitCode = 1
} else console.log('PASS: tracked Markdown relative links resolve.')
