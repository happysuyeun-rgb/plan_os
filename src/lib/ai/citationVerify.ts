/**
 * Ensure review citations point at exact substrings of the reviewed document
 * body (and optional revision). Used by Mock reviewer and accept-time checks.
 */

import type { DocumentCitation, ReviewFinding } from './reviewJob'

export type CitationDocument = {
  id: string
  type: string
  content: string
  /** L1 CAS revision (documents.content_revision) or L2 version_number. */
  revision?: number
}

export class CitationMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CitationMismatchError'
  }
}

/** True when quote equals content[startOffset:endOffset] exactly. */
export function citationMatchesContent(
  citation: DocumentCitation,
  content: string,
): boolean {
  const start = citation.startOffset
  const end = citation.endOffset
  if (start == null || end == null || start < 0 || end < start || end > content.length) {
    return false
  }
  return content.slice(start, end) === citation.quote
}

export function assertCitationMatchesDocument(
  citation: DocumentCitation,
  doc: CitationDocument,
): void {
  if (citation.documentId !== doc.id) {
    throw new CitationMismatchError(
      `citation documentId ${citation.documentId} !== doc ${doc.id}`,
    )
  }
  if (citation.documentType !== doc.type) {
    throw new CitationMismatchError(
      `citation type ${citation.documentType} !== doc ${doc.type}`,
    )
  }
  if (
    citation.versionNumber != null &&
    doc.revision != null &&
    citation.versionNumber !== doc.revision
  ) {
    throw new CitationMismatchError(
      `citation revision ${citation.versionNumber} !== doc revision ${doc.revision}`,
    )
  }
  if (!citationMatchesContent(citation, doc.content)) {
    throw new CitationMismatchError(
      `quote does not match offsets ${citation.startOffset}-${citation.endOffset} on ${doc.type}`,
    )
  }
}

export function assertFindingsMatchDocuments(
  findings: ReviewFinding[],
  docs: CitationDocument[],
): void {
  const byId = new Map(docs.map((d) => [d.id, d]))
  for (const finding of findings) {
    const doc = byId.get(finding.citation.documentId)
    if (!doc) {
      throw new CitationMismatchError(
        `finding ${finding.id} cites missing document ${finding.citation.documentId}`,
      )
    }
    assertCitationMatchesDocument(finding.citation, doc)
  }
}

/**
 * Build a citation whose quote is exactly content[start:end] (no trim drift).
 */
export function citationFromOffsets(
  doc: CitationDocument,
  start: number,
  end: number,
  rationale: string,
): DocumentCitation {
  const safeStart = Math.max(0, Math.min(start, doc.content.length))
  const safeEnd = Math.max(safeStart, Math.min(end, doc.content.length))
  return {
    documentId: doc.id,
    documentType: doc.type,
    versionNumber: doc.revision,
    startOffset: safeStart,
    endOffset: safeEnd,
    quote: doc.content.slice(safeStart, safeEnd),
    rationale,
  }
}

/** Locate needle and return exact offsets for the surrounding window (no trim). */
export function windowAroundNeedle(
  content: string,
  needle: string,
  radius = 40,
): { start: number; end: number } {
  const idx = content.toLowerCase().indexOf(needle.toLowerCase())
  if (idx < 0) {
    const end = Math.min(80, content.length)
    return { start: 0, end }
  }
  const start = Math.max(0, idx - radius)
  const end = Math.min(content.length, idx + needle.length + radius)
  return { start, end }
}
