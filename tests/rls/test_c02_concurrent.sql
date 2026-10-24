-- C-02 true-concurrency probe. run_c02_local_pg.sh launches two copies of
-- this file at the same time against the same document revision; exactly
-- one may commit. psql variables: doc_id, expected_rev, body, claim_sub.
-- With ON_ERROR_STOP the losing session exits non-zero on SQLSTATE P4001.
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'claim_sub';
select id, content_revision
  from public.save_document_content_cas(:'doc_id'::uuid, :expected_rev::bigint, :'body');
commit;
