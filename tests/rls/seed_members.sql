-- Disposable isolated CI database fixture. No real account IDs or personal data.
-- Set up only after running repository migrations 001..008.
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000001','owner-a@example.test','{}'),
 ('00000000-0000-0000-0000-000000000002','editor-b@example.test','{}'),
 ('00000000-0000-0000-0000-000000000003','viewer-c@example.test','{}'),
 ('00000000-0000-0000-0000-000000000004','pending-d@example.test','{}'),
 ('00000000-0000-0000-0000-000000000005','owner-f@example.test','{}'),
 ('00000000-0000-0000-0000-000000000006','editor-e@example.test','{}'),
 ('00000000-0000-0000-0000-000000000007','outsider-g@example.test','{}');

insert into public.projects(id,user_id,title) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000001','Project One'),
 ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000005','Project Two');

insert into public.project_members(project_id,user_id,email,role,status) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000002','editor-b@example.test','editor','active'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000003','viewer-c@example.test','viewer','active'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000004','pending-d@example.test','viewer','pending'),
 ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000006','editor-e@example.test','editor','active');

insert into public.documents(project_id,type,content) values
 ('11111111-1111-1111-1111-111111111111','prd','Project One PRD'),
 ('22222222-2222-2222-2222-222222222222','prd','Project Two PRD');

-- These are development-only fixtures and table privileges modeled after
-- the Supabase authenticated/anon grants; RLS must still deny unwanted rows.
grant select on all tables in schema public to authenticated, anon;
