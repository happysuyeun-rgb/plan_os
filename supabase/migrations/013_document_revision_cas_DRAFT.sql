-- G1-B-05 experimental server version CAS. NOT applied to any database.
-- Prerequisite: all other document writers (regenerate, chat, restore, upsert)
-- must advance the same revision, or stale edit detection is not comprehensive.
alter table public.documents add column if not exists content_revision bigint not null default 0;
create or replace function public.save_document_content_cas(
  p_document_id uuid, p_expected_revision bigint, p_content text
) returns public.documents
language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare v_row public.documents%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode='42501';
  end if;
  update public.documents
    set content = p_content
    where id = p_document_id and content_revision = p_expected_revision
    returning * into v_row;
  if not found then
    raise exception 'document unavailable or changed' using errcode='P0001';
  end if;
  return v_row;
end;
$$;
revoke all on function public.save_document_content_cas(uuid,bigint,text) from public;
grant execute on function public.save_document_content_cas(uuid,bigint,text) to authenticated;
-- Do not apply to prod. BEFORE enabling: ensure update RLS checks edit role,
-- forbid direct content_revision manipulation, and make ALL writers revision-aware.

-- G1-B-06 design-only revision trigger. This draft MUST NOT be deployed.
-- The trigger protects revision integrity but does not itself stop a legacy
-- direct UPDATE from overwriting concurrent content; every writer still
-- needs conditional mutation or a guarded RPC.
create or replace function public.bump_document_content_revision()
returns trigger language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.content is distinct from old.content then
    new.content_revision := old.content_revision + 1;
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

-- CAS UPDATE itself must not increment revision a second time: trigger does it.
