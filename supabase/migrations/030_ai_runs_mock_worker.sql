-- 030: F-B ai_runs queue + Mock worker + mock-only usage ledger.
-- Additive. No paid LLM. Only active agent_contracts may enqueue.
-- Browser (or CI) drives process_mock_ai_run; all state is server-persisted.

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  contract_id uuid not null references public.agent_contracts(id) on delete restrict,
  created_by uuid not null references auth.users(id),
  idempotency_key uuid not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'validating', 'succeeded', 'failed', 'cancelled')),
  attempt integer not null default 1 check (attempt > 0),
  version bigint not null default 1 check (version > 0),
  error_code text,
  error_message text,
  result_json jsonb,
  terms_version text not null,
  terms_digest text not null,
  manifest_id uuid not null references public.audit_source_manifests(id) on delete restrict,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_runs_idempotency_unique unique (project_id, created_by, idempotency_key),
  constraint ai_runs_result_on_success check (
    status <> 'succeeded' or result_json is not null
  ),
  constraint ai_runs_error_on_failed check (
    status <> 'failed' or error_code is not null
  )
);

create index ai_runs_project_idx on public.ai_runs (project_id, updated_at desc);
create index ai_runs_contract_idx on public.ai_runs (contract_id, created_at desc);
create index ai_runs_status_idx on public.ai_runs (project_id, status);

create table public.ai_run_events (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.ai_runs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'enqueued', 'started', 'validating', 'succeeded', 'failed', 'cancelled', 'retried'
  )),
  from_status text,
  to_status text,
  run_version bigint not null,
  detail text,
  created_at timestamptz not null default now()
);
create index ai_run_events_run_idx on public.ai_run_events (run_id, created_at);

-- Mock usage only. Paid provider rows are structurally blocked in MVP.
create table public.ai_usage_ledger (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid not null references public.ai_runs(id) on delete restrict,
  billing_kind text not null check (billing_kind = 'mock'),
  entry_type text not null check (entry_type in ('mock_token_estimate', 'mock_run_fee')),
  amount_minor bigint not null default 0 check (amount_minor = 0),
  currency text not null default 'KRW' check (currency in ('KRW', 'USD')),
  units bigint not null default 0 check (units >= 0),
  provider_ref text not null,
  created_at timestamptz not null default now(),
  constraint ai_usage_ledger_provider_unique unique (provider_ref)
);

create index ai_usage_ledger_run_idx on public.ai_usage_ledger (run_id);
create index ai_usage_ledger_project_idx on public.ai_usage_ledger (project_id, created_at desc);

alter table public.ai_runs enable row level security;
alter table public.ai_run_events enable row level security;
alter table public.ai_usage_ledger enable row level security;

create policy "ai_runs_members_read" on public.ai_runs
  for select to authenticated using (public.can_access_project(project_id));
create policy "ai_run_events_members_read" on public.ai_run_events
  for select to authenticated using (public.can_access_project(project_id));
create policy "ai_usage_ledger_members_read" on public.ai_usage_ledger
  for select to authenticated using (public.can_access_project(project_id));

revoke insert, update, delete on public.ai_runs from anon, authenticated;
revoke insert, update, delete on public.ai_run_events from anon, authenticated;
revoke insert, update, delete on public.ai_usage_ledger from anon, authenticated;
grant select on public.ai_runs to authenticated;
grant select on public.ai_run_events to authenticated;
grant select on public.ai_usage_ledger to authenticated;

create or replace function public.enqueue_ai_run(
  p_contract_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract public.agent_contracts;
  v_id uuid;
  v_row public.ai_runs;
begin
  if p_idempotency_key is null then
    raise exception 'MISSING_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;

  select * into v_contract from public.agent_contracts where id = p_contract_id for update;
  if v_contract.id is null then
    raise exception 'CONTRACT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if auth.uid() is null or public.get_project_role(v_contract.project_id) is distinct from 'owner' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if v_contract.status is distinct from 'active' then
    raise exception 'CONTRACT_NOT_ACTIVE' using errcode = 'P4001';
  end if;
  if not public.is_audit_source_manifest_current(v_contract.audit_manifest_id) then
    raise exception 'STALE_SOURCE' using errcode = 'P4001';
  end if;

  insert into public.ai_runs (
    project_id, contract_id, created_by, idempotency_key, status,
    terms_version, terms_digest, manifest_id
  ) values (
    v_contract.project_id, v_contract.id, auth.uid(), p_idempotency_key, 'queued',
    v_contract.terms_version, v_contract.terms_digest, v_contract.audit_manifest_id
  )
  on conflict (project_id, created_by, idempotency_key) do nothing
  returning id into v_id;

  if v_id is null then
    select * into v_row from public.ai_runs
    where project_id = v_contract.project_id and created_by = auth.uid()
      and idempotency_key = p_idempotency_key;
    if v_row.contract_id is distinct from v_contract.id then
      raise exception 'IDEMPOTENCY_KEY_CONFLICT' using errcode = '23505';
    end if;
    return to_jsonb(v_row);
  end if;

  insert into public.ai_run_events (
    run_id, project_id, actor_id, event_type, from_status, to_status, run_version, detail
  ) values (
    v_id, v_contract.project_id, auth.uid(), 'enqueued', null, 'queued', 1, null
  );

  select * into v_row from public.ai_runs where id = v_id;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.enqueue_ai_run(uuid, uuid) from public;
grant execute on function public.enqueue_ai_run(uuid, uuid) to authenticated;

create or replace function public.process_mock_ai_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ai_runs;
  v_contract public.agent_contracts;
  v_result jsonb;
  v_provider text;
begin
  select * into v_row from public.ai_runs where id = p_run_id for update;
  if v_row.id is null then
    raise exception 'RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if auth.uid() is null or public.get_project_role(v_row.project_id) is distinct from 'owner' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;

  if v_row.status = 'succeeded' then
    return to_jsonb(v_row);
  end if;
  if v_row.status = 'cancelled' then
    raise exception 'RUN_CANCELLED' using errcode = 'P4001';
  end if;
  if v_row.status = 'failed' then
    raise exception 'RUN_FAILED_RETRY_REQUIRED' using errcode = 'P4001';
  end if;
  if v_row.status not in ('queued', 'running', 'validating') then
    raise exception 'INVALID_RUN_TRANSITION' using errcode = 'P4001';
  end if;

  select * into v_contract from public.agent_contracts where id = v_row.contract_id;
  if v_contract.status is distinct from 'active' then
    update public.ai_runs set
      status = 'failed',
      error_code = 'CONTRACT_NOT_ACTIVE',
      error_message = 'Contract was not active at process time',
      version = version + 1,
      finished_at = now(),
      updated_at = now()
    where id = v_row.id
    returning * into v_row;
    insert into public.ai_run_events (
      run_id, project_id, actor_id, event_type, from_status, to_status, run_version, detail
    ) values (
      v_row.id, v_row.project_id, auth.uid(), 'failed', 'queued', 'failed', v_row.version, v_row.error_code
    );
    return to_jsonb(v_row);
  end if;

  -- queued → running
  if v_row.status = 'queued' then
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
      v_row.id, v_row.project_id, auth.uid(), 'started', 'queued', 'running', v_row.version, 'mock worker'
    );
  end if;

  -- running → validating (re-check S2; never bypass)
  if v_row.status = 'running' then
    if not public.is_audit_source_manifest_current(v_row.manifest_id) then
      update public.ai_runs set
        status = 'failed',
        error_code = 'STALE_SOURCE',
        error_message = 'Audit sources changed before Mock validation',
        version = version + 1,
        finished_at = now(),
        updated_at = now()
      where id = v_row.id
      returning * into v_row;
      insert into public.ai_run_events (
        run_id, project_id, actor_id, event_type, from_status, to_status, run_version, detail
      ) values (
        v_row.id, v_row.project_id, auth.uid(), 'failed', 'running', 'failed', v_row.version, 'STALE_SOURCE'
      );
      return to_jsonb(v_row);
    end if;

    update public.ai_runs set
      status = 'validating',
      version = version + 1,
      updated_at = now()
    where id = v_row.id
    returning * into v_row;
    insert into public.ai_run_events (
      run_id, project_id, actor_id, event_type, from_status, to_status, run_version, detail
    ) values (
      v_row.id, v_row.project_id, auth.uid(), 'validating', 'running', 'validating', v_row.version, null
    );
  end if;

  -- validating → succeeded with Mock report body (F-C will promote to ai_artifacts)
  v_result := jsonb_build_object(
    'kind', 'requirements_audit_report_v1',
    'mock', true,
    'paidLlmUsed', false,
    'agentSlug', 'requirements_auditor_v1',
    'contractId', v_row.contract_id,
    'manifestId', v_row.manifest_id,
    'task', v_contract.scope_json->>'task',
    'acceptanceCriteria', v_contract.scope_json->>'acceptanceCriteria',
    'findings', jsonb_build_array(
      jsonb_build_object(
        'severity', 'info',
        'summary', 'Mock worker completed without calling a paid LLM.',
        'rationale', 'Server-persisted Mock result for F-B pipeline verification.'
      )
    ),
    'generatedAt', now()
  );

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
    v_row.id, v_row.project_id, auth.uid(), 'succeeded', 'validating', 'succeeded', v_row.version, 'mock report'
  );

  v_provider := 'mock:requirements_auditor_v1:run:' || v_row.id::text;
  insert into public.ai_usage_ledger (
    project_id, run_id, billing_kind, entry_type, amount_minor, currency, units, provider_ref
  ) values (
    v_row.project_id, v_row.id, 'mock', 'mock_run_fee', 0, 'KRW', 1, v_provider
  )
  on conflict (provider_ref) do nothing;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.process_mock_ai_run(uuid) from public;
grant execute on function public.process_mock_ai_run(uuid) to authenticated;

create or replace function public.cancel_ai_run(
  p_run_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ai_runs;
  v_from text;
begin
  select * into v_row from public.ai_runs where id = p_run_id for update;
  if v_row.id is null then
    raise exception 'RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if public.get_project_role(v_row.project_id) is distinct from 'owner' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if v_row.version is distinct from p_expected_version then
    raise exception 'RUN_VERSION_CONFLICT' using errcode = 'P4001';
  end if;
  if v_row.status not in ('queued', 'running', 'validating') then
    raise exception 'INVALID_RUN_TRANSITION' using errcode = 'P4001';
  end if;
  v_from := v_row.status;
  update public.ai_runs set
    status = 'cancelled',
    version = version + 1,
    finished_at = now(),
    updated_at = now(),
    error_code = 'CANCELLED',
    error_message = 'Cancelled by owner'
  where id = v_row.id
  returning * into v_row;
  insert into public.ai_run_events (
    run_id, project_id, actor_id, event_type, from_status, to_status, run_version, detail
  ) values (
    v_row.id, v_row.project_id, auth.uid(), 'cancelled', v_from, 'cancelled', v_row.version, null
  );
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.cancel_ai_run(uuid, bigint) from public;
grant execute on function public.cancel_ai_run(uuid, bigint) to authenticated;

create or replace function public.retry_failed_ai_run(
  p_run_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ai_runs;
  v_contract_status text;
begin
  select * into v_row from public.ai_runs where id = p_run_id for update;
  if v_row.id is null then
    raise exception 'RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if public.get_project_role(v_row.project_id) is distinct from 'owner' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if v_row.version is distinct from p_expected_version then
    raise exception 'RUN_VERSION_CONFLICT' using errcode = 'P4001';
  end if;
  if v_row.status is distinct from 'failed' then
    raise exception 'INVALID_RUN_TRANSITION' using errcode = 'P4001';
  end if;
  select status into v_contract_status from public.agent_contracts where id = v_row.contract_id;
  if v_contract_status is distinct from 'active' then
    raise exception 'CONTRACT_NOT_ACTIVE' using errcode = 'P4001';
  end if;
  if not public.is_audit_source_manifest_current(v_row.manifest_id) then
    raise exception 'STALE_SOURCE' using errcode = 'P4001';
  end if;

  update public.ai_runs set
    status = 'queued',
    attempt = attempt + 1,
    version = version + 1,
    error_code = null,
    error_message = null,
    result_json = null,
    started_at = null,
    finished_at = null,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  insert into public.ai_run_events (
    run_id, project_id, actor_id, event_type, from_status, to_status, run_version, detail
  ) values (
    v_row.id, v_row.project_id, auth.uid(), 'retried', 'failed', 'queued', v_row.version,
    'attempt ' || v_row.attempt::text
  );
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.retry_failed_ai_run(uuid, bigint) from public;
grant execute on function public.retry_failed_ai_run(uuid, bigint) to authenticated;

comment on table public.ai_runs is
  'F-B: server-persisted Mock AI runs; paid LLM forbidden';
comment on table public.ai_usage_ledger is
  'F-B: mock-only usage ledger; amount_minor always 0; never conflate with paid providers';
