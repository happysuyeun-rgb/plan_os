/** Persist each document's edit snapshot independently of the active document tab. */
export type DocumentSaveStatus = 'saved' | 'saving' | 'error'

interface SaveTask {
  revision: number
  savedRevision: number
  failedRevision: number | null
  content: string
  timer: ReturnType<typeof setTimeout> | null
  tail: Promise<void>
}

interface DocumentAutosaveOptions<T> {
  persist: (documentId: string, content: string) => Promise<T>
  onSaved: (documentId: string, content: string, result: T) => void
  onReplaced: (documentId: string, content: string) => void
  onError: (documentId: string) => void
  delayMs?: number
}

export function createDocumentAutosave<T>({
  persist,
  onSaved,
  onReplaced,
  onError,
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
        content: '',
        timer: null,
        tail: Promise.resolve(),
      }
      tasks.set(documentId, task)
    }
    return task
  }

  function getStatus(documentId?: string): DocumentSaveStatus {
    if (!documentId) return 'saved'
    const task = tasks.get(documentId)
    if (!task) return 'saved'
    // A failed explicit overwrite has no unsaved *draft*, but the failed
    // operation must still be visible as an error until user retries it.
    if (task.failedRevision === task.revision) return 'error'
    return task.savedRevision === task.revision ? 'saved' : 'saving'
  }

  function schedule(documentId: string, content: string): void {
    const task = getTask(documentId)
    task.revision += 1
    task.failedRevision = null
    task.content = content
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

    // Serialize writes for a document. Skip snapshots superseded before send.
    const operation = task.tail.then(async () => {
      if (revision !== task.revision || task.savedRevision >= revision) return
      try {
        const updated = await persist(documentId, content)
        task.savedRevision = revision
        task.failedRevision = null
        if (task.revision === revision) onSaved(documentId, content, updated)
      } catch {
        if (task.revision === revision) {
          task.failedRevision = revision
          onError(documentId)
        }
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
    overwrite: () => Promise<string>,
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
        const content = await overwrite()
        task.savedRevision = revision
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

  return { schedule, flush, replace, getStatus }
}
