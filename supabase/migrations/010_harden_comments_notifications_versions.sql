-- 010: harden comment ownership, reaction/participant rows, notifications,
-- and immutable document version history.
--
-- Depends on proposed 009; TEST IN DISPOSABLE LOCAL SUPABASE ONLY.
-- Never run on the hosted Plan OS project without separate approval.
--
-- Existing public.can_access_project/get_project_role use the security-definer
-- helper as introduced in migration 006. We retain viewer participation and
-- root-thread resolve/reopen permissions used by the current comment UI.

-- The current client soft-deletes comments with { deleted_at: now, body: '' },
-- but migration 005 disallows empty body on *all* rows. Fix this mismatch.
alter table public.project_comments
  drop constraint if exists project_comments_body_check;
alter table public.project_comments
  add constraint project_comments_body_check
  check (
    (deleted_at is null and char_length(body) between 1 and 4000)
    or
    (deleted_at is not null and char_length(body) <= 4000)
  );

-- UPDATE RLS alone cannot restrict which fields an allowed member modifies.
-- Protect comment attribution, the original parent/anchor/project, other
-- authors' text, and deleted thread state with a narrowly scoped trigger.
create or replace function public.guard_project_comment_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  acting_user uuid := auth.uid();
  is_owner boolean := public.get_project_role(old.project_id) = 'owner';
  deleting boolean := old.deleted_at is null and new.deleted_at is not null;
begin
  if acting_user is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;

  if row(new.id, new.project_id, new.document_id, new.thread_root_id,
         new.parent_id, new.user_id, new.author_name, new.author_avatar_url,
         new.anchor_type, new.anchor_meta, new.created_at)
     is distinct from
     row(old.id, old.project_id, old.document_id, old.thread_root_id,
         old.parent_id, old.user_id, old.author_name, old.author_avatar_url,
         old.anchor_type, old.anchor_meta, old.created_at)
  then
    raise exception 'comment ownership and attribution are immutable'
      using errcode = '42501';
  end if;

  if old.deleted_at is not null then
    raise exception 'deleted comments cannot be modified'
      using errcode = '42501';
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    if not deleting or (acting_user <> old.user_id and not is_owner) then
      raise exception 'only author or project owner can delete comment'
        using errcode = '42501';
    end if;
    if new.body <> '' then
      raise exception 'deleted comment text must be redacted'
        using errcode = '42501';
    end if;
  end if;

  if new.body is distinct from old.body
     and not deleting
     and acting_user <> old.user_id
  then
    raise exception 'cannot modify another authors comment text'
      using errcode = '42501';
  end if;

  if row(new.status, new.resolved_by, new.resolved_at)
     is distinct from
     row(old.status, old.resolved_by, old.resolved_at)
  then
    if old.parent_id is not null or deleting
       or new.status = old.status then
      raise exception 'only active root thread status can change'
        using errcode = '42501';
    end if;
    if new.status = 'resolved' then
      if new.resolved_by is distinct from acting_user or new.resolved_at is null then
        raise exception 'resolution must be attributed to the acting user'
          using errcode = '42501';
      end if;
    elsif new.status = 'open' then
      if new.resolved_by is not null or new.resolved_at is not null then
        raise exception 'reopening must clear resolution attribution'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_project_comment_update on public.project_comments;
create trigger guard_project_comment_update
before update on public.project_comments
for each row execute function public.guard_project_comment_update();

-- RLS for comments continues to allow all active members to resolve/reopen
-- a root thread, because guard_project_comment_update enforces field-specific
-- ownership and the current UI supports viewer participation.
-- The existing project_comments_update policy is retained on purpose.

drop policy if exists "comment_reactions_write" on public.comment_reactions;
create policy "comment_reactions_insert_self" on public.comment_reactions
  for insert with check (
    user_id = auth.uid() and
    exists (
      select 1 from public.project_comments c
      where c.id = comment_reactions.comment_id
        and c.deleted_at is null
        and public.can_access_project(c.project_id)
    )
  );
create policy "comment_reactions_update_self" on public.comment_reactions
  for update using (
    user_id = auth.uid() and
    exists (
      select 1 from public.project_comments c
      where c.id = comment_reactions.comment_id
        and public.can_access_project(c.project_id)
    )
  ) with check (
    user_id = auth.uid() and
    exists (
      select 1 from public.project_comments c
      where c.id = comment_reactions.comment_id
        and public.can_access_project(c.project_id)
    )
  );
create policy "comment_reactions_delete_self" on public.comment_reactions
  for delete using (
    user_id = auth.uid() and
    exists (
      select 1 from public.project_comments c
      where c.id = comment_reactions.comment_id
        and public.can_access_project(c.project_id)
    )
  );

drop policy if exists "comment_participant_status_write" on public.comment_participant_status;
create policy "comment_participant_status_insert_self" on public.comment_participant_status
  for insert with check (
    user_id = auth.uid() and
    exists (
      select 1 from public.project_comments c
      where c.id = comment_participant_status.thread_root_id
        and c.parent_id is null
        and c.deleted_at is null
        and public.can_access_project(c.project_id)
    )
  );
create policy "comment_participant_status_update_self" on public.comment_participant_status
  for update using (
    user_id = auth.uid() and
    exists (
      select 1 from public.project_comments c
      where c.id = comment_participant_status.thread_root_id
        and public.can_access_project(c.project_id)
    )
  ) with check (
    user_id = auth.uid() and
    exists (
      select 1 from public.project_comments c
      where c.id = comment_participant_status.thread_root_id
        and public.can_access_project(c.project_id)
    )
  );
create policy "comment_participant_status_delete_self" on public.comment_participant_status
  for delete using (
    user_id = auth.uid() and
    exists (
      select 1 from public.project_comments c
      where c.id = comment_participant_status.thread_root_id
        and public.can_access_project(c.project_id)
    )
  );

-- Notifications may be sent only to a real active project participant,
-- including the owner. It must never send to arbitrary users elsewhere.
drop policy if exists "user_notifications_insert_actor" on public.user_notifications;
create policy "user_notifications_insert_actor" on public.user_notifications
  for insert with check (
    actor_id = auth.uid()
    and public.can_access_project(project_id)
    and exists (
      select 1 from public.projects p
      where p.id = user_notifications.project_id
        and p.deleted_at is null
        and (
          p.user_id = user_notifications.user_id
          or exists (
            select 1 from public.project_members pm
            where pm.project_id = p.id
              and pm.user_id = user_notifications.user_id
              and pm.status = 'active'
          )
        )
    )
    and (
      document_id is null or
      exists (
        select 1 from public.documents d
        where d.id = user_notifications.document_id
          and d.project_id = user_notifications.project_id
      )
    )
  );

-- Notification metadata must not be changed by recipients. The current UI
-- updates read_at only, and never "unreads" an already-read notification.
create or replace function public.guard_notification_read_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is distinct from old.user_id then
    raise exception 'notification recipient required' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'read_at') is distinct from
     (to_jsonb(old) - 'read_at') then
    raise exception 'only notification read_at may change'
      using errcode = '42501';
  end if;
  if old.read_at is not null and
     new.read_at is distinct from old.read_at then
    raise exception 'read notification cannot be reset'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_notification_read_update on public.user_notifications;
create trigger guard_notification_read_update
before update on public.user_notifications
for each row execute function public.guard_notification_read_update();

-- Historical document versions are append-only for authenticated clients.
-- The current UI inserts a new version rather than modifying old versions.
drop policy if exists "document_versions_update" on public.document_versions;
revoke update on public.document_versions from authenticated, anon;
