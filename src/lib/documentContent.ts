import type { DocumentType, ScreenListRow, WireframeSlide } from '../types'

export interface ScreenListContent {
  type: 'screen_list'
  rows: ScreenListRow[]
}

export interface WireframeContent {
  type: 'wireframe'
  slides: WireframeSlide[]
}

export function isJsonContent(content: string): boolean {
  const t = content.trim()
  return t.startsWith('{') && t.endsWith('}')
}

export function parseScreenListContent(content: string): ScreenListRow[] | null {
  if (!isJsonContent(content)) return null
  try {
    const parsed = JSON.parse(content) as ScreenListContent
    if (parsed.type === 'screen_list' && Array.isArray(parsed.rows)) {
      return parsed.rows
    }
  } catch {
    /* markdown fallback */
  }
  return null
}

export function parseWireframeContent(content: string): WireframeSlide[] | null {
  if (!isJsonContent(content)) return null
  try {
    const parsed = JSON.parse(content) as WireframeContent
    if (parsed.type === 'wireframe' && Array.isArray(parsed.slides)) {
      return parsed.slides
    }
  } catch {
    /* markdown fallback */
  }
  return null
}

export function serializeScreenList(rows: ScreenListRow[]): string {
  return JSON.stringify({ type: 'screen_list', rows }, null, 2)
}

export function serializeWireframe(slides: WireframeSlide[]): string {
  return JSON.stringify({ type: 'wireframe', slides }, null, 2)
}

export function usesStructuredView(docType: DocumentType): boolean {
  return docType === 'screen_list' || docType === 'wireframe'
}

export function shouldUseStructuredRenderer(docType: DocumentType, content: string): boolean {
  if (docType === 'screen_list') return parseScreenListContent(content) !== null
  if (docType === 'wireframe') return parseWireframeContent(content) !== null
  return false
}
