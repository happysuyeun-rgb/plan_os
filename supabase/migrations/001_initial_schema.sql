-- PlanOS initial schema (MVP)

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  avatar_url text not null default '',
  plan text not null default 'free' check (plan in ('free', 'pro', 'team')),
  ai_generations_this_month integer not null default 0,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  service_type text not null default '',
  target_user text not null default '',
  interview_answers jsonb not null default '{}',
  memory_summary text not null default '',
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_active_idx on public.projects (user_id, updated_at desc)
  where deleted_at is null;
create index projects_user_trashed_idx on public.projects (user_id, deleted_at desc)
  where deleted_at is not null;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null check (type in ('prd', 'ia', 'screen_list', 'policy', 'cursor_prompt')),
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, type)
);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_number integer not null,
  version_name text,
  content text not null default '',
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  email text not null,
  name text not null default '',
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  status text not null default 'pending' check (status in ('active', 'pending')),
  invited_at timestamptz not null default now(),
  unique (project_id, email)
);

create index projects_user_id_idx on public.projects (user_id);
create index project_members_project_id_idx on public.project_members (project_id);
create index documents_project_id_idx on public.documents (project_id);
create index document_versions_document_id_idx on public.document_versions (document_id);
create index chat_messages_project_id_idx on public.chat_messages (project_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.project_members enable row level security;

create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

create policy "users_delete_own" on public.users
  for delete using (auth.uid() = id);

create policy "projects_all_own" on public.projects
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "documents_all_own" on public.documents
  for all using (
    exists (
      select 1 from public.projects
      where projects.id = documents.project_id
        and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = documents.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "document_versions_all_own" on public.document_versions
  for all using (
    exists (
      select 1 from public.documents d
      join public.projects p on p.id = d.project_id
      where d.id = document_versions.document_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      join public.projects p on p.id = d.project_id
      where d.id = document_versions.document_id
        and p.user_id = auth.uid()
    )
  );

create policy "chat_messages_all_own" on public.chat_messages
  for all using (
    exists (
      select 1 from public.projects
      where projects.id = chat_messages.project_id
        and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = chat_messages.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "project_members_select" on public.project_members
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = project_members.project_id
        and projects.user_id = auth.uid()
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = project_members.project_id
        and pm.user_id = auth.uid()
        and pm.status = 'active'
    )
  );

create policy "project_members_manage_owner" on public.project_members
  for all using (
    exists (
      select 1 from public.projects
      where projects.id = project_members.project_id
        and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = project_members.project_id
        and projects.user_id = auth.uid()
    )
  );

create table public.project_activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  action text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.generation_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null check (status in ('running', 'completed', 'cancelled', 'failed')),
  completed_steps text[] not null default '{}',
  interview_answers jsonb not null default '{}',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index project_activities_project_id_idx on public.project_activities (project_id);
create index generation_runs_project_id_idx on public.generation_runs (project_id);

alter table public.project_activities enable row level security;
alter table public.generation_runs enable row level security;

create policy "project_activities_select" on public.project_activities
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = project_activities.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "project_activities_insert" on public.project_activities
  for insert with check (
    exists (
      select 1 from public.projects
      where projects.id = project_activities.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "generation_runs_select" on public.generation_runs
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = generation_runs.project_id
        and projects.user_id = auth.uid()
    )
  );
