/** Persist each document's edit snapshot independently of the active document tab. */
export type DocumentSaveStatus = 'saved' | 'saving' | 'conflict' | 'error'

/** Result of an explicit overwrite (restore / regenerate / chat commit). */
export interface DocumentReplaceResult {
  content: string
  /** Server content_revision after the overwrite, when the writer knows it. */
  revision?: number
}

interface SaveTask {
  revision: number
  savedRevision: number
  failedRevision: number | null
  conflictedRevision: number | null
  content: string
  timer: ReturnType<typeof setTimeout> | null
  tail: Promise<void>
  /** Revision whose persist() call has started and not yet settled. */
  activeRevision: number | null
  /**
   * Revision that was already in flight when a newer edit was scheduled.
   * Its write still lands on the server (and must advance the baseline via
   * onCommitted), but emitting onSaved for it would report a stale snapshot
   * as the saved state, so the visible acknowledgement is suppressed.
   */
  suppressAckRevision: number | null
}

interface DocumentAutosaveOptions<T> {
  persist: (documentId: string, content: string) => Promise<T>
  onSaved: (documentId: string, content: string, result: T) => void
  onReplaced: (documentId: string, content: string) => void
  onCommitted?: (documentId: string, content: string, revision?: number) => void
  onError: (documentId: string) => void
  onConflict?: (documentId: string) => void
  delayMs?: number
}

/**
 * A revision conflict is a distinct outcome from a save failure: the server
 * holds a newer document, the local draft is preserved untouched, and the
 * user must reload the latest document before saving again. Detected by
 * duck-typing so this module stays free of API-layer imports.
 */
function isRevisionConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { name?: string; code?: string }
  return candidate.name === 'DocumentWriteConflictError' || candidate.code === 'P4001'
}

export function createDocumentAutosave<T>({
  persist,
  onSaved,
  onReplaced,
  onCommitted,
  onError,
  onConflict,
  delayMs = 2000,
}: DocumentAutosaveOptions<T>) {
  const tasks = new Map<string, SaveTask>()

  function getTask(documentId: string): SaveTask {
    let task = tasks.get(documentId)
    if (!task) {
      task = {
        revision: 0,
        savedRevision: 0,
        failedRevision: null,
        conflictedRevision: null,
        content: '',
        timer: null,
        tail: Promise.resolve(),
        activeRevision: null,
        suppressAckRevision: null,
      }
      tasks.set(documentId, task)
    }
    return task
  }

  function getStatus(documentId?: string): DocumentSaveStatus {
    if (!documentId) return 'saved'
    const task = tasks.get(documentId)
    if (!task) return 'saved'
    // A conflict means the server document moved ahead. The draft stays
    // untouched and unsaved until the user reloads the latest document.
    if (task.conflictedRevision === task.revision) return 'conflict'
    // A failed explicit overwrite has no unsaved *draft*, but the failed
    // operation must still be visible as an error until user retries it.
    if (task.failedRevision === task.revision) return 'error'
    return task.savedRevision === task.revision ? 'saved' : 'saving'
  }

  function schedule(documentId: string, content: string): void {
    const task = getTask(documentId)
    task.revision += 1
    task.failedRevision = null
    task.conflictedRevision = null
    task.content = content
    // An edit arriving while an older write is already on the wire makes that
    // write's success acknowledgement stale. The write itself is not
    // cancelled (the server may already have it); only its onSaved emission
    // is suppressed, and the baseline still advances through onCommitted.
    if (task.activeRevision !== null) {
      task.suppressAckRevision = task.activeRevision
    }
    if (task.timer) clearTimeout(task.timer)
    task.timer = setTimeout(() => { void flush(documentId) }, delayMs)
  }

  function flush(documentId: string): Promise<void> {
    const task = tasks.get(documentId)
    if (!task) return Promise.resolve()
    if (task.timer) clearTimeout(task.timer)
    task.timer = null
    const revision = task.revision
    const content = task.content

    // Serialize writes for a document in schedule order. A snapshot that was
    // superseded while still queued is still written and acknowledged in
    // order: with a compare-and-swap persist, the next snapshot's expected
    // baseline is exactly this snapshot, so skipping it would strand every
    // later save on a stale baseline. Only snapshots already saved (duplicate
    // flush of the same revision) are skipped.
    const operation = task.tail.then(async () => {
      if (task.savedRevision >= revision) return
      task.activeRevision = revision
      try {
        const updated = await persist(documentId, content)
        task.savedRevision = revision
        task.failedRevision = null
        task.conflictedRevision = null
        if (task.suppressAckRevision === revision) {
          // Newer text was scheduled while this write was in flight. Advance
          // the server baseline silently; do not report the stale snapshot
          // as saved, and never mark the newer edit as saved yet.
          task.suppressAckRevision = null
          onCommitted?.(documentId, content)
        } else {
          // Even if the editor has newer text, advance its acknowledged server baseline.
          onSaved(documentId, content, updated)
        }
      } catch (error) {
        if (task.revision === revision) {
          if (isRevisionConflict(error)) {
            // Never retry a conflicted snapshot against a stale baseline in
            // a loop: keep the draft, surface the conflict, and wait for an
            // explicit reload of the latest server document.
            task.conflictedRevision = revision
            if (onConflict) onConflict(documentId)
            else onError(documentId)
          } else {
            task.failedRevision = revision
            onError(documentId)
          }
        }
      } finally {
        if (task.activeRevision === revision) task.activeRevision = null
      }
    })
    task.tail = operation
    return operation
  }

  /**
   * Run an explicit overwrite (restore / regeneration) in the same per-document
   * write lane as autosave. First persist pending edits; never overwrite a failed
   * draft silently. Edits made after this operation starts remain authoritative.
   */
  function replace(
    documentId: string,
    overwrite: () => Promise<string | DocumentReplaceResult>,
  ): Promise<string> {
    const task = getTask(documentId)
    if (task.timer) clearTimeout(task.timer)
    task.timer = null

    // Reserve the overwrite position synchronously. Edits scheduled after this
    // point receive a newer revision and MUST be saved after the overwrite.
    // An await-before-reservation would silently discard edits made while
    // waiting for the preceding in-flight network save.
    const pendingRevision = task.revision
    const pendingContent = task.content
    const revision = ++task.revision
    task.failedRevision = null
    task.conflictedRevision = null

    const operation = task.tail.then(async () => {
      let pendingDraftHandled = false
      try {
        // Flush the snapshot that existed when the user requested restore/
        // regenerate. If a previous in-flight save already wrote it, skip.
        // A failed draft must never be discarded by a replacement operation.
        if (pendingRevision > task.savedRevision) {
          try {
            await persist(documentId, pendingContent)
            task.savedRevision = pendingRevision
            // The pending draft is persisted only as a preflight for the
            // explicit overwrite. Its acknowledgement must not be emitted as
            // a visible "saved" event: the replacement owns the final state
            // (and reports it through onCommitted/onReplaced). The baseline
            // still advances so a later edit compares against this snapshot.
            onCommitted?.(documentId, pendingContent)
          } catch (error) {
            throw new Error(
              'Unsaved document changes must be retried before overwrite',
              { cause: error },
            )
          }
        }

        // Any subsequent failure is in the explicit overwrite, not in a
        // human draft. The reserved revision must NOT be re-flushed as though
        // task.content were a newer unsaved edit (it may be just an empty
        // placeholder after a full page reload).
        pendingDraftHandled = true
        const result = await overwrite()
        const content = typeof result === 'string' ? result : result.content
        const resultRevision = typeof result === 'string' ? undefined : result.revision
        task.savedRevision = revision
        // Always advance server baseline, but never clobber a newer local draft.
        onCommitted?.(documentId, content, resultRevision)
        if (task.revision === revision) {
          task.content = content
          onReplaced(documentId, content)
        }
        return content
      } catch (error) {
        if (task.revision === revision) {
          // Mark only the reserved failed replacement revision as handled.
          // Keep genuine pending unsaved edits retryable if their preflight
          // persistence failed. Do not report a failed replace as "saved".
          if (pendingDraftHandled) task.savedRevision = revision
          task.failedRevision = revision
          onError(documentId)
        }
        throw error
      }
    })

    // Keep later edits and replacements runnable after a failed operation.
    task.tail = operation.then(() => undefined, () => undefined)
    return operation
  }

  /**
   * Adopt the latest server document after a revision conflict (or any
   * authoritative reload): the lane's snapshot becomes the server content
   * and is marked saved, so a later flush can never push the preserved
   * stale draft over the newer server document. Edits scheduled afterwards
   * start a fresh revision on top of the server baseline.
   */
  function adoptServerContent(documentId: string, serverContent: string): void {
    const task = getTask(documentId)
    if (task.timer) clearTimeout(task.timer)
    task.timer = null
    task.revision += 1
    task.savedRevision = task.revision
    task.failedRevision = null
    task.conflictedRevision = null
    task.content = serverContent
  }

  return { schedule, flush, replace, getStatus, adoptServerContent }
}
