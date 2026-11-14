-- =============================================================================
-- 035 Market researcher agent slug + contract RPC — LOCAL / disposable ONLY
-- Location: supabase/local_only/ (NOT supabase/migrations/)
-- FORBIDDEN: Preview hosted DB, ops/production, automatic db push
-- Extends 029 agent_contracts to allow ai_market_researcher_v1.
-- Apply via: node scripts/apply-035-market-researcher-local-only.mjs
-- =============================================================================

-- Drop single-slug check; allow auditor + market researcher.
alter table public.agent_contracts
  drop constraint if exists agent_contracts_agent_slug_check;

alter table public.agent_contracts
  add constraint agent_contracts_agent_slug_check
  check (agent_slug in ('requirements_auditor_v1', 'ai_market_researcher_v1'));

create or replace function public.agent_contract_terms_text(p_terms_version text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_terms_version
    when 'requirements_auditor_v1_terms_2026-10-27' then
      'PlanOS requirements_auditor_v1 Mock contract. '
      || 'No paid LLM. No external transfer. No real provider billing. '
      || 'Server may run Mock workers only after owner accept. '
      || 'Budget_cap is a Mock ceiling in minor units, not a payment authorization. '
      || 'Audit sources must stay current via S2 manifest assert before any run.'
    when 'ai_market_researcher_v1_terms_2026-11-14' then
      'PlanOS ai_market_researcher_v1 live research contract. '
      || 'Owner consent authorizes Liner Platform Search Agent, Web Search, '
      || 'and optional Deep Research only. '
      || 'Allowed: public web research and structured report write-back to PlanOS. '
      || 'Forbidden: external posting, email send, arbitrary file edits, '
      || 'auto-scheduled repeat research, and ops/production DB writes from this worker. '
      || 'Budget_cap is a soft USD-cent ceiling for hackathon credit; not a card charge. '
      || 'Audit sources must stay current via S2 manifest assert before any run.'
    else null
  end;
$$;

create or replace function public.create_market_research_contract_draft(
  p_project_id uuid,
  p_task text,
  p_acceptance_criteria text,
  p_audit_manifest_id uuid,
  p_budget_cap_minor bigint,
  p_client_request_id uuid,
  p_research_target text,
  p_region text default 'KR',
  p_research_depth text default 'standard',
  p_lang text default 'ko',
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terms_version text := 'ai_market_researcher_v1_terms_2026-11-14';
  v_terms_digest text;
  v_scope jsonb;
  v_manifest_project uuid;
  v_id uuid;
  v_row public.agent_contracts;
  v_task text := trim(p_task);
  v_criteria text := trim(p_acceptance_criteria);
  v_target text := trim(coalesce(p_research_target, ''));
  v_region text := upper(trim(coalesce(p_region, 'KR')));
  v_depth text := lower(trim(coalesce(p_research_depth, 'standard')));
  v_lang text := lower(trim(coalesce(p_lang, 'ko')));
begin
  if auth.uid() is null or public.get_project_role(p_project_id) is distinct from 'owner' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if p_client_request_id is null then
    raise exception 'MISSING_REQUEST_KEY' using errcode = '22023';
  end if;
  if char_length(v_task) < 10 or char_length(v_task) > 1000 then
    raise exception 'INVALID_TASK' using errcode = '22023';
  end if;
  if char_length(v_criteria) < 5 or char_length(v_criteria) > 500 then
    raise exception 'INVALID_CRITERIA' using errcode = '22023';
  end if;
  if char_length(v_target) < 4 or char_length(v_target) > 500 then
    raise exception 'INVALID_RESEARCH_TARGET' using errcode = '22023';
  end if;
  if v_region not in ('KR', 'US', 'GLOBAL') then
    raise exception 'INVALID_REGION' using errcode = '22023';
  end if;
  if v_depth not in ('standard', 'deep') then
    raise exception 'INVALID_RESEARCH_DEPTH' using errcode = '22023';
  end if;
  if p_budget_cap_minor is null or p_budget_cap_minor < 0 then
    raise exception 'INVALID_BUDGET' using errcode = '22023';
  end if;
  if p_audit_manifest_id is null then
    raise exception 'MANIFEST_REQUIRED' using errcode = '22023';
  end if;

  select project_id into v_manifest_project
  from public.audit_source_manifests where id = p_audit_manifest_id;
  if v_manifest_project is null or v_manifest_project is distinct from p_project_id then
    raise exception 'MANIFEST_PROJECT_MISMATCH' using errcode = '22023';
  end if;
  if not public.is_audit_source_manifest_current(p_audit_manifest_id) then
    raise exception 'STALE_SOURCE' using errcode = 'P4001';
  end if;

  v_terms_digest := public.agent_contract_terms_digest(v_terms_version);
  if v_terms_digest is null then
    raise exception 'UNKNOWN_TERMS_VERSION' using errcode = '22023';
  end if;

  v_scope := jsonb_build_object(
    'agentSlug', 'ai_market_researcher_v1',
    'task', v_task,
    'acceptanceCriteria', v_criteria,
    'auditManifestId', p_audit_manifest_id,
    'mockOnly', false,
    'paidLlmAllowed', true,
    'researchTarget', v_target,
    'region', v_region,
    'researchDepth', v_depth,
    'lang', v_lang,
    'allowedActions', jsonb_build_array('web_search', 'report_write'),
    'forbiddenActions', jsonb_build_array('external_post', 'email_send', 'arbitrary_file_edit')
  );

  insert into public.agent_contracts (
    project_id, agent_slug, created_by, client_request_id,
    terms_version, terms_digest, scope_json, audit_manifest_id,
    budget_cap_minor, currency, status, expires_at
  ) values (
    p_project_id, 'ai_market_researcher_v1', auth.uid(), p_client_request_id,
    v_terms_version, v_terms_digest, v_scope, p_audit_manifest_id,
    p_budget_cap_minor, 'USD', 'draft', p_expires_at
  )
  on conflict (project_id, created_by, client_request_id) do nothing
  returning id into v_id;

  if v_id is null then
    select * into v_row from public.agent_contracts
    where project_id = p_project_id and created_by = auth.uid()
      and client_request_id = p_client_request_id;
    if v_row.scope_json is distinct from v_scope
       or v_row.audit_manifest_id is distinct from p_audit_manifest_id
       or v_row.budget_cap_minor is distinct from p_budget_cap_minor
       or v_row.agent_slug is distinct from 'ai_market_researcher_v1' then
      raise exception 'REQUEST_KEY_CONFLICT' using errcode = '23505';
    end if;
    return to_jsonb(v_row);
  end if;

  insert into public.agent_contract_events (
    contract_id, project_id, actor_id, event_type, from_status, to_status, contract_version, comment
  ) values (
    v_id, p_project_id, auth.uid(), 'draft_created', null, 'draft', 1,
    'ai_market_researcher_v1 live research draft'
  );

  select * into v_row from public.agent_contracts where id = v_id;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.create_market_research_contract_draft(
  uuid, text, text, uuid, bigint, uuid, text, text, text, text, timestamptz
) from public;
grant execute on function public.create_market_research_contract_draft(
  uuid, text, text, uuid, bigint, uuid, text, text, text, text, timestamptz
) to authenticated;

comment on function public.create_market_research_contract_draft is
  'LOCAL-ONLY: draft contract for ai_market_researcher_v1 (Liner live research)';
