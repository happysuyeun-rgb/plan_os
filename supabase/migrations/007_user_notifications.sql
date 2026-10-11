-- N4: user_notifications 테이블 + RLS

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  type text not null,
  actor_id uuid references public.users(id) on delete set null,
  actor_name text not null,
  title text not null,
  body text not null,
  link_path text not null,
  thread_root_id uuid,
  comment_id uuid,
  chat_message_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_user_unread
  on public.user_notifications (user_id, created_at desc)
  where read_at is null;

create index idx_notifications_user_project
  on public.user_notifications (user_id, project_id, created_at desc);

alter table public.user_notifications enable row level security;

create policy "user_notifications_select_own" on public.user_notifications
  for select using (user_id = auth.uid());

create policy "user_notifications_update_own" on public.user_notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_notifications_insert_actor" on public.user_notifications
  for insert with check (
    actor_id = auth.uid()
    and public.can_access_project(project_id)
  );
