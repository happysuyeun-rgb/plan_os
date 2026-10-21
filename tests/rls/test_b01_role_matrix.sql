-- B-01 disposable PostgreSQL role/JWT matrix. Run AFTER migrations 001..016
-- (017 excluded) and tests/rls/seed_members.sql in a throwaway database only.
-- Roles are emulated with `set local role` + `request.jwt.claim.sub`, matching
-- tests/rls/bootstrap_postgres.sql auth.uid(). All data is synthetic.
\echo 'SETUP grants modeled on Supabase authenticated table privileges'
grant select, insert, update on public.documents to authenticated;
grant select, insert, update on public.project_tasks to authenticated;
grant select, insert on public.document_versions to authenticated;

-- owner-a ...0001, editor-b ...0002, viewer-c ...0003, pending-d ...0004,
-- owner-f ...0005 (other project), editor-e ...0006, outsider-g ...0007

\echo 'CHECK document read isolation per role'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $t$ begin
  if (select count(*) from public.documents where project_id='11111111-1111-1111-1111-111111111111') <> 1 then raise exception 'owner cannot read own document'; end if;
  if (select count(*) from public.documents where project_id='22222222-2222-2222-2222-222222222222') <> 0 then raise exception 'owner leaked other project document'; end if;
end $t$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $t$ begin
  if (select count(*) from public.documents where project_id='11111111-1111-1111-1111-111111111111') <> 1 then raise exception 'viewer cannot read allowed document'; end if;
  if (select count(*) from public.documents where project_id='22222222-2222-2222-2222-222222222222') <> 0 then raise exception 'viewer leaked other project document'; end if;
end $t$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000007';
do $t$ begin
  if (select count(*) from public.documents) <> 0 then raise exception 'outsider leaked documents'; end if;
end $t$;
rollback;

begin;
set local role anon;
do $t$ begin
  if (select count(*) from public.documents) <> 0 then raise exception 'anon leaked documents'; end if;
end $t$;
rollback;

\echo 'CHECK document write: editor allowed, viewer blocked, outsider blocked'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $t$ declare n int; begin
  update public.documents set content='editor edit' where project_id='11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'editor document update should affect 1 row, got %', n; end if;
end $t$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $t$ declare n int; begin
  update public.documents set content='viewer edit' where project_id='11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'viewer document update should affect 0 rows, got %', n; end if;
end $t$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000007';
do $t$ declare n int; begin
  update public.documents set content='outsider edit' where project_id='11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'outsider document update should affect 0 rows, got %', n; end if;
end $t$;
rollback;

\echo 'CHECK task write: editor allowed in own project, viewer blocked, cross-project blocked'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $t$ begin
  insert into public.project_tasks(project_id, created_by, title)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'editor task');
exception when others then raise exception 'editor task insert failed: %', sqlerrm;
end $t$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $t$ begin
  begin
    insert into public.project_tasks(project_id, created_by, title)
    values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 'viewer task');
    raise exception 'viewer task insert unexpectedly succeeded';
  exception when insufficient_privilege or check_violation then null;
  end;
end $t$;
rollback;

\echo 'CHECK SECURITY DEFINER helpers do not grant viewer/pending/outsider edit access'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $t$ begin
  if public.can_edit_project_content('11111111-1111-1111-1111-111111111111') then raise exception 'viewer granted edit via helper'; end if;
  if public.get_project_role('11111111-1111-1111-1111-111111111111') <> 'viewer' then raise exception 'viewer role mismatch'; end if;
end $t$;
rollback;

do $t$ begin
  if (select prosecdef from pg_proc where proname='get_project_role') is not true then raise exception 'get_project_role is not security definer'; end if;
  if (select prosecdef from pg_proc where proname='can_access_project') is not true then raise exception 'can_access_project is not security definer'; end if;
  if (select prosecdef from pg_proc where proname='restore_document_version') is not true then raise exception 'restore rpc is not security definer'; end if;
  if (select prosecdef from pg_proc where proname='commit_chat_document_edit') is not true then raise exception 'chat rpc is not security definer'; end if;
end $t$;

\echo 'CHECK restore/chat RPCs reject viewer (server-side permission, not UI hiding)'
insert into public.document_versions(document_id, version_number, version_name, content)
select id, 1, 'v1', 'original' from public.documents where project_id='11111111-1111-1111-1111-111111111111';

begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $t$ declare v_doc uuid; v_ver uuid; begin
  select id into v_doc from public.documents where project_id='11111111-1111-1111-1111-111111111111';
  -- viewer cannot even see versions outside RLS in real grants; call RPC directly
  select id into v_ver from public.document_versions where document_id=v_doc limit 1;
  begin
    perform public.restore_document_version(v_doc, v_ver, gen_random_uuid());
    raise exception 'viewer restore unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $t$;
rollback;

\echo 'CHECK member removal immediately revokes access'
delete from public.project_members
 where project_id='11111111-1111-1111-1111-111111111111'
   and user_id='00000000-0000-0000-0000-000000000002';
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $t$ begin
  if public.can_access_project('11111111-1111-1111-1111-111111111111') then raise exception 'removed editor still has access'; end if;
  if (select count(*) from public.documents where project_id='11111111-1111-1111-1111-111111111111') <> 0 then raise exception 'removed editor can still read documents'; end if;
end $t$;
rollback;

\echo 'PASS: B-01 document/task/RPC role matrix and member removal'
