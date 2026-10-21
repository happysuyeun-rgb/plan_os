import assert from 'node:assert/strict'
import test from 'node:test'
import { createDocumentAutosave } from '../src/lib/documentAutosave.ts'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test('preserves the original document id when tabs switch', async () => {
  const writes = []
  const save = createDocumentAutosave({
    persist: async (id, content) => { writes.push([id, content]); return { id, content } },
    onSaved: () => {}, onError: () => {}, delayMs: 5,
  })
  save.schedule('doc-prd', 'edited PRD')
  save.schedule('doc-ia', 'edited IA')
  await sleep(30)
  assert.deepEqual(writes.sort(), [['doc-ia', 'edited IA'], ['doc-prd', 'edited PRD']])
  assert.equal(save.getStatus('doc-prd'), 'saved')
  assert.equal(save.getStatus('doc-ia'), 'saved')
})

test('coalesces rapid edits into the newest snapshot', async () => {
  const writes = []
  const save = createDocumentAutosave({
    persist: async (id, content) => { writes.push([id, content]); return content },
    onSaved: () => {}, onError: () => {}, delayMs: 8,
  })
  save.schedule('one', 'draft')
  save.schedule('one', 'final')
  await sleep(35)
  assert.deepEqual(writes, [['one', 'final']])
})

test('serializes in-flight writes without stale success callback', async () => {
  const writes = []
  const acknowledgements = []
  let unblock
  const gate = new Promise((resolve) => { unblock = resolve })
  const save = createDocumentAutosave({
    persist: async (id, content) => {
      writes.push([id, content])
      if (content === 'old') await gate
      return { id, content }
    },
    onSaved: (_, content) => acknowledgements.push(content),
    onError: () => {}, delayMs: 1000,
  })
  save.schedule('one', 'old')
  const first = save.flush('one')
  await sleep(0)
  save.schedule('one', 'new')
  const second = save.flush('one')
  assert.deepEqual(writes, [['one', 'old']])
  unblock()
  await Promise.all([first, second])
  assert.deepEqual(writes, [['one', 'old'], ['one', 'new']])
  assert.deepEqual(acknowledgements, ['new'])
  assert.equal(save.getStatus('one'), 'saved')
})

test('keeps failed edits retryable and exposes error status', async () => {
  const errors = []
  let fails = true
  const save = createDocumentAutosave({
    persist: async (_, content) => { if (fails) throw Error('offline'); return content },
    onSaved: () => {}, onError: (id) => errors.push(id), delayMs: 1000,
  })
  save.schedule('one', 'valuable content')
  await save.flush('one')
  assert.equal(save.getStatus('one'), 'error')
  assert.deepEqual(errors, ['one'])
  fails = false
  await save.flush('one')
  assert.equal(save.getStatus('one'), 'saved')
})
