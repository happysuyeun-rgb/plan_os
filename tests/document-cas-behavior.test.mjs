import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Exercise the actual adapter body with a fake PostgREST response chain.
// This is not an isolated database/RLS test.
const source = readFileSync(new URL('../src/lib/api/documents.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const withoutImports = js.replace(/^import .*?;?$/gm, '')
const rewritten = withoutImports.replaceAll('export ', '')
const stub = new Function('supabase', 'throwIfError', rewritten +
  '\nreturn {saveDocumentContentIfUnchanged, DocumentWriteConflictError};')

function adapter(serverContent, count = 1) {
  const where = {}
  let nextContent
  const supabase = {
    from(table) {
      assert.equal(table, 'documents')
      return {
        update(row) {
          nextContent = row.content
          return {
            eq(key, value) {
              where[key] = value
              return this
            },
            async select() {
              if (count === 0 || where.content !== serverContent) return { data: [], error: null }
              return { data: [{ id: where.id, content: nextContent }], error: null }
            },
          }
        },
      }
    },
  }
  return stub(supabase, (error) => { if (error) throw error })
}
test('a current baseline saves exactly one matching document', async () => {
  const { saveDocumentContentIfUnchanged } = adapter('server-v1')
  const result = await saveDocumentContentIfUnchanged('doc-1', 'server-v1', 'new-draft')
  assert.deepEqual(result, { id: 'doc-1', content: 'new-draft' })
})
test('a stale recovered draft cannot silently overwrite newer server content', async () => {
  const { saveDocumentContentIfUnchanged, DocumentWriteConflictError } = adapter('server-v2')
  await assert.rejects(
    saveDocumentContentIfUnchanged('doc-1', 'server-v1', 'old-draft'),
    DocumentWriteConflictError,
  )
})
test('no matching visible document rejects without claiming reason', async () => {
  const { saveDocumentContentIfUnchanged, DocumentWriteConflictError } = adapter('server-v1', 0)
  await assert.rejects(
    saveDocumentContentIfUnchanged('doc-1', 'server-v1', 'draft'),
    DocumentWriteConflictError,
  )
})
