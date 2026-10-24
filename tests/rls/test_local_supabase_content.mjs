// RUNS ONLY AGAINST THE DISPOSABLE LOCAL SUPABASE created by CI.
// Imports previous suite to reuse its real local Auth JWTs and fixture projects.
import assert from 'node:assert/strict'
import {
  people, projectOne, projectTwo, anonKey, API_URL, db, call,
} from './test_local_supabase_auth.mjs'
import { queryPsqlScalar } from '../helpers/psql.mjs'

// Schema precondition (migration 014/026): document_versions is append-only.
// A drifted local database once resurrected the UPDATE policy + grant, which
// silently turned the "past version is immutable" checks below into a real
// rewrite. Fail loudly here instead of misreporting that as a product bug.
const updatePolicyCount = queryPsqlScalar(
  "select count(*) from pg_policies where schemaname='public' and tablename='document_versions' and cmd='UPDATE'",
)
assert.equal(updatePolicyCount, '0',
  'document_versions must not have an UPDATE policy (migration 014); this database has drifted')
const authenticatedCanUpdate = queryPsqlScalar(
  "select has_table_privilege('authenticated', 'public.document_versions', 'UPDATE')",
)
assert.equal(authenticatedCanUpdate, 'f',
  'authenticated must not hold UPDATE on document_versions (migration 014); this database has drifted')
console.log('PASS document_versions schema precondition: no UPDATE policy, no UPDATE grant')

const ownerComment='33333333-3333-3333-3333-333333333301'
const editorComment='33333333-3333-3333-3333-333333333302'
const viewerComment='33333333-3333-3333-3333-333333333303'
const ownerReaction='44444444-4444-4444-4444-444444444401'
const editorReaction='44444444-4444-4444-4444-444444444402'
const ownerNotification='55555555-5555-5555-5555-555555555501'
const oldVersion='66666666-6666-6666-6666-666666666601'

db('tests/rls/seed_content_hardening.sql', [
 ['owner_id',people.owner.id],
 ['editor_id',people.editor.id],
 ['viewer_id',people.viewer.id],
 ['other_owner_id',people.otherOwner.id],
])
const documents=await call('/rest/v1/documents?select=id&project_id=eq.'+projectOne, {bearer:people.owner.access_token})
assert.equal(documents.length,1)
const docId=documents[0].id
const otherDocuments=await call('/rest/v1/documents?select=id&project_id=eq.'+projectTwo, {bearer:people.otherOwner.access_token})
assert.equal(otherDocuments.length,1)
const otherDocId=otherDocuments[0].id

// Unlike call(), this helper accepts deliberate 403/42501 denials and
// PostgREST UPDATE/DELETE empty-row responses as expected outcomes.
async function rest(role,table,method='GET',query='',body,prefer='return=representation') {
  const bearer=role==='anon'?anonKey:people[role].access_token
  const response=await fetch(API_URL+'/rest/v1/'+table+(query?'?'+query:''),{
    method,
    headers:{
      apikey:anonKey,Authorization:'Bearer '+bearer,
      'Content-Type':'application/json',
      Prefer:prefer,
    },
    body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(12000),
  })
  const raw=await response.text()
  let data=null
  try{data=raw?JSON.parse(raw):null}catch{data=null}
  return {status:response.status,ok:response.ok,data}
}
function expectAllowed(result,count=1,label='write'){
  assert(result.ok,label+' expected success, received HTTP '+result.status)
  assert(Array.isArray(result.data),label+' expected PostgREST row array')
  assert.equal(result.data.length,count,label+' unexpected changed row count')
}
function expectDenied(result,label){
  if(!result.ok)return
  assert(Array.isArray(result.data),label+' expected rejected or zero matching rows')
  assert.equal(result.data.length,0,label+' unexpectedly modified one or more rows')
}
async function rows(role,table,query){
  const r=await rest(role,table,'GET',query)
  assert(r.ok,table+' SELECT returned HTTP '+r.status)
  assert(Array.isArray(r.data))
  return r.data
}
const enc=id=>'id=eq.'+id

// COMMENT: nonauthor must not edit text, author may edit own body. Author IDs
// and comment/project attribution are immutable even for authors.
expectDenied(await rest('editor','project_comments','PATCH',enc(ownerComment),{body:'FAKED EDIT'}),'editor edits owner text')
assert.equal((await rows('owner','project_comments',enc(ownerComment)))[0].body,'Original owner comment')
expectAllowed(await rest('owner','project_comments','PATCH',enc(ownerComment),{body:'Edited by original owner'}),1,'author comment edit')
expectDenied(await rest('owner','project_comments','PATCH',enc(ownerComment),{user_id:people.editor.id}),'comment author forgery')
expectDenied(await rest('editor','project_comments','PATCH',enc(ownerComment),{author_name:'Impersonated'}),'author attribution forgery')
assert.equal((await rows('owner','project_comments',enc(ownerComment)))[0].user_id,people.owner.id)

expectDenied(await rest('editor','project_comments','PATCH',enc(ownerComment),{
 status:'resolved',resolved_by:people.owner.id,resolved_at:new Date().toISOString(),
}),'forged resolution actor')
expectAllowed(await rest('viewer','project_comments','PATCH',enc(ownerComment),{
 status:'resolved',resolved_by:people.viewer.id,resolved_at:new Date().toISOString(),
}),1,'viewer permitted root resolve')
expectAllowed(await rest('editor','project_comments','PATCH',enc(ownerComment),{
 status:'open',resolved_by:null,resolved_at:null,
}),1,'editor permitted root reopen')
expectDenied(await rest('outsider','project_comments','PATCH',enc(ownerComment),{body:'outsider text'}),'outsider comment edit')
console.log('PASS comment ownership, provenance, root resolve/reopen and outsider checks')

// Soft delete must work despite the original NOT EMPTY body constraint.
expectAllowed(await rest('editor','project_comments','PATCH',enc(editorComment),{
 deleted_at:new Date().toISOString(),body:'',
}),1,'author soft-delete')
expectAllowed(await rest('owner','project_comments','PATCH',enc(viewerComment),{
 deleted_at:new Date().toISOString(),body:'',
}),1,'project owner soft-delete another users comment')
assert.equal((await rows('owner','project_comments',enc(editorComment)))[0].body,'')
expectDenied(await rest('editor','project_comments','PATCH',enc(editorComment),{body:'revived'}),'deleted comment update')
console.log('PASS author/owner soft deletion and deleted-comment immutability')

// REACTIONS: only own row can be updated/deleted; other users are not targets.
expectDenied(await rest('editor','comment_reactions','PATCH',enc(ownerReaction),{emoji:'❌'}),'other user reaction UPDATE')
expectDenied(await rest('editor','comment_reactions','DELETE',enc(ownerReaction)),'other user reaction DELETE')
assert.equal((await rows('owner','comment_reactions',enc(ownerReaction))).length,1)
expectDenied(await rest('editor','comment_reactions','POST','',{
 comment_id:ownerComment,user_id:people.owner.id,emoji:'💩',
}),'reaction identity forging')
expectAllowed(await rest('editor','comment_reactions','DELETE',enc(editorReaction)),1,'delete own reaction')
expectAllowed(await rest('editor','comment_reactions','POST','',{
 comment_id:ownerComment,user_id:people.editor.id,emoji:'✅',
}),1,'insert own reaction')
console.log('PASS reaction ownership and identity checks')

// PARTICIPATION: another members completion status is not writable.
const participantQuery='thread_root_id=eq.'+ownerComment+'&user_id=eq.'+people.owner.id
expectDenied(await rest('editor','comment_participant_status','PATCH',participantQuery,{
 status:'completed',completed_at:new Date().toISOString(),
}),'edit other persons participation')
expectDenied(await rest('editor','comment_participant_status','DELETE',participantQuery),'delete other persons participation')
expectDenied(await rest('editor','comment_participant_status','POST','',{
 thread_root_id:ownerComment,user_id:people.outsider.id,status:'pending',
}),'create status for another user')
expectAllowed(await rest('editor','comment_participant_status','PATCH',
 'thread_root_id=eq.'+ownerComment+'&user_id=eq.'+people.editor.id,{
 status:'completed',completed_at:new Date().toISOString(),
}),1,'complete own participation')
console.log('PASS participant completion ownership and forged membership blocked')

// NOTIFICATIONS: actor may notify only owner or ACTIVE member of this project;
// other project, outsider, pending or forged actor are rejected.
const payload={
 user_id:people.owner.id,
 project_id:projectOne,
 document_id:docId,
 type:'comment.reply',
 actor_id:people.editor.id,
 actor_name:'Editor',
 title:'Legit notification',
 body:'Fixture only',
 link_path:'/projects/test',
}
expectDenied(await rest('editor','user_notifications','POST','',{
 ...payload,user_id:people.outsider.id,
}),'notify unrelated outsider')
expectDenied(await rest('editor','user_notifications','POST','',{
 ...payload,user_id:people.pending.id,
}),'notify inactive pending invite')
expectDenied(await rest('editor','user_notifications','POST','',{
 ...payload,user_id:people.otherOwner.id,
}),'notify another-project owner')
expectDenied(await rest('editor','user_notifications','POST','',{
 ...payload,actor_id:people.owner.id,
}),'forge notification actor')
expectDenied(await rest('editor','user_notifications','POST','',{
 ...payload,document_id:otherDocId,
}),'cross-project notification document')
// Notification sender cannot SELECT a recipient's private row, so successful
// sends must use return=minimal (as the real notify.ts client does).
const validOwnerNotification=await rest('editor','user_notifications','POST','',payload,'return=minimal')
assert(validOwnerNotification.ok,'member-to-owner notification must insert successfully')
const validViewerNotification=await rest('owner','user_notifications','POST','',{
 ...payload,user_id:people.viewer.id,actor_id:people.owner.id,
},'return=minimal')
assert(validViewerNotification.ok,'owner-to-viewer notification must insert successfully')
assert((await rows('owner','user_notifications','type=eq.comment.reply')).length>=2)
assert((await rows('viewer','user_notifications','type=eq.comment.reply')).length>=1)
assert.equal((await rows('viewer','user_notifications',enc(ownerNotification))).length,0,'viewer sees another recipient notification')
expectAllowed(await rest('owner','user_notifications','PATCH',enc(ownerNotification),{
 read_at:new Date().toISOString(),
}),1,'mark my notification read')
expectDenied(await rest('owner','user_notifications','PATCH',enc(ownerNotification),{
 title:'FAKED METADATA',
}),'notification content manipulation')
expectDenied(await rest('owner','user_notifications','PATCH',enc(ownerNotification),{
 read_at:null,
}),'notification unread reset')
assert.equal((await rows('owner','user_notifications',enc(ownerNotification)))[0].title,'Comment replied')
console.log('PASS notification recipient membership, actor forgery, read-only metadata')

// VERSIONS: editors can insert new snapshots, but neither owner nor editor can
// change an earlier version. Viewer cannot insert.
expectAllowed(await rest('editor','document_versions','POST','',{
 document_id:docId,version_number:2,version_name:'Next',content:'Second immutable version',
}),1,'editor append version')
expectDenied(await rest('editor','document_versions','PATCH',enc(oldVersion),{
 content:'TAMPERED HISTORY',
}),'editor edit past version')
expectDenied(await rest('owner','document_versions','PATCH',enc(oldVersion),{
 content:'OWNER TAMPERED HISTORY',
}),'owner edit past version')
expectDenied(await rest('viewer','document_versions','POST','',{
 document_id:docId,version_number:3,content:'VIEWER VERSION',
}),'viewer creates version')
assert.equal((await rows('owner','document_versions',enc(oldVersion)))[0].content,'Immutable first version')
console.log('PASS append-only document version history and viewer write denial')
console.log('SUCCESS isolated Supabase Auth/JWT/REST content RLS hardening')
