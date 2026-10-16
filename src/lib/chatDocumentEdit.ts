import type { DocumentSaveStatus } from './documentAutosave'

/**
 * The existing "chat assistant" appends a placeholder note, not generated AI
 * content. Compose against the live local draft so that pending human edits
 * are never replaced by an older database read.
 */
export function appendChatDocumentContent(current: string, message: string): string {
  return `${current}\n\n<!-- AI 수정 반영 -->\n> ${message}`
}

interface ChatDocumentEditPort {
  readDraft: () => string
  queueDraft: (content: string) => void
  flushDraft: () => Promise<void>
  getSaveStatus: () => DocumentSaveStatus
}

export async function applyChatDocumentEdit(
  message: string,
  port: ChatDocumentEditPort,
): Promise<string> {
  // The snapshot, state update and per-document scheduling are synchronous.
  // A human edit arriving later joins the same write lane as a newer revision.
  const next = appendChatDocumentContent(port.readDraft(), message)
  port.queueDraft(next)
  await port.flushDraft()

  if (port.getSaveStatus() === 'error') {
    throw new Error('Document changes could not be saved')
  }
  return next
}
