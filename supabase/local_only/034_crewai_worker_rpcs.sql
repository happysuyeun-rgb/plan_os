-- =============================================================================
-- 034 CrewAI real worker claim/complete RPCs — LOCAL / disposable ONLY
-- Location: supabase/local_only/ (NOT supabase/migrations/)
-- FORBIDDEN: Preview hosted DB, ops/production, automatic db push
-- Does NOT modify process_mock_ai_run. Parallel real path only.
-- Apply via: node scripts/apply-034-crewai-local-only.mjs
-- =============================================================================

create or replace function public.claim_crewai_ai_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ai_runs;
  v_from text;
begin
  -- Service-role worker only (PostgREST role claim).
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;

  select * into v_row from public.ai_runs where id = p_run_id for update;
  if v_row.id is null then
    raise exception 'RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_row.status is distinct from 'queued' then
    raise exception 'INVALID_RUN_TRANSITION' using errcode = 'P4001';
  end if;

  v_from := v_row.status;
  update public.ai_runs set
    status = 'running',
    started_at = coalesce(started_at, now()),
    version = version + 1,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  insert into public.ai_run_events (
    run_id, project_id, actor_id, event_type, from_status, to_status, run_version, detail
  ) values (
    v_row.id, v_row.project_id, null, 'started', v_from, 'running', v_row.version, 'crewai worker claim'
  );

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.claim_crewai_ai_run(uuid) from public;
grant execute on function public.claim_crewai_ai_run(uuid) to service_role;

create or replace function public.complete_crewai_ai_run(
  p_run_id uuid,
  p_result_json jsonb default null,
  p_error_code text default null,
  p_error_message text default null,
  p_usage_json jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ai_runs;
  v_from text;
  v_result jsonb;
  v_project uuid;
  v_sources jsonb;
  v_stale boolean;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;

  select * into v_row from public.ai_runs where id = p_run_id for update;
  if v_row.id is null then
    raise exception 'RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_row.status not in ('running', 'validating') then
    raise exception 'INVALID_RUN_TRANSITION' using errcode = 'P4001';
  end if;

  -- Manifest digest gate (service_role has no auth.uid()/owner role, so do not
  -- call is_audit_source_manifest_current which requires owner JWT).
  if p_error_code is null then
    select project_id, sources into v_project, v_sources
    from public.audit_source_manifests where id = v_row.manifest_id;
    if v_project is null then
      p_error_code := 'STALE_SOURCE';
      p_error_message := 'Manifest missing before CrewAI completion';
    else
      select exists (
        select 1 from jsonb_array_elements(v_sources) as e
        left join public.documents d
          on d.id = (e->>'documentId')::uuid and d.project_id = v_project
        where d.id is null
          or to_jsonb(d.updated_at) <> (e->'revision')
          or (
            'sha256:' || encode(
              extensions.digest(convert_to(d.content, 'UTF8'), 'sha256'),
              'hex'
            )
          ) <> (e->>'digest')
      ) into v_stale;
      if coalesce(v_stale, true) then
        p_error_code := 'STALE_SOURCE';
        p_error_message := 'Audit sources changed before CrewAI completion';
      end if;
    end if;
  end if;

  v_from := v_row.status;

  if p_error_code is not null then
    update public.ai_runs set
      status = 'failed',
      error_code = p_error_code,
      error_message = left(coalesce(p_error_message, p_error_code), 2000),
      version = version + 1,
      finished_at = now(),
      updated_at = now()
    where id = v_row.id
    returning * into v_row;

    insert into public.ai_run_events (
      run_id, project_id, actor_id, event_type, from_status, to_status, run_version, detail
    ) values (
      v_row.id, v_row.project_id, null, 'failed', v_from, 'failed', v_row.version,
      left(coalesce(p_usage_json::text, p_error_code), 500)
    );
    return to_jsonb(v_row);
  end if;

  if p_result_json is null or jsonb_typeof(p_result_json) is distinct from 'object' then
    raise exception 'MISSING_RESULT_JSON' using errcode = '22023';
  end if;

  -- Stamp engine metadata; never mark mock:true on this path.
  v_result := p_result_json
    || jsonb_build_object(
      'mock', false,
      'engineFamily', 'crewai',
      'usage', coalesce(p_usage_json, '{}'::jsonb)
    );

  -- validating marker
  update public.ai_runs set
    status = 'validating',
    version = version + 1,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;
  insert into public.ai_run_events (
    run_id, project_id, actor_id, event_type, from_status, to_status, run_version, detail
  ) values (
    v_row.id, v_row.project_id, null, 'validating', v_from, 'validating', v_row.version, 'crewai'
  );
  v_from := 'validating';

  update public.ai_runs set
    status = 'succeeded',
    result_json = v_result,
    error_code = null,
    error_message = null,
    version = version + 1,
    finished_at = now(),
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  insert into public.ai_run_events (
    run_id, project_id, actor_id, event_type, from_status, to_status, run_version, detail
  ) values (
    v_row.id, v_row.project_id, null, 'succeeded', v_from, 'succeeded', v_row.version,
    left(coalesce(p_usage_json::text, 'crewai'), 500)
  );

  -- Real provider cost stays in result_json.usage for PoC.
  -- ai_usage_ledger remains mock-only until a hosted migration is approved.
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.complete_crewai_ai_run(uuid, jsonb, text, text, jsonb) from public;
grant execute on function public.complete_crewai_ai_run(uuid, jsonb, text, text, jsonb) to service_role;
