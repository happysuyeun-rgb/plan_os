/** Device-local recovery copy of a document edit that has not been saved. */
export interface UnsavedDraft {
  base: string
  content: string
  timestamp: number
}

export const unsavedDraftKey = (userId: string, documentId: string) =>
  `planos:draft:v1:${encodeURIComponent(userId)}:${encodeURIComponent(documentId)}`

export function getUnsavedDraft(userId: string, documentId: string): UnsavedDraft | null {
  try {
    const raw = localStorage.getItem(unsavedDraftKey(userId, documentId))
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const draft = value as Partial<UnsavedDraft>
    if (typeof draft.base !== 'string' || typeof draft.content !== 'string'
      || typeof draft.timestamp !== 'number') return null
    return { base: draft.base, content: draft.content, timestamp: draft.timestamp }
  } catch {
    return null
  }
}

export function storeUnsavedDraft(userId: string, documentId: string, base: string, content: string): void {
  try {
    const previous = getUnsavedDraft(userId, documentId)
    localStorage.setItem(unsavedDraftKey(userId, documentId), JSON.stringify({
      base: previous?.base ?? base,
      content,
      timestamp: Date.now(),
    } satisfies UnsavedDraft))
  } catch {
    // Private browsing or exhausted storage must not prevent editing.
  }
}

export function clearUnsavedDraft(userId: string, documentId: string, savedContent: string): void {
  try {
    if (getUnsavedDraft(userId, documentId)?.content === savedContent) {
      localStorage.removeItem(unsavedDraftKey(userId, documentId))
    }
  } catch {
    // Keep server save independent of device storage.
  }
}

/** The server acknowledged one revision. Retain newer text but rebase its
 * recovery baseline to the saved revision so reload is not a false conflict.
 */
export function acknowledgeSavedDraft(
  userId: string, documentId: string, savedContent: string,
): void {
  try {
    const draft = getUnsavedDraft(userId, documentId)
    if (!draft) return
    if (draft.content === savedContent) {
      localStorage.removeItem(unsavedDraftKey(userId, documentId))
    } else {
      localStorage.setItem(unsavedDraftKey(userId, documentId), JSON.stringify({
        base: savedContent,
        content: draft.content,
        timestamp: draft.timestamp,
      } satisfies UnsavedDraft))
    }
  } catch {
    // Persisted server acknowledgement is independent of browser storage.
  }
}
