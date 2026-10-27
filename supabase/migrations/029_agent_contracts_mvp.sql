-- 029: F-A agent contract + explicit consent for requirements_auditor_v1.
-- Additive only. No paid LLM. Mock execution gate lands in 030 (F-B).
-- Digests and consent events are server-authored; clients cannot forge them.

create table public.agent_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  agent_slug text not null check (agent_slug = 'requirements_auditor_v1'),
  created_by uuid not null references auth.users(id),
  client_request_id uuid not null,
  terms_version text not null,
  terms_digest text not null check (terms_digest ~ '^sha256:[0-9a-f]{64}$'),
  scope_json jsonb not null check (jsonb_typeof(scope_json) = 'object'),
  audit_manifest_id uuid not null references public.audit_source_manifests(id) on delete restrict,
  budget_cap_minor bigint not null check (budget_cap_minor >= 0),
  currency text not null default 'KRW' check (currency in ('KRW', 'USD')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'revoked', 'expired')),
  expires_at timestamptz,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_contracts_request_unique unique (project_id, created_by, client_request_id),
  constraint agent_contracts_active_accept check (
    status <> 'active'
    or (accepted_by is not null and accepted_at is not null)
  )
);

create index agent_contracts_project_idx
  on public.agent_contracts (project_id, updated_at desc);
create index agent_contracts_status_idx
  on public.agent_contracts (project_id, status);

create table public.agent_contract_events (
  id bigint generated always as identity primary key,
  contract_id uuid not null references public.agent_contracts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'draft_created', 'accepted', 'revoked', 'expired'
  )),
  from_status text,
  to_status text,
  contract_version bigint not null,
  comment text,
  created_at timestamptz not null default now()
);
create index agent_contract_events_contract_idx
  on public.agent_contract_events (contract_id, created_at);

alter table public.agent_contracts enable row level security;
alter table public.agent_contract_events enable row level security;

create policy "agent_contracts_members_read" on public.agent_contracts
  for select to authenticated
  using (public.can_access_project(project_id));

create policy "agent_contract_events_members_read" on public.agent_contract_events
  for select to authenticated
  using (public.can_access_project(project_id));

revoke insert, update, delete on public.agent_contracts from anon, authenticated;
revoke insert, update, delete on public.agent_contract_events from anon, authenticated;
grant select on public.agent_contracts to authenticated;
grant select on public.agent_contract_events to authenticated;

-- Canonical Mock terms (no paid LLM). Digest is computed in SQL.
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
    else null
  end;
$$;

create or replace function public.agent_contract_terms_digest(p_terms_version text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when public.agent_contract_terms_text(p_terms_version) is null then null
    else 'sha256:' || encode(
      extensions.digest(
        convert_to(public.agent_contract_terms_text(p_terms_version), 'UTF8'),
        'sha256'
      ),
      'hex'
    )
  end;
$$;

create or replace function public.create_agent_contract_draft(
  p_project_id uuid,
  p_task text,
  p_acceptance_criteria text,
  p_audit_manifest_id uuid,
  p_budget_cap_minor bigint,
  p_client_request_id uuid,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terms_version text := 'requirements_auditor_v1_terms_2026-10-27';
  v_terms_digest text;
  v_scope jsonb;
  v_manifest_project uuid;
  v_id uuid;
  v_row public.agent_contracts;
  v_task text := trim(p_task);
  v_criteria text := trim(p_acceptance_criteria);
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
    'agentSlug', 'requirements_auditor_v1',
    'task', v_task,
    'acceptanceCriteria', v_criteria,
    'auditManifestId', p_audit_manifest_id,
    'mockOnly', true,
    'paidLlmAllowed', false
  );

  insert into public.agent_contracts (
    project_id, agent_slug, created_by, client_request_id,
    terms_version, terms_digest, scope_json, audit_manifest_id,
    budget_cap_minor, currency, status, expires_at
  ) values (
    p_project_id, 'requirements_auditor_v1', auth.uid(), p_client_request_id,
    v_terms_version, v_terms_digest, v_scope, p_audit_manifest_id,
    p_budget_cap_minor, 'KRW', 'draft', p_expires_at
  )
  on conflict (project_id, created_by, client_request_id) do nothing
  returning id into v_id;

  if v_id is null then
    select * into v_row from public.agent_contracts
    where project_id = p_project_id and created_by = auth.uid()
      and client_request_id = p_client_request_id;
    if v_row.scope_json is distinct from v_scope
       or v_row.audit_manifest_id is distinct from p_audit_manifest_id
       or v_row.budget_cap_minor is distinct from p_budget_cap_minor then
      raise exception 'REQUEST_KEY_CONFLICT' using errcode = '23505';
    end if;
    return to_jsonb(v_row);
  end if;

  insert into public.agent_contract_events (
    contract_id, project_id, actor_id, event_type, from_status, to_status, contract_version, comment
  ) values (
    v_id, p_project_id, auth.uid(), 'draft_created', null, 'draft', 1, null
  );

  select * into v_row from public.agent_contracts where id = v_id;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.create_agent_contract_draft(uuid, text, text, uuid, bigint, uuid, timestamptz) from public;
grant execute on function public.create_agent_contract_draft(uuid, text, text, uuid, bigint, uuid, timestamptz) to authenticated;

create or replace function public.accept_agent_contract(
  p_contract_id uuid,
  p_expected_version bigint,
  p_consent_statement text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.agent_contracts;
  v_consent text := trim(coalesce(p_consent_statement, ''));
begin
  select * into v_row from public.agent_contracts where id = p_contract_id for update;
  if v_row.id is null then
    raise exception 'CONTRACT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if public.get_project_role(v_row.project_id) is distinct from 'owner' then
    raise exception 'ONLY_OWNER_MAY_ACCEPT' using errcode = '42501';
  end if;
  if v_row.version is distinct from p_expected_version then
    raise exception 'CONTRACT_VERSION_CONFLICT' using errcode = 'P4001';
  end if;
  if v_row.status is distinct from 'draft' then
    raise exception 'INVALID_CONTRACT_TRANSITION' using errcode = 'P4001';
  end if;
  if v_row.expires_at is not null and v_row.expires_at <= now() then
    update public.agent_contracts
      set status = 'expired', version = version + 1, updated_at = now()
      where id = v_row.id;
    insert into public.agent_contract_events (
      contract_id, project_id, actor_id, event_type, from_status, to_status, contract_version, comment
    ) values (
      v_row.id, v_row.project_id, auth.uid(), 'expired', 'draft', 'expired', v_row.version + 1, 'expired before accept'
    );
    raise exception 'CONTRACT_EXPIRED' using errcode = 'P4001';
  end if;
  if char_length(v_consent) < 12 then
    raise exception 'CONSENT_REQUIRED' using errcode = '22023';
  end if;
  if not public.is_audit_source_manifest_current(v_row.audit_manifest_id) then
    raise exception 'STALE_SOURCE' using errcode = 'P4001';
  end if;

  update public.agent_contracts
    set status = 'active',
        accepted_by = auth.uid(),
        accepted_at = now(),
        version = version + 1,
        updated_at = now()
    where id = v_row.id
    returning * into v_row;

  insert into public.agent_contract_events (
    contract_id, project_id, actor_id, event_type, from_status, to_status, contract_version, comment
  ) values (
    v_row.id, v_row.project_id, auth.uid(), 'accepted', 'draft', 'active', v_row.version, v_consent
  );

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.accept_agent_contract(uuid, bigint, text) from public;
grant execute on function public.accept_agent_contract(uuid, bigint, text) to authenticated;

create or replace function public.revoke_agent_contract(
  p_contract_id uuid,
  p_expected_version bigint,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.agent_contracts;
begin
  select * into v_row from public.agent_contracts where id = p_contract_id for update;
  if v_row.id is null then
    raise exception 'CONTRACT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if public.get_project_role(v_row.project_id) is distinct from 'owner' then
    raise exception 'ONLY_OWNER_MAY_REVOKE' using errcode = '42501';
  end if;
  if v_row.version is distinct from p_expected_version then
    raise exception 'CONTRACT_VERSION_CONFLICT' using errcode = 'P4001';
  end if;
  if v_row.status is distinct from 'active' then
    raise exception 'INVALID_CONTRACT_TRANSITION' using errcode = 'P4001';
  end if;

  update public.agent_contracts
    set status = 'revoked', version = version + 1, updated_at = now()
    where id = v_row.id
    returning * into v_row;

  insert into public.agent_contract_events (
    contract_id, project_id, actor_id, event_type, from_status, to_status, contract_version, comment
  ) values (
    v_row.id, v_row.project_id, auth.uid(), 'revoked', 'active', 'revoked', v_row.version,
    nullif(trim(coalesce(p_comment, '')), '')
  );

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.revoke_agent_contract(uuid, bigint, text) from public;
grant execute on function public.revoke_agent_contract(uuid, bigint, text) to authenticated;

comment on table public.agent_contracts is
  'F-A: requirements_auditor_v1 Mock contract snapshots; paid LLM forbidden';
