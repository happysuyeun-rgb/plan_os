-- 020: task version conflicts must not use SQLSTATE 40001.
--
-- Migration 011's trigger raised TASK_VERSION_CONFLICT with errcode
-- '40001' (serialization_failure). PostgREST retries requests that fail
-- with 40001, so a direct PATCH that reaches the trigger without the
-- client's version filter hangs in a retry spiral until the gateway
-- times out (~60s, reproduced against a disposable local Supabase in
-- tests/rls/test_local_supabase_task_conflict.mjs). Conflicts that are a
-- normal, expected outcome use the dedicated SQLSTATE P4001 instead —
-- the same code as the document Revision CAS in migration 018.
--
-- Migration 011 itself is NOT edited; this migration redefines only the
-- trigger function. Validation semantics are unchanged.
create or replace function public.validate_project_task_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.version <> 1 or new.status <> 'todo' or new.deleted_at is not null then
      raise exception 'INVALID_TASK_INITIAL_STATE' using errcode = '23514';
    end if;
    return new;
  end if;
  if old.deleted_at is not null and new.deleted_at is null and public.get_project_role(old.project_id) is distinct from 'owner' then
    raise exception 'ONLY_OWNER_MAY_RESTORE_TASK' using errcode = '42501';
  end if;
  if new.project_id is distinct from old.project_id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
    raise exception 'IMMUTABLE_TASK_FIELDS' using errcode = '23514';
  end if;
  if old.deleted_at is not null and (new.deleted_at is not null or new.deleted_at <> old.deleted_at) then
    raise exception 'TASK_DELETED_REQUIRES_RESTORE' using errcode = '23514';
  end if;
  if old.deleted_at is null and new.deleted_at is not null and public.get_project_role(old.project_id) is distinct from 'owner' then
    raise exception 'ONLY_OWNER_MAY_DELETE_TASK' using errcode = '42501';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'TASK_VERSION_CONFLICT' using errcode = 'P4001';
  end if;
  if old.deleted_at is not null and new.deleted_at is null and (
    new.status is distinct from old.status or new.title is distinct from old.title
    or new.objective is distinct from old.objective or new.acceptance_criteria is distinct from old.acceptance_criteria or new.assignee_user_id is distinct from old.assignee_user_id
  ) then
    raise exception 'RESTORE_ONLY_NO_CONTENT_CHANGE' using errcode = '23514';
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
