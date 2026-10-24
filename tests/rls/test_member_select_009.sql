-- Disposable CI Postgres: role-based authorization tests AFTER migration 009.
-- All session roles/claims are synthetic. Rollbacks prevent fixture mutation.
\echo 'CHECK owner sees 3 members in own project and no rows in other project'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $test$
begin
  if (select count(*) from public.project_members where project_id='11111111-1111-1111-1111-111111111111') <> 3 then
    raise exception 'owner cannot read all three own-project members';
  end if;
  if (select count(*) from public.project_members where project_id='22222222-2222-2222-2222-222222222222') <> 0 then
    raise exception 'owner leaked other project members';
  end if;
end;
$test$;
rollback;

\echo 'CHECK editor sees same project roster and cannot see other projects'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $test$
begin
  if (select count(*) from public.project_members where project_id='11111111-1111-1111-1111-111111111111') <> 3 then
    raise exception 'editor cannot read project roster';
  end if;
  if (select count(*) from public.project_members where project_id='22222222-2222-2222-2222-222222222222') <> 0 then
    raise exception 'editor leaked unrelated project members';
  end if;
  if not public.can_edit_project_content('11111111-1111-1111-1111-111111111111') then
    raise exception 'editor content permission unexpectedly denied';
  end if;
end;
$test$;
rollback;

\echo 'CHECK viewer sees roster but not editing access or other projects'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $test$
begin
  if (select count(*) from public.project_members where project_id='11111111-1111-1111-1111-111111111111') <> 3 then
    raise exception 'viewer project roster denied';
  end if;
  if (select count(*) from public.project_members where project_id='22222222-2222-2222-2222-222222222222') <> 0 then
    raise exception 'viewer leaked unrelated project members';
  end if;
  if public.can_edit_project_content('11111111-1111-1111-1111-111111111111') then
    raise exception 'viewer was granted editing rights';
  end if;
end;
$test$;
rollback;

\echo 'CHECK pending invite can see OWN pending row only (preserve old behavior)'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
do $test$
begin
  if (select count(*) from public.project_members where project_id='11111111-1111-1111-1111-111111111111') <> 1 then
    raise exception 'pending user either lost own invite or saw other members';
  end if;
  if (select count(*) from public.project_members where project_id='11111111-1111-1111-1111-111111111111' and user_id='00000000-0000-0000-0000-000000000004') <> 1 then
    raise exception 'pending user own invite not visible';
  end if;
  if public.can_access_project('11111111-1111-1111-1111-111111111111') then
    raise exception 'pending invite incorrectly grants project access';
  end if;
  if (select count(*) from public.documents where project_id='11111111-1111-1111-1111-111111111111') <> 0 then
    raise exception 'pending invite can read documents';
  end if;
end;
$test$;
rollback;

\echo 'CHECK other-project owner and member are isolated from first project'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
do $test$
begin
  if (select count(*) from public.project_members where project_id='22222222-2222-2222-2222-222222222222') <> 1 then
    raise exception 'other project owner cannot view own team';
  end if;
  if (select count(*) from public.project_members where project_id='11111111-1111-1111-1111-111111111111') <> 0 then
    raise exception 'other project owner leaked first project team';
  end if;
end;
$test$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000006';
do $test$
begin
  if (select count(*) from public.project_members where project_id='22222222-2222-2222-2222-222222222222') <> 1 then
    raise exception 'other project editor cannot view own team';
  end if;
  if (select count(*) from public.project_members where project_id='11111111-1111-1111-1111-111111111111') <> 0 then
    raise exception 'other project editor leaked first project team';
  end if;
end;
$test$;
rollback;

\echo 'CHECK complete outsider and anonymous role see no member rows'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000007';
do $test$
begin
  if (select count(*) from public.project_members) <> 0 then
    raise exception 'outsider leaked project membership';
  end if;
end;
$test$;
rollback;

begin;
set local role anon;
do $test$
begin
  if (select count(*) from public.project_members) <> 0 then
    raise exception 'anonymous user leaked project membership';
  end if;
end;
$test$;
rollback;

\echo 'PASS: member RLS role isolation and pending-invite compatibility'
