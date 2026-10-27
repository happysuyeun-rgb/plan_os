-- 031: F-C ai_artifacts + human acceptance events + S1 task link.
-- Report publish and human accept are separate events. No paid LLM.

create table public.ai_artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid not null references public.ai_runs(id) on delete restrict,
  contract_id uuid not null references public.agent_contracts(id) on delete restrict,
  kind text not null check (kind = 'requirements_audit_report_v1'),
  content_json jsonb not null,
  content_digest text not null check (content_digest ~ '^sha256:[0-9a-f]{64}$'),
  status text not null default 'published'
    check (status in ('published', 'accepted', 'rejected', 'revision_requested')),
  version bigint not null default 1 check (version > 0),
  linked_task_id uuid references public.project_tasks(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_artifacts_run_unique unique (run_id)
);

create index ai_artifacts_project_idx on public.ai_artifacts (project_id, updated_at desc);

create table public.ai_artifact_events (
  id bigint generated always as identity primary key,
  artifact_id uuid not null references public.ai_artifacts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'published', 'accepted', 'rejected', 'revision_requested'
  )),
  from_status text,
  to_status text,
  artifact_version bigint not null,
  comment text,
  linked_task_id uuid references public.project_tasks(id) on delete set null,
  created_at timestamptz not null default now()
);
create index ai_artifact_events_artifact_idx
  on public.ai_artifact_events (artifact_id, created_at);

alter table public.ai_artifacts enable row level security;
alter table public.ai_artifact_events enable row level security;

create policy "ai_artifacts_members_read" on public.ai_artifacts
  for select to authenticated using (public.can_access_project(project_id));
create policy "ai_artifact_events_members_read" on public.ai_artifact_events
  for select to authenticated using (public.can_access_project(project_id));

revoke insert, update, delete on public.ai_artifacts from anon, authenticated;
revoke insert, update, delete on public.ai_artifact_events from anon, authenticated;
grant select on public.ai_artifacts to authenticated;
grant select on public.ai_artifact_events to authenticated;

create or replace function public.publish_ai_artifact_from_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.ai_runs;
  v_id uuid;
  v_row public.ai_artifacts;
  v_digest text;
begin
  select * into v_run from public.ai_runs where id = p_run_id;
  if v_run.id is null then
    raise exception 'RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if auth.uid() is null or public.get_project_role(v_run.project_id) is distinct from 'owner' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if v_run.status is distinct from 'succeeded' or v_run.result_json is null then
    raise exception 'RUN_NOT_SUCCEEDED' using errcode = 'P4001';
  end if;

  select id into v_id from public.ai_artifacts where run_id = p_run_id;
  if v_id is not null then
    select * into v_row from public.ai_artifacts where id = v_id;
    return to_jsonb(v_row);
  end if;

  v_digest := 'sha256:' || encode(
    extensions.digest(convert_to(v_run.result_json::text, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.ai_artifacts (
    project_id, run_id, contract_id, kind, content_json, content_digest, status, created_by
  ) values (
    v_run.project_id, v_run.id, v_run.contract_id, 'requirements_audit_report_v1',
    v_run.result_json, v_digest, 'published', auth.uid()
  )
  returning id into v_id;

  insert into public.ai_artifact_events (
    artifact_id, project_id, actor_id, event_type, from_status, to_status, artifact_version, comment
  ) values (
    v_id, v_run.project_id, auth.uid(), 'published', null, 'published', 1, 'report published from succeeded run'
  );

  select * into v_row from public.ai_artifacts where id = v_id;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.publish_ai_artifact_from_run(uuid) from public;
grant execute on function public.publish_ai_artifact_from_run(uuid) to authenticated;

create or replace function public.decide_ai_artifact(
  p_artifact_id uuid,
  p_expected_version bigint,
  p_decision text,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ai_artifacts;
  v_decision text := trim(p_decision);
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
  v_task_id uuid;
  v_title text;
  v_objective text;
  v_from text;
begin
  if v_decision not in ('accepted', 'rejected', 'revision_requested') then
    raise exception 'INVALID_DECISION' using errcode = '22023';
  end if;

  select * into v_row from public.ai_artifacts where id = p_artifact_id for update;
  if v_row.id is null then
    raise exception 'ARTIFACT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if public.get_project_role(v_row.project_id) is distinct from 'owner' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if v_row.version is distinct from p_expected_version then
    raise exception 'ARTIFACT_VERSION_CONFLICT' using errcode = 'P4001';
  end if;
  if v_row.status in ('accepted', 'rejected') then
    raise exception 'ARTIFACT_ALREADY_DECIDED' using errcode = 'P4001';
  end if;
  if v_row.status not in ('published', 'revision_requested') then
    raise exception 'INVALID_ARTIFACT_TRANSITION' using errcode = 'P4001';
  end if;

  v_from := v_row.status;
  v_task_id := null;

  if v_decision = 'accepted' then
    v_title := left(
      coalesce(
        'AI 검수: ' || nullif(trim(v_row.content_json->>'task'), ''),
        'AI 검수 결과 반영'
      ),
      120
    );
    v_objective := left(
      coalesce(v_row.content_json->>'acceptanceCriteria', '수락된 Mock 검수 보고서를 S1 업무로 연결'),
      2000
    );

    insert into public.project_tasks (
      project_id, created_by, title, objective, acceptance_criteria, status, version
    ) values (
      v_row.project_id,
      auth.uid(),
      v_title,
      v_objective,
      jsonb_build_array(
        jsonb_build_object(
          'text', '수락된 AI 보고서 반영',
          'sourceArtifactId', v_row.id,
          'sourceRunId', v_row.run_id
        )
      ),
      'todo',
      1
    )
    returning id into v_task_id;
  end if;

  update public.ai_artifacts set
    status = v_decision,
    linked_task_id = coalesce(v_task_id, linked_task_id),
    version = version + 1,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  insert into public.ai_artifact_events (
    artifact_id, project_id, actor_id, event_type, from_status, to_status,
    artifact_version, comment, linked_task_id
  ) values (
    v_row.id, v_row.project_id, auth.uid(), v_decision, v_from, v_decision,
    v_row.version, v_comment, v_task_id
  );

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.decide_ai_artifact(uuid, bigint, text, text) from public;
grant execute on function public.decide_ai_artifact(uuid, bigint, text, text) to authenticated;

comment on table public.ai_artifacts is
  'F-C: server reports from succeeded Mock runs; human accept is a separate event';
