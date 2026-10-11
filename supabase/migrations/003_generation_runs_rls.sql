-- generation_runs INSERT/UPDATE/DELETE RLS (기존 SELECT-only 정책 교체)

drop policy if exists "generation_runs_select" on public.generation_runs;

alter table public.generation_runs enable row level security;

create policy "본인 generation_runs만" on public.generation_runs
  for all using (
    auth.uid() = (
      select user_id from public.projects
      where id = project_id
    )
  );
