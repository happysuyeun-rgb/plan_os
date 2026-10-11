-- 멤버 코멘트 (C2): project_comments + reactions + participant status

create table public.project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  thread_root_id uuid references public.project_comments(id) on delete cascade,
  parent_id uuid references public.project_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  author_name text not null default '',
  author_avatar_url text not null default '',
  body text not null check (char_length(body) between 1 and 4000),
  anchor_type text not null default 'none'
    check (anchor_type in ('region', 'none', 'project')),
  anchor_meta jsonb not null default '{}',
  status text not null default 'open'
    check (status in ('open', 'resolved')),
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index project_comments_document_idx
  on public.project_comments (document_id, status)
  where deleted_at is null and parent_id is null;

create index project_comments_thread_idx
  on public.project_comments (thread_root_id, created_at);

create index project_comments_project_idx
  on public.project_comments (project_id)
  where deleted_at is null;

create table public.comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.project_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id, emoji)
);

create index comment_reactions_comment_id_idx on public.comment_reactions (comment_id);

create table public.comment_participant_status (
  thread_root_id uuid not null references public.project_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'completed')),
  completed_at timestamptz,
  primary key (thread_root_id, user_id)
);

create trigger project_comments_updated_at
  before update on public.project_comments
  for each row execute function public.set_updated_at();

alter table public.project_comments enable row level security;
alter table public.comment_reactions enable row level security;
alter table public.comment_participant_status enable row level security;

-- 프로젝트 소유자만 접근 (기존 documents/chat_messages와 동일)
create policy "project_comments_all_owner" on public.project_comments
  for all using (
    exists (
      select 1 from public.projects
      where projects.id = project_comments.project_id
        and projects.user_id = auth.uid()
        and projects.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = project_comments.project_id
        and projects.user_id = auth.uid()
        and projects.deleted_at is null
    )
  );

create policy "comment_reactions_all_owner" on public.comment_reactions
  for all using (
    exists (
      select 1 from public.project_comments c
      join public.projects p on p.id = c.project_id
      where c.id = comment_reactions.comment_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.project_comments c
      join public.projects p on p.id = c.project_id
      where c.id = comment_reactions.comment_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

create policy "comment_participant_status_all_owner" on public.comment_participant_status
  for all using (
    exists (
      select 1 from public.project_comments c
      join public.projects p on p.id = c.project_id
      where c.id = comment_participant_status.thread_root_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.project_comments c
      join public.projects p on p.id = c.project_id
      where c.id = comment_participant_status.thread_root_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );
