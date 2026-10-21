-- 018: Formal server Revision CAS for document content (verified in an
-- isolated PostgreSQL database before any other environment; see the G1
-- integration execution plan, stage C-02). This supersedes the experimental
-- 017 draft, which must never be applied together with this file.
--
-- Rules:
-- * documents.content_revision starts at 0 and advances exactly once per
--   actual content change, for EVERY writer (autosave RPC, restore/chat
--   RPCs, generation upserts, direct UPDATE) via the trigger below.
-- * save_document_content_cas only writes when the caller's expected
--   revision equals the stored revision. A mismatch raises SQLSTATE 40001
--   (DOCUMENT_REVISION_CONFLICT) and changes nothing.
-- * Retry safety: re-sending the same (expected_revision, content) after a
--   lost response succeeds as a no-op when the document already holds that
--   exact content at expected_revision + 1. A different content at a stale
--   revision always conflicts.
-- * The RPC re-checks authentication, an active (not deleted) project, and
--   editor/owner permission on the server. UI hiding is not the guard.
-- * Direct client UPDATE is not removed here: it still requires the
--   editor/owner RLS policy, and the trigger advances the revision so CAS
--   writers detect it as a conflict instead of silently overwriting it.
--   Removing the direct UPDATE path is a separate cutoff migration that
--   must wait until every client writer uses RPCs.

alter table public.documents
  add column if not exists content_revision bigint not null default 0;

create or replace function public.bump_document_content_revision()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.content is distinct from old.content then
    -- Assign (not increment) so an explicit revision set by a caller can
    -- never double-count: the stored value always moves from old to old + 1.
    new.content_revision := old.content_revision + 1;
    new.updated_at := now();
  else
    new.content_revision := old.content_revision;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bump_document_content_revision on public.documents;
create trigger trg_bump_document_content_revision
before update on public.documents
for each row execute function public.bump_document_content_revision();

create or replace function public.save_document_content_cas(
  p_document_id uuid,
  p_expected_revision bigint,
  p_content text
)
returns public.documents
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.documents%rowtype;
  v_project_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_document_id is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'invalid CAS request' using errcode = '22023';
  end if;

  select d.project_id into v_project_id
  from public.documents d
  join public.projects p on p.id = d.project_id
  where d.id = p_document_id and p.deleted_at is null;
  -- coalesce is load-bearing: a permission helper that can return NULL
  -- would make `not <check>` evaluate to NULL, which IF treats as false
  -- and silently skips the guard (see migration 019).
  if v_project_id is null
     or not coalesce(public.can_edit_project_content(v_project_id), false) then
    raise exception 'document unavailable or not editable' using errcode = '42501';
  end if;

  -- Lock the row so two concurrent CAS calls serialize on the same revision:
  -- exactly one of them can observe content_revision = p_expected_revision.
  select * into v_row from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'document unavailable or not editable' using errcode = '42501';
  end if;

  if v_row.content_revision = p_expected_revision then
    if v_row.content is not distinct from p_content then
      return v_row; -- already applied with identical content: no-op success
    end if;
    update public.documents
      set content = p_content
      where id = p_document_id
      returning * into v_row;
    return v_row;
  end if;

  -- Idempotent retry of the same request after its response was lost.
  if v_row.content_revision = p_expected_revision + 1
     and v_row.content is not distinct from p_content then
    return v_row;
  end if;

  raise exception 'document revision conflict'
    using errcode = '40001',
          detail = 'expected revision does not match the stored revision';
end;
$$;

revoke all on function public.save_document_content_cas(uuid, bigint, text) from public;
grant execute on function public.save_document_content_cas(uuid, bigint, text) to authenticated;
