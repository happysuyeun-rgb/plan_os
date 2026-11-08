-- 032: allow create_pm_plan to persist source=ai_suggested (display-only).
-- Does NOT start AI execution, billing, or provider calls. Default remains human.

drop function if exists public.create_pm_plan(uuid, text, jsonb, uuid);

create or replace function public.create_pm_plan(
  p_project_id uuid,
  p_objective text,
  p_steps jsonb,
  p_client_request_id uuid,
  p_source text default 'human'
)
returns public.pm_plans
language plpgsql security definer set search_path = public as $$
declare
  v_existing public.pm_plans%rowtype;
  v_plan public.pm_plans%rowtype;
  v_step jsonb;
  v_position int := 0;
  v_depends_position int;
  v_source text := coalesce(nullif(trim(p_source), ''), 'human');
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  if p_project_id is null or p_client_request_id is null then
    raise exception 'INVALID_PLAN_REQUEST' using errcode = '22023';
  end if;
  if v_source not in ('human', 'ai_suggested') then
    raise exception 'INVALID_PLAN_SOURCE' using errcode = '23514';
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
        or v_existing.source is distinct from v_source
        or (select count(*) from public.pm_plan_steps s where s.plan_id = v_existing.id)
           is distinct from jsonb_array_length(p_steps) then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '23505';
    end if;
    return v_existing;
  end if;

  perform set_config('plan_os.suppress_step_bump', '1', true);

  insert into public.pm_plans (project_id, objective, source, created_by, client_request_id)
  values (p_project_id, p_objective, v_source, auth.uid(), p_client_request_id)
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

revoke all on function public.create_pm_plan(uuid, text, jsonb, uuid, text) from public;
grant execute on function public.create_pm_plan(uuid, text, jsonb, uuid, text) to authenticated;
