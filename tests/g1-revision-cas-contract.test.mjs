import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const sql=readFileSync(new URL('../supabase/migrations/013_document_revision_cas_DRAFT.sql',import.meta.url),'utf8')
test('draft CAS compares compact server revision, not document body',()=>{
 assert.match(sql,/content_revision\s*=\s*p_expected_revision/i)
 assert.match(sql,/content_revision\s*=\s*content_revision\s*\+\s*1/i)
 assert.match(sql,/p_content\s+text/i)
 assert.doesNotMatch(sql,/content\s*=\s*p_expected_content/i)
})
test('draft rejects anonymous calls and uses invoker role',()=>{
 assert.match(sql,/security invoker/i)
 assert.match(sql,/auth\.uid\(\) is null/i)
})
test('draft is explicitly gated against deployment',()=>{
 assert.match(sql,/NOT applied to any database/i)
 assert.match(sql,/ALL writers revision-aware/i)
})
