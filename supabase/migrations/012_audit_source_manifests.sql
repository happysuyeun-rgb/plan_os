-- S2 isolated development migration. Never apply to production before RLS testing.
create extension if not exists pgcrypto;
create table public.audit_source_manifests (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 created_by uuid not null references auth.users(id),
 sources jsonb not null check (jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) between 2 and 20),
 created_at timestamptz not null default now()
);
alter table public.audit_source_manifests enable row level security;
create policy "audit_manifest_owner_read" on public.audit_source_manifests
 for select to authenticated using (public.get_project_role(project_id) = 'owner');
revoke insert, update, delete on public.audit_source_manifests from anon, authenticated;
grant select on public.audit_source_manifests to authenticated;

create function public.create_audit_source_manifest(p_project_id uuid, p_document_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_sources jsonb; v_id uuid;
begin
 if auth.uid() is null or public.get_project_role(p_project_id) is distinct from 'owner' then
   raise exception 'NOT_ALLOWED' using errcode = '42501';
 end if;
 if p_document_ids is null or cardinality(p_document_ids) < 2 or cardinality(p_document_ids) > 20
   or cardinality(p_document_ids) <> (select count(distinct v) from unnest(p_document_ids) as t(v)) then
   raise exception 'INVALID_SOURCE_SELECTION' using errcode = '22023';
 end if;
 select jsonb_agg(jsonb_build_object('documentId',d.id,'type',d.type,
   'revision',d.updated_at,'digest','sha256:' || encode(digest(convert_to(d.content,'UTF8'),'sha256'),'hex')) order by d.id)
 into v_sources from public.documents d where d.project_id=p_project_id and d.id=any(p_document_ids);
 if coalesce(jsonb_array_length(v_sources),0) <> cardinality(p_document_ids) then
   raise exception 'SOURCE_NOT_FOUND' using errcode = '22023';
 end if;
 insert into public.audit_source_manifests(project_id,created_by,sources)
 values(p_project_id,auth.uid(),v_sources) returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.create_audit_source_manifest(uuid,uuid[]) from public;
grant execute on function public.create_audit_source_manifest(uuid,uuid[]) to authenticated;

create function public.is_audit_source_manifest_current(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_project uuid; v_sources jsonb;
begin
 select project_id,sources into v_project,v_sources from public.audit_source_manifests where id=p_id;
 if v_project is null or public.get_project_role(v_project) is distinct from 'owner' then return false; end if;
 return not exists (
  select 1 from jsonb_array_elements(v_sources) as e
  left join public.documents d on d.id=(e->>'documentId')::uuid and d.project_id=v_project
  where d.id is null or to_jsonb(d.updated_at) <> (e->'revision')
    or ('sha256:' || encode(digest(convert_to(d.content,'UTF8'),'sha256'),'hex')) <> (e->>'digest')
 );
end; $$;
revoke all on function public.is_audit_source_manifest_current(uuid) from public;
grant execute on function public.is_audit_source_manifest_current(uuid) to authenticated;
