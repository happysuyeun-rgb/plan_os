-- 022: Human PM plans with owner review loop and S1 task links
-- (Issue #32, F-401/F-402). Additive only: no existing table behavior is
-- changed. Conflicts that are a normal, expected outcome (stale version,
-- illegal transition) use the dedicated SQLSTATE P4001, never 40001
-- which PostgREST retries (see migrations 018/020).
--
-- State machine:
--   draft -> pending_owner_approval -> approved | rejected | needs_revision
--   rejected | needs_revision -> draft (editing reopens the draft)
--   approved is terminal for the plan; approved steps may be linked to
--   S1 tasks (project_tasks.source_plan_step_id), idempotently.
--
-- Audit events are append-only and written exclusively by triggers, so
-- no client (and no SECURITY INVOKER function) can forge or skip them.

create table public.pm_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  objective text not null check (char_length(trim(objective)) between 10 and 1000),
  source text not null default 'human' check (source in ('human', 'ai_suggested')),
  status text not null default 'draft' check (status in ('draft', 'pending_owner_approval', 'approved', 'rejected', 'needs_revision')),
  version bigint not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pm_plans_project_idx
  on public.pm_plans (project_id, updated_at desc);

create table public.pm_plan_steps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.pm_plans(id) on delete cascade,
  position integer not null check (position between 1 and 20),
  title text not null check (char_length(trim(title)) between 1 and 120),
  acceptance_criteria text not null check (char_length(trim(acceptance_criteria)) between 5 and 500),
  depends_on_step_id uuid references public.pm_plan_steps(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint pm_plan_steps_plan_position_unique unique (plan_id, position)
);
create index if not exists pm_plan_steps_plan_idx
  on public.pm_plan_steps (plan_id, position);

create table public.pm_plan_approval_events (
  id bigint generated always as identity primary key,
  plan_id uuid not null references public.pm_plans(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'draft_saved', 'approval_requested', 'approved', 'rejected',
    'needs_revision', 'step_task_linked'
  )),
  from_status text,
  to_status text,
  plan_version bigint not null,
  linked_task_id uuid references public.project_tasks(id) on delete set null,
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists pm_plan_events_plan_idx
  on public.pm_plan_approval_events (plan_id, created_at);

-- S1 link columns (nullable; existing tasks stay untouched).
alter table public.project_tasks
  add column if not exists source_plan_id uuid references public.pm_plans(id) on delete set null,
  add column if not exists source_plan_step_id uuid references public.pm_plan_steps(id) on delete set null;
create unique index if not exists project_tasks_source_step_unique
  on public.project_tasks (source_plan_step_id) where source_plan_step_id is not null;

alter table public.pm_plans enable row level security;
alter table public.pm_plan_steps enable row level security;
alter table public.pm_plan_approval_events enable row level security;

create policy "pm_plans_members_read" on public.pm_plans for select to authenticated
  using (public.can_access_project(project_id));
create policy "pm_plans_editors_create" on public.pm_plans for insert to authenticated
  with check (public.can_edit_project_content(project_id) and created_by = auth.uid());
create policy "pm_plans_editors_update" on public.pm_plans for update to authenticated
  using (public.can_edit_project_content(project_id))
  with check (public.can_edit_project_content(project_id));
-- No client DELETE policy: plans are withdrawn through status, not removal.

create policy "pm_plan_steps_members_read" on public.pm_plan_steps for select to authenticated
  using (exists (
    select 1 from public.pm_plans p
    where p.id = plan_id and public.can_access_project(p.project_id)
  ));
create policy "pm_plan_steps_editors_write" on public.pm_plan_steps for insert to authenticated
  with check (exists (
    select 1 from public.pm_plans p
    where p.id = plan_id
      and public.can_edit_project_content(p.project_id)
      and p.status in ('draft', 'rejected', 'needs_revision')
  ));
create policy "pm_plan_steps_editors_update" on public.pm_plan_steps for update to authenticated
  using (exists (
    select 1 from public.pm_plans p
    where p.id = plan_id
      and public.can_edit_project_content(p.project_id)
      and p.status in ('draft', 'rejected', 'needs_revision')
  ))
  with check (exists (
    select 1 from public.pm_plans p
    where p.id = plan_id
      and public.can_edit_project_content(p.project_id)
      and p.status in ('draft', 'rejected', 'needs_revision')
  ));
create policy "pm_plan_steps_editors_delete" on public.pm_plan_steps for delete to authenticated
  using (exists (
    select 1 from public.pm_plans p
    where p.id = plan_id
      and public.can_edit_project_content(p.project_id)
      and p.status in ('draft', 'rejected', 'needs_revision')
  ));

create policy "pm_plan_events_members_read" on public.pm_plan_approval_events for select to authenticated
  using (public.can_access_project(project_id));
-- Events are append-only: SELECT only for clients, writes are trigger-only.

grant select, insert, update on public.pm_plans to authenticated;
grant select, insert, update, delete on public.pm_plan_steps to authenticated;
grant select on public.pm_plan_approval_events to authenticated;

-- Server-side guard: tenant/actor/version/status invariants hold even for
-- direct PostgREST writes, mirroring the project_tasks pattern (011/020).
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
    or (old.status in ('rejected', 'needs_revision') and new.status = 'draft')
  ) then
    raise exception 'INVALID_PLAN_TRANSITION' using errcode = 'P4001';
  end if;
  -- Final decisions belong to the project owner even on direct writes.
  if old.status = 'pending_owner_approval'
      and new.status in ('approved', 'rejected', 'needs_revision')
      and public.get_project_role(old.project_id) is distinct from 'owner' then
    raise exception 'ONLY_OWNER_MAY_DECIDE' using errcode = '42501';
  end if;
  if old.status = 'approved' and (new.objective is distinct from old.objective) then
    raise exception 'APPROVED_PLAN_IMMUTABLE' using errcode = '23514';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
create trigger pm_plans_validate_change
before insert or update on public.pm_plans
for each row execute function public.validate_pm_plan_change();

-- Lifecycle audit: every creation, status transition, draft edit and S1
-- link is recorded server-side. The transition RPC passes its decision
-- comment through the transaction-local setting plan_os.plan_comment so
-- this trigger can attach it without any client-writable audit path.
create or replace function public.log_pm_plan_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_comment text := nullif(current_setting('plan_os.plan_comment', true), '');
begin
  if tg_op = 'INSERT' then
    if tg_table_name = 'project_tasks' then
      if new.source_plan_id is not null and new.source_plan_step_id is not null then
        insert into public.pm_plan_approval_events (
          plan_id, project_id, actor_id, event_type, from_status, to_status,
          plan_version, linked_task_id
        )
        select new.source_plan_id, new.project_id, auth.uid(), 'step_task_linked',
               p.status, p.status, p.version, new.id
          from public.pm_plans p where p.id = new.source_plan_id;
      end if;
      return new;
    end if;
    insert into public.pm_plan_approval_events (
      plan_id, project_id, actor_id, event_type, from_status, to_status, plan_version
    ) values (new.id, new.project_id, auth.uid(), 'draft_saved', null, 'draft', new.version);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.pm_plan_approval_events (
      plan_id, project_id, actor_id, event_type, from_status, to_status, plan_version, comment
    ) values (
      new.id, new.project_id, auth.uid(),
      case
        when new.status = 'pending_owner_approval' then 'approval_requested'
        when new.status = 'approved' then 'approved'
        when new.status = 'rejected' then 'rejected'
        when new.status = 'needs_revision' then 'needs_revision'
        else 'draft_saved'
      end,
      old.status, new.status, new.version, v_comment
    );
  elsif new.objective is distinct from old.objective then
    insert into public.pm_plan_approval_events (
      plan_id, project_id, actor_id, event_type, from_status, to_status, plan_version
    ) values (new.id, new.project_id, auth.uid(), 'draft_saved', old.status, new.status, new.version);
  end if;
  return new;
end;
$$;
create trigger pm_plans_log_event
after insert or update on public.pm_plans
for each row execute function public.log_pm_plan_event();
create trigger project_tasks_log_plan_link
after insert on public.project_tasks
for each row execute function public.log_pm_plan_event();

-- Atomic draft save: objective + full step replacement under one version
-- bump, so a failure can never leave a plan with half-written steps.
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
      select id into v_depends_id from public.pm_plan_steps
        where plan_id = p_plan_id and position = (v_step ->> 'depends_on_position')::int;
      update public.pm_plan_steps
        set depends_on_step_id = v_depends_id
        where plan_id = p_plan_id and position = v_position;
    end if;
  end loop;

  return v_plan;
end;
$$;
revoke all on function public.save_pm_plan_draft(uuid, bigint, text, jsonb) from public;
grant execute on function public.save_pm_plan_draft(uuid, bigint, text, jsonb) to authenticated;

-- Review transitions. Only the project owner may approve, reject or ask
-- for revision; editor/owner may request approval. The expected version
-- turns a stale decision into an immediate P4001 conflict. Approval is
-- only a recorded decision: it never queues AI execution or billing.
create or replace function public.transition_pm_plan(
  p_plan_id uuid,
  p_expected_version bigint,
  p_action text,
  p_comment text default null
)
returns public.pm_plans
language plpgsql security invoker set search_path = public as $$
declare
  v_plan public.pm_plans%rowtype;
  v_target text;
begin
  select * into v_plan from public.pm_plans where id = p_plan_id for update;
  if not found then
    raise exception 'PLAN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not coalesce(public.can_edit_project_content(v_plan.project_id), false) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  v_target := case p_action
    when 'request_approval' then 'pending_owner_approval'
    when 'approve' then 'approved'
    when 'reject' then 'rejected'
    when 'needs_revision' then 'needs_revision'
    else null
  end;
  if v_target is null then
    raise exception 'INVALID_PLAN_ACTION' using errcode = '22023';
  end if;
  if p_action in ('approve', 'reject', 'needs_revision')
      and public.get_project_role(v_plan.project_id) is distinct from 'owner' then
    raise exception 'ONLY_OWNER_MAY_DECIDE' using errcode = '42501';
  end if;
  if v_plan.version <> p_expected_version then
    raise exception 'PLAN_VERSION_CONFLICT' using errcode = 'P4001';
  end if;
  if not (
    (v_plan.status = 'draft' and v_target = 'pending_owner_approval')
    or (v_plan.status = 'pending_owner_approval' and v_target in ('approved', 'rejected', 'needs_revision'))
    or (v_plan.status in ('rejected', 'needs_revision') and v_target = 'pending_owner_approval')
  ) then
    raise exception 'INVALID_PLAN_TRANSITION' using errcode = 'P4001';
  end if;

  if p_comment is not null then
    perform set_config('plan_os.plan_comment', p_comment, true);
  end if;
  update public.pm_plans
    set status = v_target, version = v_plan.version + 1
    where id = p_plan_id
    returning * into v_plan;
  perform set_config('plan_os.plan_comment', '', true);
  return v_plan;
end;
$$;
revoke all on function public.transition_pm_plan(uuid, bigint, text, text) from public;
grant execute on function public.transition_pm_plan(uuid, bigint, text, text) to authenticated;

-- Idempotent plan-step -> S1 task link. The approved plan is the only
-- source; re-running returns the already-created task instead of
-- duplicating it.
create or replace function public.link_pm_plan_step_to_task(p_step_id uuid)
returns public.project_tasks
language plpgsql security invoker set search_path = public as $$
declare
  v_step public.pm_plan_steps%rowtype;
  v_plan public.pm_plans%rowtype;
  v_existing public.project_tasks%rowtype;
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

  select * into v_existing from public.project_tasks
    where source_plan_step_id = p_step_id limit 1;
  if found then
    return v_existing;
  end if;

  insert into public.project_tasks (
    project_id, created_by, title, objective, acceptance_criteria,
    assignee_user_id, source_plan_id, source_plan_step_id
  ) values (
    v_plan.project_id, auth.uid(), v_step.title, v_plan.objective,
    jsonb_build_array(v_step.acceptance_criteria), null, v_plan.id, v_step.id
  )
  returning * into v_task;
  return v_task;
end;
$$;
revoke all on function public.link_pm_plan_step_to_task(uuid) from public;
grant execute on function public.link_pm_plan_step_to_task(uuid) to authenticated;
