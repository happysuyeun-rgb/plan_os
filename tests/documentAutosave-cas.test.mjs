import assert from 'node:assert/strict'
import test from 'node:test'
import { createDocumentAutosave } from '../src/lib/documentAutosave.ts'

class DocumentWriteConflictError extends Error {
  constructor() {
    super('conflict')
    this.name = 'DocumentWriteConflictError'
  }
}

test('revision conflict keeps the draft and exposes a distinct conflict status', async () => {
  const writes = []
  const conflicts = []
  const errors = []
  let fail = true
  const save = createDocumentAutosave({
    persist: async (id, content) => {
      writes.push([id, content])
      if (fail) throw new DocumentWriteConflictError()
      return { id, content }
    },
    onSaved: () => {},
    onReplaced: () => {},
    onError: (id) => errors.push(id),
    onConflict: (id) => conflicts.push(id),
    delayMs: 60_000,
  })
  save.schedule('doc-A', 'my preserved draft')
  await save.flush('doc-A')
  assert.equal(save.getStatus('doc-A'), 'conflict')
  assert.deepEqual(conflicts, ['doc-A'])
  assert.deepEqual(errors, [])
  // The draft is not discarded or rewritten: retrying persists the same text.
  fail = false
  await save.flush('doc-A')
  assert.deepEqual(writes, [
    ['doc-A', 'my preserved draft'],
    ['doc-A', 'my preserved draft'],
  ])
  assert.equal(save.getStatus('doc-A'), 'saved')
})

test('SQLSTATE 40001 from the server is also classified as a conflict', async () => {
  const conflicts = []
  const save = createDocumentAutosave({
    persist: async () => {
      const error = new Error('document revision conflict')
      error.code = '40001'
      throw error
    },
    onSaved: () => {},
    onReplaced: () => {},
    onError: () => { throw new Error('must not report a conflict as a plain error') },
    onConflict: (id) => conflicts.push(id),
    delayMs: 60_000,
  })
  save.schedule('doc-A', 'draft')
  await save.flush('doc-A')
  assert.equal(save.getStatus('doc-A'), 'conflict')
  assert.deepEqual(conflicts, ['doc-A'])
})

test('adopting the latest server document clears the conflict without re-saving the stale draft', async () => {
  const writes = []
  const save = createDocumentAutosave({
    persist: async (id, content) => {
      writes.push([id, content])
      throw new DocumentWriteConflictError()
    },
    onSaved: () => {},
    onReplaced: () => {},
    onError: () => {},
    onConflict: () => {},
    delayMs: 60_000,
  })
  save.schedule('doc-A', 'stale local draft')
  await save.flush('doc-A')
  assert.equal(save.getStatus('doc-A'), 'conflict')

  save.adoptServerContent('doc-A', 'latest server document')
  assert.equal(save.getStatus('doc-A'), 'saved')
  // No pending snapshot remains, so a flush must not write anything.
  await save.flush('doc-A')
  assert.deepEqual(writes, [['doc-A', 'stale local draft']])
})

test('a conflict stays visible while newer edits are scheduled but not yet saved', async () => {
  let attempts = 0
  const save = createDocumentAutosave({
    persist: async () => {
      attempts += 1
      if (attempts === 1) throw new DocumentWriteConflictError()
      return {}
    },
    onSaved: () => {},
    onReplaced: () => {},
    onError: () => {},
    onConflict: () => {},
    delayMs: 60_000,
  })
  save.schedule('doc-A', 'draft v1')
  await save.flush('doc-A')
  assert.equal(save.getStatus('doc-A'), 'conflict')
  save.schedule('doc-A', 'draft v2')
  assert.equal(save.getStatus('doc-A'), 'saving')
  await save.flush('doc-A')
  assert.equal(save.getStatus('doc-A'), 'saved')
})
