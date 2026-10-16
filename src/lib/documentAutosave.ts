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
  onError: (documentId: string) => void
  delayMs?: number
}

export function createDocumentAutosave<T>({
  persist,
  onSaved,
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
    if (!task || task.savedRevision === task.revision) return 'saved'
    return task.failedRevision === task.revision ? 'error' : 'saving'
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

  return { schedule, flush, getStatus }
}
