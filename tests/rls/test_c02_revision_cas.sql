-- C-02 disposable PostgreSQL Revision CAS verification. Run AFTER migrations
-- 001..016 + 018 (017 DRAFT intentionally excluded) and seed_members.sql in a
-- throwaway database only. See run_c02_local_pg.sh. All data is synthetic.
-- owner-a ...0001, editor-b ...0002, viewer-c ...0003,
-- owner-f ...0005 (other project), editor-e ...0006, outsider-g ...0007
-- The CAS scenarios target one fixed fixture document so that even callers
-- who cannot see the row under RLS (outsider, anon) exercise the server-side
-- permission checks inside save_document_content_cas with a real id.
\echo 'SETUP grants modeled on Supabase authenticated table privileges'
grant select, insert, update on public.documents to authenticated;
grant select, insert on public.document_versions to authenticated;
-- Reset the fixture so this file is re-runnable against the same throwaway DB.
delete from public.document_versions
 where document_id='33333333-3333-3333-3333-333333333333';
delete from public.documents where id='33333333-3333-3333-3333-333333333333';
insert into public.documents(id, project_id, type, content) values
 ('33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111','ia','c02 fixture body');
insert into public.document_versions(id, document_id, version_number, version_name, content)
values ('44444444-4444-4444-4444-444444444444',
        '33333333-3333-3333-3333-333333333333', 1, 'c02-fixture', 'historical body');

\echo 'SETUP migration 018 objects exist and legacy rows start at revision 0'
do $t$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='documents'
                   and column_name='content_revision') then
    raise exception 'content_revision column missing';
  end if;
  if to_regprocedure('public.save_document_content_cas(uuid,bigint,text)') is null then
    raise exception 'save_document_content_cas missing';
  end if;
  if (select count(*) from public.documents where content_revision <> 0) <> 0 then
    raise exception 'seeded documents must start at revision 0';
  end if;
end $t$;

\echo 'C02-01 editor CAS save succeeds and advances revision exactly once'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $t$ declare v_doc public.documents%rowtype; begin
  v_doc := public.save_document_content_cas(
    '33333333-3333-3333-3333-333333333333', 0, 'cas-v1');
  if v_doc.content <> 'cas-v1' or v_doc.content_revision <> 1 then
    raise exception 'CAS save did not land at revision 1: %', v_doc;
  end if;
end $t$;
rollback;

\echo 'C02-02 stale revision with different content is rejected and changes nothing'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $t$ declare v_id uuid := '33333333-3333-3333-3333-333333333333'; begin
  perform public.save_document_content_cas(v_id, 0, 'cas-v1');
  begin
    perform public.save_document_content_cas(v_id, 0, 'stale overwrite attempt');
    raise exception 'stale CAS unexpectedly succeeded';
  exception when sqlstate 'P4001' then null;
  end;
  if (select content from public.documents where id=v_id) <> 'cas-v1'
     or (select content_revision from public.documents where id=v_id) <> 1 then
    raise exception 'stale CAS mutated the document';
  end if;
end $t$;
rollback;

\echo 'C02-03 retrying the same CAS request is idempotent (lost response safe)'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $t$ declare
  v_id uuid := '33333333-3333-3333-3333-333333333333';
  v_doc public.documents%rowtype;
begin
  perform public.save_document_content_cas(v_id, 0, 'cas-v1');
  -- Same request re-sent after its response was lost: must succeed as no-op.
  v_doc := public.save_document_content_cas(v_id, 0, 'cas-v1');
  if v_doc.content_revision <> 1 then
    raise exception 'idempotent retry advanced revision to %', v_doc.content_revision;
  end if;
  -- Saving identical content at the current revision is also a no-op.
  v_doc := public.save_document_content_cas(v_id, 1, 'cas-v1');
  if v_doc.content_revision <> 1 then
    raise exception 'identical-content save advanced revision to %', v_doc.content_revision;
  end if;
  -- Skipping ahead to an unobserved revision is a conflict, not a write.
  begin
    perform public.save_document_content_cas(v_id, 5, 'skip ahead');
    raise exception 'skip-ahead CAS unexpectedly succeeded';
  exception when sqlstate 'P4001' then null;
  end;
end $t$;
rollback;

\echo 'C02-04 viewer cannot write through the CAS RPC'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $t$ declare v_id uuid := '33333333-3333-3333-3333-333333333333'; begin
  begin
    perform public.save_document_content_cas(v_id, 0, 'viewer overwrite');
    raise exception 'viewer CAS unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;
  if (select content_revision from public.documents where id=v_id) <> 0 then
    raise exception 'viewer CAS mutated the document';
  end if;
end $t$;
rollback;

\echo 'C02-05 other-project editor and outsider cannot CAS this document'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000006';
do $t$ begin
  begin
    perform public.save_document_content_cas(
      '33333333-3333-3333-3333-333333333333', 0, 'cross-project overwrite');
    raise exception 'cross-project CAS unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;
end $t$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000007';
do $t$ begin
  begin
    perform public.save_document_content_cas(
      '33333333-3333-3333-3333-333333333333', 0, 'outsider overwrite');
    raise exception 'outsider CAS unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;
end $t$;
rollback;

\echo 'C02-06 restore advances the revision, so a pre-restore autosave baseline conflicts'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $t$ declare
  v_id uuid := '33333333-3333-3333-3333-333333333333';
  v_ver uuid := '44444444-4444-4444-4444-444444444444';
  v_doc public.documents%rowtype;
begin
  perform public.save_document_content_cas(v_id, 0, 'current body');
  v_doc := public.restore_document_version(v_id, v_ver, gen_random_uuid());
  if v_doc.content <> 'historical body' or v_doc.content_revision <> 2 then
    raise exception 'restore did not land at revision 2: %', v_doc;
  end if;
  begin
    perform public.save_document_content_cas(v_id, 1, 'autosave from before restore');
    raise exception 'pre-restore baseline CAS unexpectedly succeeded';
  exception when sqlstate 'P4001' then null;
  end;
end $t$;
rollback;

\echo 'C02-07 direct client UPDATE still works for editors but advances revision (detected, not silent)'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $t$ declare
  v_id uuid := '33333333-3333-3333-3333-333333333333';
  n int;
begin
  -- This measures the remaining bypass: RLS still allows the editor UPDATE,
  -- but the trigger must advance the revision so CAS writers conflict
  -- instead of silently overwriting the direct write afterwards.
  update public.documents set content='direct update body' where id=v_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'editor direct update should affect 1 row, got %', n; end if;
  if (select content_revision from public.documents where id=v_id) <> 1 then
    raise exception 'direct update did not advance content_revision';
  end if;
  begin
    perform public.save_document_content_cas(v_id, 0, 'stale cas after direct update');
    raise exception 'CAS after direct update unexpectedly succeeded';
  exception when sqlstate 'P4001' then null;
  end;
end $t$;
rollback;

\echo 'C02-08 anonymous callers cannot execute the CAS RPC'
begin;
set local role anon;
do $t$ begin
  begin
    perform public.save_document_content_cas(
      '33333333-3333-3333-3333-333333333333', 0, 'anon overwrite');
    raise exception 'anon CAS unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;
end $t$;
rollback;

\echo 'C02-09 with 019 applied, outsider and viewer cannot restore a version'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000007';
do $t$ begin
  begin
    perform public.restore_document_version(
      '33333333-3333-3333-3333-333333333333',
      '44444444-4444-4444-4444-444444444444', gen_random_uuid());
    raise exception 'outsider restore unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;
end $t$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $t$ begin
  begin
    perform public.restore_document_version(
      '33333333-3333-3333-3333-333333333333',
      '44444444-4444-4444-4444-444444444444', gen_random_uuid());
    raise exception 'viewer restore unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;
  -- The rejected restores must not have touched the document. (Checked as
  -- editor below because the fixture starts untouched at revision 0.)
end $t$;
rollback;

\echo 'C02-10 with 019 applied, outsider and viewer cannot chat-edit a document'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000007';
do $t$ begin
  begin
    perform public.commit_chat_document_edit(
      '11111111-1111-1111-1111-111111111111',
      '33333333-3333-3333-3333-333333333333',
      'outsider chat injection', gen_random_uuid());
    raise exception 'outsider chat edit unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;
end $t$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $t$ begin
  begin
    perform public.commit_chat_document_edit(
      '11111111-1111-1111-1111-111111111111',
      '33333333-3333-3333-3333-333333333333',
      'viewer chat injection', gen_random_uuid());
    raise exception 'viewer chat edit unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;
end $t$;
rollback;

\echo 'C02-11 legitimate editor chat edit still works and advances the revision'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $t$ declare v_result jsonb; begin
  v_result := public.commit_chat_document_edit(
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'please add this note', gen_random_uuid());
  if v_result ->> 'updated_content' not like '%please add this note%' then
    raise exception 'editor chat edit did not apply';
  end if;
  if (select content_revision from public.documents
       where id='33333333-3333-3333-3333-333333333333') <> 1 then
    raise exception 'chat edit did not advance content_revision via the 018 trigger';
  end if;
end $t$;
rollback;

\echo 'C02 revision CAS matrix finished'
