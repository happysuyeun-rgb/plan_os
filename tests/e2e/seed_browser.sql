-- Disposable LOCAL Supabase browser QA fixture only.
-- This file is never applied to the hosted Plan OS database.
-- The browser QA account is created by local GoTrue first.
update public.users set
  name = 'E2E Test User',
  onboarding_completed = true
where id = :'user_id'::uuid;

insert into public.projects (id,user_id,title,description,memory_summary)
values (
  :'project_id'::uuid,
  :'user_id'::uuid,
  'Phase0 E2E Smoke Project',
  'Synthetic disposable browser QA project',
  'Synthetic, generated for isolated browser QA'
);

insert into public.documents(project_id,type,content)
values (
  :'project_id'::uuid,
  'prd',
  '# Phase0 E2E Document\n\nBrowser smoke fixture; not production data.'
);

insert into public.documents(project_id,type,content)
values (
  :'project_id'::uuid,
  'ia',
  '# Phase0 IA Fixture\n\nSecond independent synthetic document.'
);
