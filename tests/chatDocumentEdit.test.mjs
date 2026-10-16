import assert from 'node:assert/strict'
import test from 'node:test'
import { createDocumentAutosave } from '../src/lib/documentAutosave.ts'
import {
  applyChatDocumentEdit,
  appendChatDocumentContent,
} from '../src/lib/chatDocumentEdit.ts'

function deferred() {
  let resolve
  const promise = new Promise((res) => { resolve = res })
  return { promise, resolve }
}

function createFixture(initial = { 'doc-A': 'original A', 'doc-B': 'original B' }, beforePersist) {
  const drafts = new Map(Object.entries(initial))
  const saved = new Map(Object.entries(initial))
  const writes = []
  const autosave = createDocumentAutosave({
    persist: async (id, content) => {
      writes.push([id, content])
      if (beforePersist) await beforePersist(id, content)
      saved.set(id, content)
      return { id, content }
    },
    onSaved: () => {},
    onReplaced: () => {},
    onError: () => {},
    delayMs: 60_000,
  })

  function edit(documentId, content) {
    drafts.set(documentId, content)
    autosave.schedule(documentId, content)
  }

  function apply(documentId, message) {
    return applyChatDocumentEdit(message, {
      readDraft: () => {
        if (!drafts.has(documentId)) {
          throw Error('This document does not belong to the active project')
        }
        return drafts.get(documentId)
      },
      queueDraft: (content) => edit(documentId, content),
      flushDraft: () => autosave.flush(documentId),
      getSaveStatus: () => autosave.getStatus(documentId),
    })
  }
  return { drafts, saved, writes, autosave, edit, apply }
}

test('chat append uses the unsaved local document, not stale database content', async () => {
  const state = createFixture()
  state.edit('doc-A', 'new text not yet persisted')
  const result = await state.apply('doc-A', 'add criteria')
  assert.equal(
    result,
    'new text not yet persisted\n\n<!-- AI 수정 반영 -->\n> add criteria',
  )
  assert.equal(state.saved.get('doc-A'), result)
  assert.deepEqual(state.writes, [['doc-A', result]])
})

test('chat updates serialize behind an existing in-flight autosave', async () => {
  const barrier = deferred()
  const started = deferred()
  const state = createFixture(undefined, async (_, content) => {
    if (content === 'first save') {
      started.resolve()
      await barrier.promise
    }
  })
  state.edit('doc-A', 'first save')
  const saving = state.autosave.flush('doc-A')
  await started.promise

  const chat = state.apply('doc-A', 'review please')
  assert.deepEqual(state.writes, [['doc-A', 'first save']])
  barrier.resolve()
  await Promise.all([saving, chat])
  assert.equal(
    state.saved.get('doc-A'),
    appendChatDocumentContent('first save', 'review please'),
  )
  assert.equal(state.writes.length, 2)
})

test('new user edits made during a slow chat save keep the appended chat section', async () => {
  const barrier = deferred()
  const started = deferred()
  const state = createFixture(undefined, async (_, content) => {
    if (content.includes('chat note')) {
      started.resolve()
      await barrier.promise
    }
  })

  const chat = state.apply('doc-A', 'chat note')
  await started.promise
  const edited = state.drafts.get('doc-A') + '\nmore human text'
  state.edit('doc-A', edited)
  const newer = state.autosave.flush('doc-A')
  barrier.resolve()
  await Promise.all([chat, newer])
  assert.equal(state.saved.get('doc-A'), edited)
  assert.ok(edited.includes('chat note'))
  assert.equal(state.autosave.getStatus('doc-A'), 'saved')
})

test('chat editing one document does not change another tab', async () => {
  const state = createFixture()
  const updated = await state.apply('doc-A', 'only document A')
  assert.equal(state.saved.get('doc-A'), updated)
  assert.equal(state.saved.get('doc-B'), 'original B')
  assert.equal(state.drafts.get('doc-B'), 'original B')
})

test('chat change rejects missing or no-longer-accessible document without writing', async () => {
  const state = createFixture()
  await assert.rejects(() => state.apply('another-project-doc', 'update'), /active project/)
  assert.deepEqual(state.writes, [])
})

test('chat edit keeps local text and reports failure when persistence fails', async () => {
  let fails = true
  const state = createFixture(undefined, async () => {
    if (fails) throw Error('network offline')
  })
  await assert.rejects(() => state.apply('doc-A', 'review'), /could not be saved/)
  const draft = state.drafts.get('doc-A')
  assert.equal(draft, appendChatDocumentContent('original A', 'review'))
  assert.equal(state.autosave.getStatus('doc-A'), 'error')

  fails = false
  await state.autosave.flush('doc-A')
  assert.equal(state.autosave.getStatus('doc-A'), 'saved')
  assert.equal(state.saved.get('doc-A'), draft)
})
