-- LOCAL DISPOSABLE Supabase Auth integration fixture. Never run on hosted DB.
-- Actual auth users (and public.users via migration 001 trigger) have already
-- been created by the local GoTrue admin API and signed in with real JWTs.
-- Parameters are trusted UUIDs returned from local Auth in this CI run.
-- Re-runnable: every suite importing the Auth module creates fresh users, so
-- clear the previous fixture projects first (children cascade from projects).
delete from public.projects
 where id in ('11111111-1111-1111-1111-111111111111',
              '22222222-2222-2222-2222-222222222222');

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
-- projects SELECT is required because project_members_manage_owner (ALL)
-- evaluates EXISTS(... FROM projects ...) as the invoking role; without it
-- PostgREST returns 42501 even when the member SELECT policy would allow.
grant usage on schema public to authenticated, anon;
grant select on public.users, public.projects, public.project_members, public.documents
  to authenticated, anon;
grant update on public.users, public.documents to authenticated;
-- S1 / AI-review bind path (disposable local only)
grant select, insert, update on public.project_tasks to authenticated;
