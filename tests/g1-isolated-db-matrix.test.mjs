import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const sql=readFileSync(new URL('../supabase/drafts/017_document_revision_cas_DRAFT.sql',import.meta.url),'utf8')
const matrix=readFileSync(new URL('../docs/quality/G1_ISOLATED_DB_TEST_MATRIX_2026-10-21.md',import.meta.url),'utf8')
test('test matrix covers twelve required isolated DB scenarios',()=>{for(let i=1;i<=12;i++)assert.match(matrix,new RegExp('DB-'+String(i).padStart(2,'0')+'\\b'))})
test('design requires server role check, atomic revision CAS, and all-writer migration',()=>{
 assert.match(sql,/can_edit_project_content\(v_project_id\)/)
 assert.match(sql,/content_revision\s*=\s*p_expected_revision/)
 assert.match(matrix,/Full migration names, grants, policies/)
 assert.match(matrix,/direct UPDATE/)
})
