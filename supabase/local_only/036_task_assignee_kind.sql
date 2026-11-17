-- =============================================================================
-- 036 F-105 task assignee_kind — EXECUTABLE for disposable LOCAL Supabase ONLY
-- Location: supabase/local_only/ (NOT supabase/migrations/)
-- FORBIDDEN: Preview/ops/production apply without explicit approval
-- Does NOT hire, run LLM, open contracts, or charge.
-- =============================================================================

alter table public.project_tasks
  add column if not exists assignee_kind text not null default 'human';

alter table public.project_tasks
  add column if not exists agent_role_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'project_tasks_assignee_kind_chk'
  ) then
    alter table public.project_tasks
      add constraint project_tasks_assignee_kind_chk
      check (assignee_kind in ('human', 'agent'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'project_tasks_agent_role_chk'
  ) then
    alter table public.project_tasks
      add constraint project_tasks_agent_role_chk
      check (
        (assignee_kind = 'human' and agent_role_id is null)
        or (
          assignee_kind = 'agent'
          and agent_role_id in ('requirements_auditor_v1')
        )
      );
  end if;
end $$;

comment on column public.project_tasks.assignee_kind is
  'F-105 metadata only. agent ≠ hire/run/pay. LOCAL until Preview approval.';
comment on column public.project_tasks.agent_role_id is
  'Allowed agent role id when assignee_kind=agent. Metadata only.';
