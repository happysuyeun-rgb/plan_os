import assert from 'node:assert/strict'
import test from 'node:test'
import { createDocumentAutosave } from '../src/lib/documentAutosave.ts'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test('different documents save independently while one document is blocked', async () => {
  const writes = []
  let unblock
  const gate = new Promise((resolve) => { unblock = resolve })
  const save = createDocumentAutosave({
    persist: async (id, content) => {
      writes.push([id, content])
      if (id === 'doc-a') await gate
      return { id, content }
    },
    onSaved: () => {}, onError: () => {}, delayMs: 1000,
  })
  save.schedule('doc-a', 'a-1')
  const blocked = save.flush('doc-a')
  await sleep(0)
  save.schedule('doc-b', 'b-1')
  await save.flush('doc-b')
  // doc-b is not serialized behind doc-a's in-flight write.
  assert.deepEqual(writes, [['doc-a', 'a-1'], ['doc-b', 'b-1']])
  assert.equal(save.getStatus('doc-b'), 'saved')
  unblock()
  await blocked
  assert.equal(save.getStatus('doc-a'), 'saved')
})

test('conflict failure preserves the local edit for a later retry', async () => {
  let server = 'server-v2'
  let acknowledged = 'server-v1'
  const attempts = []
  const errors = []
  const save = createDocumentAutosave({
    persist: async (id, content) => {
      attempts.push(content)
      if (acknowledged !== server) {
        const error = new Error('document changed on server')
        error.name = 'DocumentWriteConflictError'
        throw error
      }
      server = content
      return { id, content }
    },
    onSaved: (id, content) => { acknowledged = content },
    onCommitted: (id, content) => { acknowledged = content },
    onError: (id) => errors.push(id),
    delayMs: 1000,
  })
  save.schedule('doc-a', 'my local edit')
  await save.flush('doc-a')
  // Conflict must not overwrite the server, must not mark the edit saved,
  // and must not silently retry in a loop. Work order 06 separates the
  // conflict status from a plain save failure; this lane has no onConflict
  // handler, so the error callback still fires as the fallback signal.
  assert.equal(server, 'server-v2')
  assert.deepEqual(attempts, ['my local edit'])
  assert.equal(save.getStatus('doc-a'), 'conflict')
  assert.deepEqual(errors, ['doc-a'])

  // After the user re-checks and the baseline is refreshed, the preserved
  // local edit can be saved by the same flush path without retyping.
  acknowledged = 'server-v2'
  await save.flush('doc-a')
  assert.equal(server, 'my local edit')
  assert.equal(save.getStatus('doc-a'), 'saved')
  assert.deepEqual(attempts, ['my local edit', 'my local edit'])
})
