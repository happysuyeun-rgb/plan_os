-- Server-side aggregation for the C04 dashboard (Issue #39,
-- C04-RECHECK-01). Counting rows in the browser silently truncated at
-- the PostgREST response limit and produced false completion rates, so
-- the database aggregates inside the caller's RLS scope instead.
-- SECURITY INVOKER keeps project_tasks / pm_plans row policies in force:
-- a caller only ever receives counts for projects they can access.

create or replace function public.get_dashboard_task_counts(p_project_ids uuid[])
returns table (
  project_id uuid,
  total bigint,
  done bigint,
  in_progress bigint,
  in_review bigint,
  blocked bigint
)
language sql stable security invoker set search_path = public as $$
  select
    requested.id,
    count(t.id),
    count(t.id) filter (where t.status = 'done'),
    count(t.id) filter (where t.status = 'in_progress'),
    count(t.id) filter (where t.status = 'in_review'),
    count(t.id) filter (where t.status = 'blocked')
  from unnest(coalesce(p_project_ids, '{}')) as requested(id)
  left join public.project_tasks t
    on t.project_id = requested.id and t.deleted_at is null
  group by requested.id;
$$;
revoke all on function public.get_dashboard_task_counts(uuid[]) from public;
grant execute on function public.get_dashboard_task_counts(uuid[]) to authenticated;

-- Kept separate from the task counts so a missing/unreachable PM schema
-- degrades to "not connected" instead of silently reporting zero.
create or replace function public.get_dashboard_pending_approvals(p_project_ids uuid[])
returns table (
  project_id uuid,
  pending_approvals bigint
)
language sql stable security invoker set search_path = public as $$
  select
    requested.id,
    count(mp.id)
  from unnest(coalesce(p_project_ids, '{}')) as requested(id)
  left join public.pm_plans mp
    on mp.project_id = requested.id
    and mp.status = 'pending_owner_approval'
  group by requested.id;
$$;
revoke all on function public.get_dashboard_pending_approvals(uuid[]) from public;
grant execute on function public.get_dashboard_pending_approvals(uuid[]) to authenticated;
