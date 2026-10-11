-- M3: 프로젝트 멤버(editor/viewer) DB 접근 RLS

create or replace function public.get_project_role(p_project_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.projects p
      where p.id = p_project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    ) then 'owner'
    else (
      select pm.role::text
      from public.project_members pm
      where pm.project_id = p_project_id
        and pm.user_id = auth.uid()
        and pm.status = 'active'
      limit 1
    )
  end;
$$;

create or replace function public.can_access_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_project_role(p_project_id) is not null;
$$;

create or replace function public.can_edit_project_content(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_project_role(p_project_id) in ('owner', 'editor');
$$;

-- projects: 소유자 전체 + 멤버 읽기
drop policy if exists "projects_all_own" on public.projects;

create policy "projects_owner_all" on public.projects
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "projects_member_select" on public.projects
  for select using (
    public.can_access_project(id)
    and deleted_at is null
  );

-- project_members: 동료 멤버 목록 조회
drop policy if exists "멤버 조회" on public.project_members;

create policy "멤버 조회" on public.project_members
  for select using (
    auth.uid() = user_id
    or auth.uid() = (select user_id from public.projects where id = project_id)
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = project_members.project_id
        and pm.user_id = auth.uid()
        and pm.status = 'active'
    )
  );

-- documents
drop policy if exists "documents_all_own" on public.documents;

create policy "documents_select_member" on public.documents
  for select using (public.can_access_project(project_id));

create policy "documents_insert_editor" on public.documents
  for insert with check (public.can_edit_project_content(project_id));

create policy "documents_update_editor" on public.documents
  for update using (public.can_edit_project_content(project_id))
  with check (public.can_edit_project_content(project_id));

create policy "documents_delete_owner" on public.documents
  for delete using (public.get_project_role(project_id) = 'owner');

-- document_versions
drop policy if exists "document_versions_all_own" on public.document_versions;

create policy "document_versions_select" on public.document_versions
  for select using (
    exists (
      select 1 from public.documents d
      where d.id = document_versions.document_id
        and public.can_access_project(d.project_id)
    )
  );

create policy "document_versions_write" on public.document_versions
  for insert with check (
    exists (
      select 1 from public.documents d
      where d.id = document_versions.document_id
        and public.can_edit_project_content(d.project_id)
    )
  );

create policy "document_versions_update" on public.document_versions
  for update using (
    exists (
      select 1 from public.documents d
      where d.id = document_versions.document_id
        and public.can_edit_project_content(d.project_id)
    )
  );

-- chat_messages
drop policy if exists "chat_messages_all_own" on public.chat_messages;

create policy "chat_messages_select" on public.chat_messages
  for select using (public.can_access_project(project_id));

create policy "chat_messages_insert" on public.chat_messages
  for insert with check (public.can_edit_project_content(project_id));

create policy "chat_messages_update" on public.chat_messages
  for update using (public.can_edit_project_content(project_id))
  with check (public.can_edit_project_content(project_id));

-- project_activities
drop policy if exists "project_activities_select" on public.project_activities;
drop policy if exists "project_activities_insert" on public.project_activities;

create policy "project_activities_select" on public.project_activities
  for select using (public.can_access_project(project_id));

create policy "project_activities_insert" on public.project_activities
  for insert with check (public.can_access_project(project_id));

-- generation_runs
drop policy if exists "본인 generation_runs만" on public.generation_runs;

create policy "generation_runs_access" on public.generation_runs
  for all using (public.can_edit_project_content(project_id))
  with check (public.can_edit_project_content(project_id));

-- project_comments
drop policy if exists "project_comments_all_owner" on public.project_comments;

create policy "project_comments_select" on public.project_comments
  for select using (public.can_access_project(project_id));

create policy "project_comments_insert" on public.project_comments
  for insert with check (
    public.can_access_project(project_id)
    and user_id = auth.uid()
  );

create policy "project_comments_update" on public.project_comments
  for update using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));

create policy "project_comments_delete" on public.project_comments
  for delete using (
    public.can_access_project(project_id)
    and (
      user_id = auth.uid()
      or public.get_project_role(project_id) = 'owner'
    )
  );

-- comment_reactions
drop policy if exists "comment_reactions_all_owner" on public.comment_reactions;

create policy "comment_reactions_select" on public.comment_reactions
  for select using (
    exists (
      select 1 from public.project_comments c
      where c.id = comment_reactions.comment_id
        and public.can_access_project(c.project_id)
    )
  );

create policy "comment_reactions_write" on public.comment_reactions
  for all using (
    exists (
      select 1 from public.project_comments c
      where c.id = comment_reactions.comment_id
        and public.can_access_project(c.project_id)
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.project_comments c
      where c.id = comment_reactions.comment_id
        and public.can_access_project(c.project_id)
    )
  );

-- comment_participant_status
drop policy if exists "comment_participant_status_all_owner" on public.comment_participant_status;

create policy "comment_participant_status_select" on public.comment_participant_status
  for select using (
    exists (
      select 1 from public.project_comments c
      where c.id = comment_participant_status.thread_root_id
        and public.can_access_project(c.project_id)
    )
  );

create policy "comment_participant_status_write" on public.comment_participant_status
  for all using (
    exists (
      select 1 from public.project_comments c
      where c.id = comment_participant_status.thread_root_id
        and public.can_access_project(c.project_id)
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.project_comments c
      where c.id = comment_participant_status.thread_root_id
        and public.can_access_project(c.project_id)
    )
  );
