-- S1 isolated development migration. Do NOT apply to production before review.
create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  assignee_user_id uuid references auth.users(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 120),
  objective text not null default '',
  status text not null default 'todo'
    check (status in ('todo','in_progress','in_review','blocked','done')),
  blocked_reason text,
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blocked_requires_reason check (
    (status = 'blocked' and nullif(trim(blocked_reason), '') is not null)
    or (status <> 'blocked' and blocked_reason is null)
  )
);
create index if not exists project_tasks_active_idx
  on public.project_tasks (project_id, updated_at desc) where deleted_at is null;
alter table public.project_tasks enable row level security;
create or replace function public.is_valid_task_assignee(p_project_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $
  select p_user_id is null or exists (
    select 1 from public.projects p where p.id = p_project_id and p.deleted_at is null and p.user_id = p_user_id
  ) or exists (
    select 1 from public.project_members pm where pm.project_id = p_project_id and pm.user_id = p_user_id and pm.status = 'active'
  );
$;
revoke all on function public.is_valid_task_assignee(uuid, uuid) from public;
grant execute on function public.is_valid_task_assignee(uuid, uuid) to authenticated;

create policy "task_members_read" on public.project_tasks for select to authenticated
  using (public.can_access_project(project_id));
create policy "task_editors_create" on public.project_tasks for insert to authenticated
  with check (public.can_edit_project_content(project_id) and created_by = auth.uid()
    and public.is_valid_task_assignee(project_id, assignee_user_id));
create policy "task_editors_update" on public.project_tasks for update to authenticated
  using (public.can_edit_project_content(project_id))
  with check (public.can_edit_project_content(project_id)
    and public.is_valid_task_assignee(project_id, assignee_user_id));
-- No direct DELETE policy: use deleted_at, keep an audit trail.
-- Follow-up: append-only status events and idempotency before production.

-- Keep task tenant, actor and version server-controlled even for direct PostgREST updates.
create or replace function public.validate_project_task_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.version <> 1 or new.status <> 'todo' or new.deleted_at is not null then
      raise exception 'INVALID_TASK_INITIAL_STATE' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.project_id is distinct from old.project_id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
    raise exception 'IMMUTABLE_TASK_FIELDS' using errcode = '23514';
  end if;
  if old.deleted_at is not null and (new.deleted_at is not null or new.deleted_at <> old.deleted_at) then
    raise exception 'TASK_DELETED_REQUIRES_RESTORE' using errcode = '23514';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'TASK_VERSION_CONFLICT' using errcode = '40001';
  end if;
  if new.status is distinct from old.status and not (
    (old.status = 'todo' and new.status in ('in_progress','blocked'))
    or (old.status = 'in_progress' and new.status in ('in_review','blocked'))
    or (old.status = 'in_review' and new.status in ('done','in_progress','blocked'))
    or (old.status = 'blocked' and new.status = 'in_progress')
  ) then
    raise exception 'INVALID_TASK_STATUS_TRANSITION' using errcode = '23514';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
create trigger project_task_validate_change
before insert or update on public.project_tasks
for each row execute function public.validate_project_task_change();
-- Client version compare-and-swap maps empty UPDATE result to a conflict.
-- This migration still requires isolated DB and RLS tests before application.
