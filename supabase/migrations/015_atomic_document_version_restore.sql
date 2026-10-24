-- 015 (renumbered from PR 011): transactionally restore a historical version with a stable operation id.
-- Draft PR #17 / P0 Issue #16. Runs only in disposable local Supabase CI until
-- separate explicit production schema approval.
--
-- SECURITY:
-- * SECURITY DEFINER owned by migration owner (postgres), explicit JWT role
--   and active project editor/owner checks before bypassing table RLS.
-- * No client-supplied snapshot content is accepted. Target content is fetched
--   from the same document's immutable historical version.
-- * The locked parent document serializes restore numbering for this document.
-- * An operation UUID makes retry after a lost HTTP response idempotent.
-- * All rows are modified by ONE database RPC transaction; SQL exceptions
--   roll back checkpoint INSERT, restore INSERT, current content UPDATE and
--   operation log INSERT together.
--
-- Restoring an unsnapshotted CURRENT body first records a "복원 전 자동 보관"
-- checkpoint. This is necessary for the existing UI statement "현재 버전 보존".
-- The normal v1(old) -> v2(current) -> restore v1 flow still creates only v3.

create table if not exists public.document_restore_operations (
  id uuid primary key,
  document_id uuid not null references public.documents(id) on delete cascade,
  source_version_id uuid not null references public.document_versions(id) on delete cascade,
  result_version_id uuid not null references public.document_versions(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists document_restore_operations_document_idx
  on public.document_restore_operations(document_id, created_at desc);

alter table public.document_restore_operations enable row level security;
revoke all on public.document_restore_operations from public, anon, authenticated;

create or replace function public.restore_document_version(
  p_document_id uuid,
  p_version_id uuid,
  p_operation_id uuid
)
returns public.documents
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_document public.documents%rowtype;
  v_target public.document_versions%rowtype;
  v_existing public.document_restore_operations%rowtype;
  v_recent_content text;
  v_last_number integer := 0;
  v_next_number integer;
  v_restored_version_id uuid;
begin
  if auth.role() is distinct from 'authenticated'
     or v_actor_id is null
     or p_document_id is null
     or p_version_id is null
     or p_operation_id is null then
    raise exception 'authenticated restore request required' using errcode = '42501';
  end if;

  -- Lock before checking operation history and allocating version numbers.
  -- Each successful restore of this document holds this lock until commit.
  select * into v_document
    from public.documents d
   where d.id = p_document_id
     for update;
  if not found then
    raise exception 'document not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.projects p
    where p.id = v_document.project_id
      and p.deleted_at is null
  ) or not public.can_edit_project_content(v_document.project_id) then
    raise exception 'insufficient project permissions to restore document'
      using errcode = '42501';
  end if;

  select * into v_target
    from public.document_versions v
   where v.id = p_version_id
     and v.document_id = p_document_id;
  if not found then
    raise exception 'historical version does not belong to document'
      using errcode = '42501';
  end if;

  select * into v_existing
    from public.document_restore_operations r
   where r.id = p_operation_id;
  if found then
    if v_existing.actor_id is distinct from v_actor_id
       or v_existing.document_id is distinct from p_document_id
       or v_existing.source_version_id is distinct from p_version_id then
      raise exception 'restore operation id already belongs to another request'
        using errcode = '42501';
    end if;
    -- Return the current document rather than replaying the original version
    -- over later edits after a successful previously applied operation.
    return v_document;
  end if;

  select v.version_number, v.content
    into v_last_number, v_recent_content
    from public.document_versions v
   where v.document_id = p_document_id
   order by v.version_number desc
   limit 1;
  if not found then
    v_last_number := 0;
    v_recent_content := null;
  end if;

  v_next_number := v_last_number + 1;
  if v_last_number = 0 or v_recent_content is distinct from v_document.content then
    insert into public.document_versions
      (document_id, version_number, version_name, content)
    values
      (p_document_id, v_next_number, '복원 전 자동 보관', v_document.content);
    v_next_number := v_next_number + 1;
  end if;

  insert into public.document_versions
    (document_id, version_number, version_name, content)
  values
    (p_document_id, v_next_number, '복원', v_target.content)
  returning id into v_restored_version_id;

  update public.documents
     set content = v_target.content
   where id = p_document_id
  returning * into v_document;

  insert into public.document_restore_operations
    (id, document_id, source_version_id, result_version_id, actor_id)
  values
    (p_operation_id, p_document_id, p_version_id,
     v_restored_version_id, v_actor_id);

  return v_document;
end;
$$;

revoke all on function public.restore_document_version(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.restore_document_version(uuid, uuid, uuid)
  to authenticated;
