-- Disposable LOCAL Supabase browser QA fixture only.
-- This file is never applied to the hosted Plan OS database.
-- The browser QA account is created by local GoTrue first.
update public.users set
  name = 'E2E Test User',
  onboarding_completed = true
where id = :'user_id'::uuid;

insert into public.projects (id,user_id,title,description,memory_summary)
values (
  '77777777-7777-4777-8777-777777777777',
  :'user_id'::uuid,
  'Phase0 E2E Smoke Project',
  'Synthetic disposable browser QA project',
  'Synthetic, generated for isolated browser QA'
);

insert into public.documents(project_id,type,content)
values (
  '77777777-7777-4777-8777-777777777777',
  'prd',
  '# Phase0 E2E Document\n\nBrowser smoke fixture; not production data.'
);
