import assert from 'node:assert/strict'
import test from 'node:test'
import { createDocumentAutosave } from '../src/lib/documentAutosave.ts'

function deferred() {
  let resolve
  const promise = new Promise((res) => { resolve = res })
  return { promise, resolve }
}

function setup(persist) {
  const events = []
  const writes = []
  const save = createDocumentAutosave({
    persist: async (id, content) => {
      writes.push([id, content])
      if (persist) await persist(id, content)
      return { id, content }
    },
    onSaved: (id, content) => events.push(['saved', id, content]),
    onReplaced: (id, content) => events.push(['replaced', id, content]),
    onError: (id) => events.push(['error', id]),
    delayMs: 60_000,
  })
  return { save, writes, events }
}

test('restore after pending draft never lets old debounce overwrite the restored content', async () => {
  const { save, writes, events } = setup()
  save.schedule('doc-A', 'unsaved typing')
  const restored = await save.replace('doc-A', async () => {
    writes.push(['doc-A', 'restored version'])
    return 'restored version'
  })
  assert.equal(restored, 'restored version')
  assert.deepEqual(writes, [['doc-A', 'unsaved typing'], ['doc-A', 'restored version']])
  // The draft is persisted first, but its obsolete save callback is not
  // emitted because the explicit replacement owns the final visible state.
  assert.deepEqual(events, [
    ['replaced', 'doc-A', 'restored version'],
  ])
  assert.equal(save.getStatus('doc-A'), 'saved')
  await save.flush('doc-A')
  assert.equal(writes.length, 2)
})

test('regeneration waits for an already in-flight save to finish', async () => {
  const inFlight = deferred()
  const { save, writes } = setup(async (_, content) => {
    if (content === 'old input') await inFlight.promise
  })
  save.schedule('doc-A', 'old input')
  const pending = save.flush('doc-A')
  // Allow the queued async write to begin before replacement
  await Promise.resolve()
  const replacing = save.replace('doc-A', async () => {
    writes.push(['doc-A', 'generated output'])
    return 'generated output'
  })
  assert.deepEqual(writes, [['doc-A', 'old input']])
  inFlight.resolve()
  await Promise.all([pending, replacing])
  assert.deepEqual(writes, [['doc-A', 'old input'], ['doc-A', 'generated output']])
  assert.equal(save.getStatus('doc-A'), 'saved')
})

test('new edits made during generation win over late AI completion', async () => {
  const generation = deferred()
  const started = deferred()
  const { save, writes, events } = setup()
  const replacing = save.replace('doc-A', async () => {
    started.resolve()
    await generation.promise
    writes.push(['doc-A', 'AI output'])
    return 'AI output'
  })
  await started.promise
  save.schedule('doc-A', 'new human edit')
  const after = save.flush('doc-A')
  generation.resolve()
  await Promise.all([replacing, after])
  assert.deepEqual(writes, [['doc-A', 'AI output'], ['doc-A', 'new human edit']])
  assert.equal(events.some(([kind]) => kind === 'replaced'), false)
  assert.equal(save.getStatus('doc-A'), 'saved')
})

test('failed unsaved draft blocks destructive restore or regenerate until retried', async () => {
  let fail = true
  const { save, writes } = setup(async () => {
    if (fail) throw Error('offline')
  })
  save.schedule('doc-A', 'precious draft')
  let ran = false
  await assert.rejects(() => save.replace('doc-A', async () => {
    ran = true
    return 'restored'
  }), /Unsaved document changes/)
  assert.equal(ran, false)
  assert.equal(save.getStatus('doc-A'), 'error')
  fail = false
  await save.replace('doc-A', async () => {
    ran = true
    return 'restored'
  })
  assert.equal(ran, true)
  assert.deepEqual(writes, [
    ['doc-A', 'precious draft'],
    ['doc-A', 'precious draft'],
  ])
  assert.equal(save.getStatus('doc-A'), 'saved')
})

test('failed generation does not deadlock future saves', async () => {
  const { save, writes, events } = setup()
  await assert.rejects(
    () => save.replace('doc-A', async () => { throw Error('provider failure') }),
    /provider failure/,
  )
  assert.equal(save.getStatus('doc-A'), 'error')
  save.schedule('doc-A', 'human recovery')
  await save.flush('doc-A')
  assert.deepEqual(writes, [['doc-A', 'human recovery']])
  assert.equal(save.getStatus('doc-A'), 'saved')
  assert.ok(events.some(([kind]) => kind === 'error'))
})

test('restore on one document never blocks or changes another document', async () => {
  const barrier = deferred()
  const started = deferred()
  const { save, writes } = setup()
  const replacing = save.replace('doc-A', async () => {
    started.resolve()
    await barrier.promise
    writes.push(['doc-A', 'restored A'])
    return 'restored A'
  })
  await started.promise
  save.schedule('doc-B', 'edit B')
  await save.flush('doc-B')
  assert.deepEqual(writes, [['doc-B', 'edit B']])
  barrier.resolve()
  await replacing
  assert.deepEqual(writes, [['doc-B', 'edit B'], ['doc-A', 'restored A']])
})

test('an edit made while overwrite waits for an in-flight save is never dropped', async () => {
  const inFlight = deferred()
  const started = deferred()
  const { save, writes, events } = setup(async (_, content) => {
    if (content === 'initial') {
      started.resolve()
      await inFlight.promise
    }
  })

  save.schedule('doc-A', 'initial')
  const initial = save.flush('doc-A')
  await started.promise

  const replacing = save.replace('doc-A', async () => {
    writes.push(['doc-A', 'generated content'])
    return 'generated content'
  })

  // A new human edit happens while the first network request is still running.
  // It must remain newer than the replacement, not disappear in preflight.
  save.schedule('doc-A', 'typed while waiting')
  const final = save.flush('doc-A')
  inFlight.resolve()
  await Promise.all([initial, replacing, final])

  assert.deepEqual(writes, [
    ['doc-A', 'initial'],
    ['doc-A', 'generated content'],
    ['doc-A', 'typed while waiting'],
  ])
  assert.equal(events.some(([kind]) => kind === 'replaced'), false)
  assert.equal(save.getStatus('doc-A'), 'saved')
})
