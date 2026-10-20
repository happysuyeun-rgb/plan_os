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
    set content = p_content, content_revision = content_revision + 1
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
