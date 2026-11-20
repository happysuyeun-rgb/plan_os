/**
 * Split markdown (or similar) into navigable structure pages by headings.
 */

export type OutlineSection = {
  id: string
  index: number
  level: number
  title: string
  /** Full section text including the heading line */
  body: string
}

const HEADING_RE = /^(#{1,3})\s+(.+?)\s*$/

export function parseDocumentOutline(markdown: string): OutlineSection[] {
  const text = markdown ?? ''
  if (!text.trim()) {
    return [{ id: 'section-0', index: 0, level: 1, title: '빈 문서', body: text }]
  }

  const lines = text.split('\n')
  const headingIndexes: { line: number; level: number; title: string }[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(HEADING_RE)
    if (m) {
      headingIndexes.push({ line: i, level: m[1].length, title: m[2].trim() || `섹션 ${headingIndexes.length + 1}` })
    }
  }

  if (headingIndexes.length === 0) {
    const preview = text.trim().slice(0, 40).replace(/\s+/g, ' ')
    return [
      {
        id: 'section-0',
        index: 0,
        level: 1,
        title: preview ? `${preview}${text.trim().length > 40 ? '…' : ''}` : '본문',
        body: text,
      },
    ]
  }

  // Prefer ## pages; if none, use ### when that yields a navigable list; else top-level.
  const h2 = headingIndexes.filter((h) => h.level === 2)
  const h3 = headingIndexes.filter((h) => h.level === 3)
  const splits =
    h2.length > 0
      ? h2
      : h3.length > 1
        ? h3
        : headingIndexes.filter((h) => h.level === headingIndexes[0].level)

  const sections: OutlineSection[] = []
  for (let i = 0; i < splits.length; i++) {
    const start = splits[i].line
    const end = i + 1 < splits.length ? splits[i + 1].line : lines.length
    // Include preamble before first heading as its own page when non-empty.
    if (i === 0 && start > 0) {
      const preamble = lines.slice(0, start).join('\n')
      if (preamble.trim()) {
        sections.push({
          id: 'section-preamble',
          index: 0,
          level: 1,
          title: '개요',
          body: preamble.replace(/\n+$/, ''),
        })
      }
    }
    const body = lines.slice(start, end).join('\n').replace(/\n+$/, '')
    sections.push({
      id: `section-${sections.length}`,
      index: sections.length,
      level: splits[i].level,
      title: splits[i].title,
      body,
    })
  }

  return sections.map((s, index) => ({ ...s, index }))
}

/** Replace one section body inside the full document text. */
export function replaceOutlineSection(
  full: string,
  sections: OutlineSection[],
  sectionIndex: number,
  nextBody: string,
): string {
  if (sectionIndex < 0 || sectionIndex >= sections.length) return full
  const nextSections = sections.map((s, i) =>
    i === sectionIndex ? { ...s, body: nextBody } : s,
  )
  return nextSections.map((s) => s.body).join('\n\n')
}
