-- 028: S2 F-201/F-202 execution gate — re-verify server digests before
-- audit/mock review runs. Additive only; does not alter document content.
-- Stale or missing sources raise SQLSTATE P4001 (same family as document/
-- task/PM CAS). PostgREST surfaces this as a client conflict; the app maps
-- it to HTTP-style 409 guidance. Never use 40001 (PostgREST retries).

create or replace function public.assert_audit_source_manifest_current(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid;
  v_sources jsonb;
  v_stale boolean;
begin
  select project_id, sources into v_project, v_sources
  from public.audit_source_manifests
  where id = p_id;

  if v_project is null then
    raise exception 'MANIFEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  if auth.uid() is null or public.get_project_role(v_project) is distinct from 'owner' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(v_sources) as e
    left join public.documents d
      on d.id = (e->>'documentId')::uuid
     and d.project_id = v_project
    where d.id is null
       or to_jsonb(d.updated_at) is distinct from (e->'revision')
       or (
         'sha256:' || encode(
           extensions.digest(convert_to(d.content, 'UTF8'), 'sha256'),
           'hex'
         )
       ) is distinct from (e->>'digest')
  ) into v_stale;

  if v_stale then
    raise exception 'STALE_SOURCE' using errcode = 'P4001';
  end if;

  return true;
end;
$$;

revoke all on function public.assert_audit_source_manifest_current(uuid) from public;
grant execute on function public.assert_audit_source_manifest_current(uuid) to authenticated;

comment on function public.assert_audit_source_manifest_current(uuid) is
  'F-202: recompute document digests server-side before audit execution; STALE_SOURCE/P4001 on mismatch';
