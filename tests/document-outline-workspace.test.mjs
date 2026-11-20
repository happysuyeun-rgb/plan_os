import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  parseDocumentOutline,
  replaceOutlineSection,
} from '../src/lib/documentOutline.ts'

const read = (p) => readFileSync(p, 'utf8')

describe('document outline + decision workspace', () => {
  it('splits markdown by ## into pages', () => {
    const md = `# PRD\n\nintro\n\n## 목표\n\nA\n\n## 범위\n\nB\n`
    const sections = parseDocumentOutline(md)
    assert.equal(sections.length >= 2, true)
    assert.ok(sections.some((s) => s.title === '목표'))
    assert.ok(sections.some((s) => s.title === '범위'))
  })

  it('falls back to ### pages when ## is missing', () => {
    const md = `# PRD\n\n### 목표\n\nA\n\n### 범위\n\nB\n`
    const sections = parseDocumentOutline(md)
    assert.equal(sections.length >= 2, true)
    assert.ok(sections.some((s) => s.title === '목표'))
  })

  it('replaces a single section without dropping others', () => {
    const md = `## A\n\none\n\n## B\n\ntwo\n`
    const sections = parseDocumentOutline(md)
    const a = sections.findIndex((s) => s.title === 'A')
    const next = replaceOutlineSection(md, sections, a, '## A\n\nupdated')
    assert.match(next, /updated/)
    assert.match(next, /## B/)
  })

  it('wires DocumentPage to paged workspace and decision bar', () => {
    const page = read('src/pages/DocumentPage.tsx')
    const workspace = read('src/components/document/DocumentPagedWorkspace.tsx')
    const structure = read('src/components/document/DocumentStructurePanel.tsx')
    const decision = read('src/components/document/DocumentDecisionBar.tsx')
    assert.match(page, /DocumentPagedWorkspace/)
    assert.match(page, /onApprove/)
    assert.match(workspace, /DocumentStructurePanel/)
    assert.match(workspace, /DocumentDecisionBar/)
    assert.match(workspace, /showStructure/)
    assert.match(workspace, /document-page-prev/)
    assert.match(structure, /document-structure-panel/)
    assert.match(decision, /document-approve/)
    assert.match(decision, /document-reject/)
  })
})
