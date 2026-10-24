-- 023: PM plan integrity hardening after independent review (Issue #32).
-- Fixes the bypass paths left open by 022:
--   P0-1 plans under review could be rewritten by direct PATCH
--   P0-2 S1 task source columns could be forged by direct writes
--   P1-1 plan creation was not atomic or idempotent
--   P1-2 review-state transition maps disagreed (RPC vs trigger vs UI)
--   P1-3 direct step edits skipped plan version bumps and audit events
--   P1-4 concurrent step linking could fail instead of returning the task
--   plus cross-plan/cyclic step dependencies were not rejected.
-- Like 022, normal conflicts use P4001, never 40001.

-- 1) One transition map everywhere, and locked content while a plan is
--    under review or approved. Only status transitions may touch a plan
--    in pending_owner_approval; an approved plan is immutable.
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
      or new.source is distinct from old.source then
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
  -- Final decisions belong to the project owner even on direct writes.
  if old.status = 'pending_owner_approval'
      and new.status in ('approved', 'rejected', 'needs_revision')
      and public.get_project_role(old.project_id) is distinct from 'owner' then
    raise exception 'ONLY_OWNER_MAY_DECIDE' using errcode = '42501';
  end if;
  -- Review integrity: while approval is pending, the reviewed content
  -- must stay byte-identical to what was submitted. Transitions are the
  -- only writes the review RPC performs in this state.
  if old.status = 'pending_owner_approval' and new.status is not distinct from old.status then
    raise exception 'PLAN_LOCKED_WHILE_PENDING' using errcode = '23514';
  end if;
  if old.status = 'approved' then
    raise exception 'APPROVED_PLAN_IMMUTABLE' using errcode = '23514';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

-- 2) Idempotent, atomic plan creation. A client-generated request id
--    makes response-loss retries return the original plan instead of
--    creating a duplicate, and the whole draft lands in one transaction.
alter table public.pm_plans
  add column if not exists client_request_id uuid;
create unique index if not exists pm_plans_client_request_unique
  on public.pm_plans (created_by, client_request_id)
  where client_request_id is not null;

create or replace function public.create_pm_plan(
  p_project_id uuid,
  p_objective text,
  p_steps jsonb,
  p_client_request_id uuid
)
returns public.pm_plans
language plpgsql security invoker set search_path = public as $$
declare
  v_existing public.pm_plans%rowtype;
  v_plan public.pm_plans%rowtype;
  v_step jsonb;
  v_position int := 0;
  v_depends_position int;
begin
  if not coalesce(public.can_edit_project_content(p_project_id), false) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) < 1 or jsonb_array_length(p_steps) > 20 then
    raise exception 'INVALID_PLAN_STEPS' using errcode = '23514';
  end if;

  select * into v_existing from public.pm_plans
    where created_by = auth.uid() and client_request_id = p_client_request_id;
  if found then
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
    if (v_step ->> 'depends_on_position') is not null then
      v_depends_position := (v_step ->> 'depends_on_position')::int;
      if v_depends_position < 1 or v_depends_position >= v_position then
        raise exception 'INVALID_STEP_DEPENDENCY' using errcode = '23514';
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
exception
  when unique_violation then
    -- A racing retry with the same request id already committed.
    perform set_config('plan_os.suppress_step_bump', '', true);
    select * into v_existing from public.pm_plans
      where created_by = auth.uid() and client_request_id = p_client_request_id;
    if found then
      return v_existing;
    end if;
    raise;
end;
$$;
revoke all on function public.create_pm_plan(uuid, text, jsonb, uuid) from public;
grant execute on function public.create_pm_plan(uuid, text, jsonb, uuid) to authenticated;

-- 3) Atomic draft save gains the step-bump suppression (its own version
--    bump is authoritative) and strict dependency range checks.
create or replace function public.save_pm_plan_draft(
  p_plan_id uuid,
  p_expected_version bigint,
  p_objective text,
  p_steps jsonb
)
returns public.pm_plans
language plpgsql security invoker set search_path = public as $$
declare
  v_plan public.pm_plans%rowtype;
  v_step jsonb;
  v_position int := 0;
  v_depends_position int;
  v_depends_id uuid;
begin
  select * into v_plan from public.pm_plans where id = p_plan_id for update;
  if not found then
    raise exception 'PLAN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not coalesce(public.can_edit_project_content(v_plan.project_id), false) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_plan.status not in ('draft', 'rejected', 'needs_revision') then
    raise exception 'PLAN_NOT_EDITABLE' using errcode = 'P4001';
  end if;
  if v_plan.version <> p_expected_version then
    raise exception 'PLAN_VERSION_CONFLICT' using errcode = 'P4001';
  end if;
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) < 1 or jsonb_array_length(p_steps) > 20 then
    raise exception 'INVALID_PLAN_STEPS' using errcode = '23514';
  end if;

  perform set_config('plan_os.suppress_step_bump', '1', true);

  update public.pm_plans
    set objective = p_objective,
        status = case when v_plan.status in ('rejected', 'needs_revision') then 'draft' else v_plan.status end,
        version = v_plan.version + 1
    where id = p_plan_id
    returning * into v_plan;

  delete from public.pm_plan_steps where plan_id = p_plan_id;
  for v_step in select * from jsonb_array_elements(p_steps) loop
    v_position := v_position + 1;
    insert into public.pm_plan_steps (plan_id, position, title, acceptance_criteria)
    values (
      p_plan_id,
      v_position,
      v_step ->> 'title',
      v_step ->> 'acceptance_criteria'
    );
  end loop;
  -- Second pass wires dependencies by 1-based position so FK targets exist.
  v_position := 0;
  for v_step in select * from jsonb_array_elements(p_steps) loop
    v_position := v_position + 1;
    if (v_step ->> 'depends_on_position') is not null then
      v_depends_position := (v_step ->> 'depends_on_position')::int;
      if v_depends_position < 1 or v_depends_position >= v_position then
        raise exception 'INVALID_STEP_DEPENDENCY' using errcode = '23514';
      end if;
      select id into v_depends_id from public.pm_plan_steps
        where plan_id = p_plan_id and position = v_depends_position;
      update public.pm_plan_steps
        set depends_on_step_id = v_depends_id
        where plan_id = p_plan_id and position = v_position;
    end if;
  end loop;

  perform set_config('plan_os.suppress_step_bump', '', true);
  return v_plan;
end;
$$;
revoke all on function public.save_pm_plan_draft(uuid, bigint, text, jsonb) from public;
grant execute on function public.save_pm_plan_draft(uuid, bigint, text, jsonb) to authenticated;

-- 4) Direct step edits keep the parent plan version and audit in sync.
--    Server save/create flows suppress this because they bump once
--    authoritatively for the whole replacement.
create or replace function public.touch_pm_plan_after_step_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_plan_id uuid := coalesce(new.plan_id, old.plan_id);
begin
  if coalesce(current_setting('plan_os.suppress_step_bump', true), '') = '1' then
    return coalesce(new, old);
  end if;
  update public.pm_plans
    set version = version + 1
    where id = v_plan_id;
  insert into public.pm_plan_approval_events (
    plan_id, project_id, actor_id, event_type, from_status, to_status, plan_version
  )
  select v_plan_id, p.project_id, auth.uid(), 'draft_saved', p.status, p.status, p.version
    from public.pm_plans p where p.id = v_plan_id;
  return coalesce(new, old);
end;
$$;
create trigger pm_plan_steps_touch_plan
after insert or update or delete on public.pm_plan_steps
for each row execute function public.touch_pm_plan_after_step_change();

-- 5) Step dependencies must stay inside the plan, stay acyclic and stay
--    shallow. Client-generated step ids cannot smuggle another plan's
--    step in as a dependency.
create or replace function public.validate_pm_plan_step_dependency()
returns trigger language plpgsql set search_path = public as $$
declare
  v_cursor uuid;
  v_guard int := 0;
begin
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
create trigger pm_plan_steps_validate_dependency
before insert or update on public.pm_plan_steps
for each row execute function public.validate_pm_plan_step_dependency();

-- 6) Task source columns are server-owned. Clients can neither set them
--    on direct writes nor change them afterwards; only the link RPC may
--    create a linked task, and even then the link must point at an
--    approved step of the same plan and project.
create or replace function public.guard_project_task_source()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.source_plan_id is distinct from old.source_plan_id
        or new.source_plan_step_id is distinct from old.source_plan_step_id then
      raise exception 'TASK_SOURCE_IMMUTABLE' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.source_plan_id is null and new.source_plan_step_id is null then
    return new;
  end if;
  if coalesce(current_setting('plan_os.plan_link_write', true), '') <> '1' then
    raise exception 'TASK_SOURCE_FORBIDDEN' using errcode = '42501';
  end if;
  if new.source_plan_id is null or new.source_plan_step_id is null then
    raise exception 'TASK_SOURCE_INCOMPLETE' using errcode = '23514';
  end if;
  if not exists (
    select 1
      from public.pm_plans p
      join public.pm_plan_steps s on s.plan_id = p.id
     where p.id = new.source_plan_id
       and s.id = new.source_plan_step_id
       and p.project_id = new.project_id
       and p.status = 'approved'
  ) then
    raise exception 'TASK_SOURCE_INVALID' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger project_tasks_guard_source
before insert or update on public.project_tasks
for each row execute function public.guard_project_task_source();

-- 7) Concurrent links of the same step now both succeed with the same
--    task id: the loser of the unique race reads back the winner's row.
create or replace function public.link_pm_plan_step_to_task(p_step_id uuid)
returns public.project_tasks
language plpgsql security invoker set search_path = public as $$
declare
  v_step public.pm_plan_steps%rowtype;
  v_plan public.pm_plans%rowtype;
  v_task public.project_tasks%rowtype;
begin
  select * into v_step from public.pm_plan_steps where id = p_step_id;
  if not found then
    raise exception 'PLAN_STEP_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into v_plan from public.pm_plans where id = v_step.plan_id;
  if not coalesce(public.can_edit_project_content(v_plan.project_id), false) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_plan.status <> 'approved' then
    raise exception 'PLAN_NOT_APPROVED' using errcode = 'P4001';
  end if;

  perform set_config('plan_os.plan_link_write', '1', true);
  insert into public.project_tasks (
    project_id, created_by, title, objective, acceptance_criteria,
    assignee_user_id, source_plan_id, source_plan_step_id
  ) values (
    v_plan.project_id, auth.uid(), v_step.title, v_plan.objective,
    jsonb_build_array(v_step.acceptance_criteria), null, v_plan.id, v_step.id
  )
  on conflict (source_plan_step_id) where source_plan_step_id is not null
  do nothing
  returning * into v_task;
  perform set_config('plan_os.plan_link_write', '', true);

  if v_task.id is null then
    select * into v_task from public.project_tasks
      where source_plan_step_id = p_step_id;
  end if;
  return v_task;
end;
$$;
revoke all on function public.link_pm_plan_step_to_task(uuid) from public;
grant execute on function public.link_pm_plan_step_to_task(uuid) to authenticated;
