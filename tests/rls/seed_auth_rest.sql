-- LOCAL DISPOSABLE Supabase Auth integration fixture. Never run on hosted DB.
-- Actual auth users (and public.users via migration 001 trigger) have already
-- been created by the local GoTrue admin API and signed in with real JWTs.
-- Parameters are trusted UUIDs returned from local Auth in this CI run.
insert into public.projects(id,user_id,title) values
 ('11111111-1111-1111-1111-111111111111', :'owner_id'::uuid, 'Local Project One'),
 ('22222222-2222-2222-2222-222222222222', :'other_owner_id'::uuid, 'Local Project Two');

insert into public.project_members(project_id,user_id,email,role,status) values
 ('11111111-1111-1111-1111-111111111111', :'editor_id'::uuid, 'editor@example.test', 'editor','active'),
 ('11111111-1111-1111-1111-111111111111', :'viewer_id'::uuid, 'viewer@example.test', 'viewer','active'),
 ('11111111-1111-1111-1111-111111111111', :'pending_id'::uuid,'pending@example.test', 'viewer','pending'),
 ('22222222-2222-2222-2222-222222222222', :'other_editor_id'::uuid,'other-editor@example.test','editor','active');

insert into public.documents(project_id,type,content) values
 ('11111111-1111-1111-1111-111111111111', 'prd', 'One Project PRD'),
 ('22222222-2222-2222-2222-222222222222', 'prd', 'Two Project PRD');

-- The local PostgREST roles must be granted SQL privileges for RLS testing.
-- These grants are strictly in disposable PostgreSQL containers.
grant usage on schema public to authenticated, anon;
grant select on public.project_members, public.documents to authenticated, anon;
grant update on public.documents to authenticated;
