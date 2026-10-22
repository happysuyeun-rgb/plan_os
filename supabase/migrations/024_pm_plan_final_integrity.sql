-- Final integrity hardening for the PM plan review loop (2026-10-22
-- independent re-review, PM-RECHECK-01..03). 022/023 stay untouched;
-- this migration only replaces the guard functions and the creation
-- RPC, locks step ownership, and adds concurrency protection.
-- Like 019/020/023, normal conflicts use P4001, never 40001 (PostgREST
-- retries 40001 and turns a fast rejection into a proxy timeout).

-- 1) Review snapshot integrity (RECHECK-01): even during an allowed
--    status transition, the reviewed content may not change. Content,
--    tenant, source and the idempotency key are immutable on every
--    UPDATE; only status transitions and (in draft-like states) the
--    objective edit performed by the save RPC may change a plan.
create or replace function public.validate_pm_plan_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.version <> 1 then
      raise exception 'INVALID_PLAN_INITIAL_STATE' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.project_id is distinct from old.project_id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
      or new.source is distinct from old.source
      or new.client_request_id is distinct from old.client_request_id then
    raise exception 'IMMUTABLE_PLAN_FIELDS' using errcode = '23514';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'PLAN_VERSION_CONFLICT' using errcode = 'P4001';
  end if;
  if new.status is distinct from old.status and not (
    (old.status = 'draft' and new.status = 'pending_owner_approval')
    or (old.status = 'pending_owner_approval' and new.status in ('approved', 'rejected', 'needs_revision'))
    or (old.status in ('rejected', 'needs_revision') and new.status in ('draft', 'pending_owner_approval'))
  ) then
    raise exception 'INVALID_PLAN_TRANSITION' using errcode = 'P4001';
  end if;
  -- A transition may never smuggle a content change: the reviewed text
  -- must be byte-identical to what was submitted for approval.
  if new.status is distinct from old.status
      and new.objective is distinct from old.objective then
    raise exception 'PLAN_CONTENT_CHANGE_WITH_TRANSITION' using errcode = '23514';
  end if;
  -- Content edits are draft-only: while approval is pending or granted,
  -- a non-transition write is a review bypass.
  if old.status in ('pending_owner_approval', 'approved')
      and new.status is not distinct from old.status then
    raise exception 'PLAN_LOCKED_WHILE_PENDING' using errcode = '23514';
  end if;
  -- Final decisions belong to the project owner even on direct writes.
  if old.status = 'pending_owner_approval'
      and new.status in ('approved', 'rejected', 'needs_revision')
      and public.get_project_role(old.project_id) is distinct from 'owner' then
    raise exception 'ONLY_OWNER_MAY_DECIDE' using errcode = '42501';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

-- 2) Step ownership integrity (RECHECK-02): a step never moves to
--    another plan. RLS allows step writes only while the parent plan is
--    editable, and the guard additionally rejects cross-plan moves and
--    writes once the parent is under review or approved.
create or replace function public.validate_pm_plan_step_dependency()
returns trigger language plpgsql set search_path = public as $$
declare
  v_cursor uuid;
  v_guard int := 0;
  v_plan_status text;
begin
  if tg_op = 'UPDATE' and new.plan_id is distinct from old.plan_id then
    raise exception 'STEP_PLAN_IMMUTABLE' using errcode = '23514';
  end if;
  select status into v_plan_status from public.pm_plans where id = new.plan_id;
  if v_plan_status in ('pending_owner_approval', 'approved') then
    raise exception 'PLAN_STEPS_LOCKED' using errcode = '23514';
  end if;
  if new.depends_on_step_id is null then
    return new;
  end if;
  if new.depends_on_step_id = new.id then
    raise exception 'STEP_SELF_DEPENDENCY' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.pm_plan_steps
    where id = new.depends_on_step_id and plan_id = new.plan_id
  ) then
    raise exception 'STEP_DEPENDENCY_FOREIGN_PLAN' using errcode = '23514';
  end if;
  v_cursor := new.depends_on_step_id;
  while v_cursor is not null loop
    if v_cursor = new.id then
      raise exception 'STEP_DEPENDENCY_CYCLE' using errcode = '23514';
    end if;
    v_guard := v_guard + 1;
    if v_guard > 20 then
      raise exception 'STEP_DEPENDENCY_TOO_DEEP' using errcode = '23514';
    end if;
    select depends_on_step_id into v_cursor
      from public.pm_plan_steps where id = v_cursor;
  end loop;
  return new;
end;
$$;

create or replace function public.guard_pm_plan_step_delete()
returns trigger language plpgsql set search_path = public as $$
declare
  v_plan_status text;
begin
  select status into v_plan_status from public.pm_plans where id = old.plan_id;
  if v_plan_status in ('pending_owner_approval', 'approved') then
    raise exception 'PLAN_STEPS_LOCKED' using errcode = '23514';
  end if;
  return old;
end;
$$;
drop trigger if exists pm_plan_steps_guard_delete on public.pm_plan_steps;
create trigger pm_plan_steps_guard_delete
before delete on public.pm_plan_steps
for each row execute function public.guard_pm_plan_step_delete();

-- 3) Idempotency integrity (RECHECK-03): the request key is mandatory
--    and tuple-bound. Reusing one key with a different project or
--    payload conflicts instead of returning the original plan as if
--    nothing happened. Concurrent retries serialize on the advisory
--    lock so exactly one insert happens.
create or replace function public.create_pm_plan(
  p_project_id uuid,
  p_objective text,
  p_steps jsonb,
  p_client_request_id uuid
)
returns public.pm_plans
language plpgsql security definer set search_path = public as $$
declare
  v_existing public.pm_plans%rowtype;
  v_plan public.pm_plans%rowtype;
  v_step jsonb;
  v_position int := 0;
  v_depends_position int;
begin
  -- SECURITY DEFINER is required because direct INSERT on pm_plans is
  -- revoked below; authorization is re-checked explicitly against
  -- auth.uid() before any row is written.
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  if p_project_id is null or p_client_request_id is null then
    raise exception 'INVALID_PLAN_REQUEST' using errcode = '22023';
  end if;
  if nullif(trim(p_objective), '') is null
      or char_length(trim(p_objective)) < 10 or char_length(p_objective) > 1000 then
    raise exception 'INVALID_PLAN_OBJECTIVE' using errcode = '23514';
  end if;
  if not coalesce(public.can_edit_project_content(p_project_id), false) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) < 1 or jsonb_array_length(p_steps) > 20 then
    raise exception 'INVALID_PLAN_STEPS' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    auth.uid()::text || ':' || p_client_request_id::text, 0));

  select * into v_existing from public.pm_plans
    where created_by = auth.uid() and client_request_id = p_client_request_id;
  if found then
    if v_existing.project_id is distinct from p_project_id
        or v_existing.objective is distinct from p_objective
        or (select count(*) from public.pm_plan_steps s where s.plan_id = v_existing.id)
           is distinct from jsonb_array_length(p_steps) then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '23505';
    end if;
    return v_existing;
  end if;

  perform set_config('plan_os.suppress_step_bump', '1', true);

  insert into public.pm_plans (project_id, objective, source, created_by, client_request_id)
  values (p_project_id, p_objective, 'human', auth.uid(), p_client_request_id)
  returning * into v_plan;

  for v_step in select * from jsonb_array_elements(p_steps) loop
    v_position := v_position + 1;
    insert into public.pm_plan_steps (plan_id, position, title, acceptance_criteria)
    values (
      v_plan.id,
      v_position,
      v_step ->> 'title',
      v_step ->> 'acceptance_criteria'
    );
  end loop;

  v_position := 0;
  for v_step in select * from jsonb_array_elements(p_steps) loop
    v_position := v_position + 1;
    v_depends_position := nullif(v_step ->> 'depends_on_position', '')::int;
    if v_depends_position is not null then
      if v_depends_position < 1 or v_depends_position >= v_position then
        raise exception 'STEP_DEPENDENCY_FOREIGN_PLAN' using errcode = '23514';
      end if;
      update public.pm_plan_steps s
        set depends_on_step_id = dep.id
        from public.pm_plan_steps dep
        where s.plan_id = v_plan.id and s.position = v_position
          and dep.plan_id = v_plan.id and dep.position = v_depends_position;
    end if;
  end loop;

  perform set_config('plan_os.suppress_step_bump', '', true);
  return v_plan;
end;
$$;

-- Plans may only come into existence through create_pm_plan() so a raw
-- table insert can never leave a partial plan behind.
drop policy if exists "pm_plans_editors_create" on public.pm_plans;
revoke insert on public.pm_plans from authenticated;
revoke all on function public.create_pm_plan(uuid, text, jsonb, uuid) from public;
grant execute on function public.create_pm_plan(uuid, text, jsonb, uuid) to authenticated;
