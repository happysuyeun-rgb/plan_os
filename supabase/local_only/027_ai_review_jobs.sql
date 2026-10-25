-- =============================================================================
-- 027 AI review jobs — EXECUTABLE for disposable LOCAL Supabase ONLY
-- Location: supabase/local_only/ (NOT supabase/migrations/)
-- FORBIDDEN: Preview hosted DB, ops/production, automatic db push
-- Apply via: scripts/apply-027-local-only.mjs (loopback guard)
-- =============================================================================

create table if not exists public.ai_review_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null check (status in (
    'queued','running','awaiting_human','accepted','rejected','failed'
  )),
  linked_task_id uuid references public.project_tasks(id) on delete set null,
  parent_review_job_id uuid references public.ai_review_jobs(id) on delete set null,
  source_task_id uuid references public.project_tasks(id) on delete set null,
  accepted_finding_task_ids jsonb not null default '{}'::jsonb,
  source_manifest jsonb not null default '[]'::jsonb,
  insufficient_input boolean not null default false,
  row_version integer not null default 0 check (row_version >= 0),
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_review_jobs_parent_same_project check (
    parent_review_job_id is null or parent_review_job_id <> id
  )
);

create index if not exists ai_review_jobs_project_updated_idx
  on public.ai_review_jobs (project_id, updated_at desc);

create table if not exists public.ai_review_findings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_review_jobs(id) on delete cascade,
  severity text not null check (severity in ('info','warning','blocker')),
  category text not null default 'missing' check (category in (
    'missing','inconsistent','untestable','permission_or_approval','failure_recovery'
  )),
  reviewer_state text not null default 'proposed' check (reviewer_state in (
    'proposed','source_validated','human_confirmed','human_rejected','needs_review'
  )),
  summary text not null,
  document_id uuid not null,
  document_type text not null,
  version_number integer,
  start_offset integer,
  end_offset integer,
  quote text not null,
  rationale text not null,
  created_at timestamptz not null default now(),
  constraint ai_review_findings_offsets_chk check (
    start_offset is null or end_offset is null or end_offset >= start_offset
  )
);

-- Idempotent upgrades when create-table already existed without MVP columns
alter table public.ai_review_jobs
  add column if not exists source_manifest jsonb not null default '[]'::jsonb;
alter table public.ai_review_jobs
  add column if not exists insufficient_input boolean not null default false;
alter table public.ai_review_findings
  add column if not exists category text not null default 'missing';
alter table public.ai_review_findings
  add column if not exists reviewer_state text not null default 'proposed';

create index if not exists ai_review_findings_job_idx
  on public.ai_review_findings (job_id);

-- Idempotency: one S1 task per (job, finding)
create table if not exists public.ai_review_finding_tasks (
  job_id uuid not null references public.ai_review_jobs(id) on delete cascade,
  finding_id uuid not null,
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (job_id, finding_id),
  unique (task_id)
);

alter table public.ai_review_jobs enable row level security;
alter table public.ai_review_findings enable row level security;
alter table public.ai_review_finding_tasks enable row level security;

-- SELECT: any project member (owner/editor/viewer)
drop policy if exists ai_review_jobs_members_read on public.ai_review_jobs;
create policy ai_review_jobs_members_read on public.ai_review_jobs
  for select to authenticated
  using (public.can_access_project(project_id));

drop policy if exists ai_review_jobs_editors_insert on public.ai_review_jobs;
create policy ai_review_jobs_editors_insert on public.ai_review_jobs
  for insert to authenticated
  with check (public.can_edit_project_content(project_id));

drop policy if exists ai_review_jobs_editors_update on public.ai_review_jobs;
create policy ai_review_jobs_editors_update on public.ai_review_jobs
  for update to authenticated
  using (public.can_edit_project_content(project_id))
  with check (public.can_edit_project_content(project_id));

-- No client DELETE
revoke delete on public.ai_review_jobs from authenticated, anon;

drop policy if exists ai_review_findings_members_read on public.ai_review_findings;
create policy ai_review_findings_members_read on public.ai_review_findings
  for select to authenticated
  using (
    exists (
      select 1 from public.ai_review_jobs j
      where j.id = job_id and public.can_access_project(j.project_id)
    )
  );

drop policy if exists ai_review_findings_editors_insert on public.ai_review_findings;
create policy ai_review_findings_editors_insert on public.ai_review_findings
  for insert to authenticated
  with check (
    exists (
      select 1 from public.ai_review_jobs j
      where j.id = job_id and public.can_edit_project_content(j.project_id)
    )
  );

revoke update, delete on public.ai_review_findings from authenticated, anon;

drop policy if exists ai_review_finding_tasks_members_read on public.ai_review_finding_tasks;
create policy ai_review_finding_tasks_members_read on public.ai_review_finding_tasks
  for select to authenticated
  using (
    exists (
      select 1 from public.ai_review_jobs j
      where j.id = job_id and public.can_access_project(j.project_id)
    )
  );

drop policy if exists ai_review_finding_tasks_editors_insert on public.ai_review_finding_tasks;
create policy ai_review_finding_tasks_editors_insert on public.ai_review_finding_tasks
  for insert to authenticated
  with check (
    exists (
      select 1 from public.ai_review_jobs j
      where j.id = job_id and public.can_edit_project_content(j.project_id)
    )
  );

revoke update, delete on public.ai_review_finding_tasks from authenticated, anon;

-- CAS write: bump row_version only when expected matches
drop function if exists public.cas_ai_review_job(
  uuid, integer, text, uuid, uuid, uuid, jsonb, text
);
drop function if exists public.cas_ai_review_job(
  uuid, integer, text, uuid, uuid, uuid, jsonb, text, jsonb, boolean
);

create or replace function public.cas_ai_review_job(
  p_id uuid,
  p_expected_version integer,
  p_status text default null,
  p_linked_task_id uuid default null,
  p_parent_review_job_id uuid default null,
  p_source_task_id uuid default null,
  p_accepted_finding_task_ids jsonb default null,
  p_error_message text default null,
  p_source_manifest jsonb default null,
  p_insufficient_input boolean default null
) returns public.ai_review_jobs
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated public.ai_review_jobs;
begin
  update public.ai_review_jobs j
  set
    status = coalesce(p_status, j.status),
    linked_task_id = coalesce(p_linked_task_id, j.linked_task_id),
    parent_review_job_id = coalesce(p_parent_review_job_id, j.parent_review_job_id),
    source_task_id = coalesce(p_source_task_id, j.source_task_id),
    accepted_finding_task_ids = coalesce(p_accepted_finding_task_ids, j.accepted_finding_task_ids),
    error_message = coalesce(p_error_message, j.error_message),
    source_manifest = coalesce(p_source_manifest, j.source_manifest),
    insufficient_input = coalesce(p_insufficient_input, j.insufficient_input),
    row_version = j.row_version + 1,
    updated_at = now()
  where j.id = p_id
    and j.row_version = p_expected_version
    and public.can_edit_project_content(j.project_id)
  returning * into updated;

  if updated.id is null then
    raise exception 'AI_REVIEW_VERSION_CONFLICT'
      using errcode = 'P4001';
  end if;
  return updated;
end;
$$;

revoke all on function public.cas_ai_review_job(
  uuid, integer, text, uuid, uuid, uuid, jsonb, text, jsonb, boolean
) from public;
grant execute on function public.cas_ai_review_job(
  uuid, integer, text, uuid, uuid, uuid, jsonb, text, jsonb, boolean
) to authenticated;

-- Idempotent bind finding → task (returns existing on conflict)
create or replace function public.bind_ai_review_finding_task(
  p_job_id uuid,
  p_finding_id uuid,
  p_task_id uuid
) returns public.ai_review_finding_tasks
language plpgsql
security invoker
set search_path = public
as $$
declare
  row public.ai_review_finding_tasks;
  job public.ai_review_jobs;
begin
  select * into job from public.ai_review_jobs where id = p_job_id;
  if job.id is null then
    raise exception 'AI_REVIEW_JOB_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.can_edit_project_content(job.project_id) then
    raise exception 'AI_REVIEW_FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.ai_review_finding_tasks (job_id, finding_id, task_id)
  values (p_job_id, p_finding_id, p_task_id)
  on conflict (job_id, finding_id) do nothing
  returning * into row;

  if row.job_id is null then
    select * into row from public.ai_review_finding_tasks
    where job_id = p_job_id and finding_id = p_finding_id;
  end if;
  return row;
end;
$$;

revoke all on function public.bind_ai_review_finding_task(uuid, uuid, uuid) from public;
grant execute on function public.bind_ai_review_finding_task(uuid, uuid, uuid) to authenticated;

-- PostgREST table grants (RLS still applies)
grant select, insert, update on public.ai_review_jobs to authenticated;
grant select, insert on public.ai_review_findings to authenticated;
grant select, insert on public.ai_review_finding_tasks to authenticated;

comment on table public.ai_review_jobs is
  'LOCAL/isolated only until Preview/ops approval. Do not apply via hosted push.';
