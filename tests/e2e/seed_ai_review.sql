-- Disposable LOCAL browser AI-review fixture only. Never apply to hosted DBs.
update public.users set
  name = 'AI Review E2E Owner',
  onboarding_completed = true
where id = :'owner_id'::uuid;

insert into public.projects (id,user_id,title,description,memory_summary)
values (
  :'project_id'::uuid,
  :'owner_id'::uuid,
  'AI Review E2E Project',
  'Synthetic disposable Mock AI review project',
  'Synthetic'
);

insert into public.documents(project_id,type,content)
values (
  :'project_id'::uuid,
  'prd',
  '사용자는 로그인 후 대시보드에 진입한다. 결제 흐름은 없다.'
);

insert into public.documents(project_id,type,content)
values (
  :'project_id'::uuid,
  'policy',
  '개인정보 보관 기간은 1년이다.'
);

insert into public.documents(project_id,type,content)
values (
  :'project_id'::uuid,
  'wireframe',
  '대시보드 와이어프레임 초안'
);

-- Editor / Viewer membership for RBAC checks
insert into public.project_members (project_id, user_id, email, role, status)
values
  (:'project_id'::uuid, :'editor_id'::uuid, :'editor_email', 'editor', 'active'),
  (:'project_id'::uuid, :'viewer_id'::uuid, :'viewer_email', 'viewer', 'active');

-- Second project owned by outsider (cross-project deny)
insert into public.projects (id,user_id,title,description,memory_summary)
values (
  :'other_project_id'::uuid,
  :'outsider_id'::uuid,
  'Other Project Forbidden',
  'Must not be readable by AI review owner',
  'Synthetic'
);

-- Disposable PostgREST grants (RLS still applies). projects SELECT is
-- required for project_members_manage_owner policy evaluation.
-- users SELECT/UPDATE is required for login profile + onboarding flags.
grant usage on schema public to authenticated, anon;
grant select on public.users, public.projects, public.project_members, public.documents
  to authenticated, anon;
grant update on public.users to authenticated;
grant select, insert, update on public.project_tasks to authenticated;
grant select, insert, update on public.ai_review_jobs to authenticated;
grant select, insert on public.ai_review_findings, public.ai_review_finding_tasks to authenticated;
