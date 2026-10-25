import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  assertCitationMatchesDocument,
  assertFindingsMatchDocuments,
  citationFromOffsets,
  citationMatchesContent,
  windowAroundNeedle,
} from '../src/lib/ai/citationVerify.ts'
import { runMockPlanningReview } from '../src/lib/ai/MockPlanningReviewProvider.ts'

test('citation offsets match quote exactly (no trim drift)', () => {
  const content = '  hello world  '
  const { start, end } = windowAroundNeedle(content, 'world', 2)
  const citation = citationFromOffsets(
    { id: 'd1', type: 'prd', content, revision: 3 },
    start,
    end,
    'r',
  )
  assert.equal(citation.versionNumber, 3)
  assert.equal(citationMatchesContent(citation, content), true)
  assert.equal(content.slice(citation.startOffset, citation.endOffset), citation.quote)
})

test('mock findings always cite exact document windows', () => {
  const docs = [
    { id: 'd1', type: 'prd', content: '서비스 소개만 있는 문서입니다.', revision: 1 },
  ]
  const result = runMockPlanningReview(docs)
  for (const f of result.findings) {
    assertCitationMatchesDocument(f.citation, docs[0])
  }
})

test('revision mismatch is rejected', () => {
  const doc = { id: 'd1', type: 'prd', content: 'abc', revision: 2 }
  const citation = citationFromOffsets(doc, 0, 3, 'r')
  citation.versionNumber = 9
  assert.throws(() => assertCitationMatchesDocument(citation, doc), /revision/)
})

test('AC-07: fabricated citation / wrong document_id fails verification', () => {
  const docs = [
    { id: 'd1', type: 'prd', content: '실제 본문입니다.', revision: 1 },
    { id: 'd2', type: 'policy', content: '정책 본문.', revision: 1 },
  ]
  const fake = {
    id: 'f-fake',
    severity: 'warning',
    category: 'missing',
    reviewerState: 'proposed',
    summary: 'fake',
    citation: {
      documentId: 'missing-doc',
      documentType: 'prd',
      versionNumber: 1,
      startOffset: 0,
      endOffset: 4,
      quote: '없는인용',
      rationale: 'fabricated',
    },
  }
  assert.throws(
    () => assertFindingsMatchDocuments([fake], docs),
    /missing document|CitationMismatch/,
  )
  const badQuote = {
    ...fake,
    citation: {
      ...fake.citation,
      documentId: 'd1',
      quote: '조작된인용',
      startOffset: 0,
      endOffset: 4,
    },
  }
  assert.throws(() => assertFindingsMatchDocuments([badQuote], docs), /quote does not match|CitationMismatch/)
})
