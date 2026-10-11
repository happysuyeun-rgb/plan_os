-- project_members_select 재귀 정책 수정

drop policy if exists "project_members_select" on public.project_members;

create policy "멤버 조회" on public.project_members
  for select using (
    auth.uid() = user_id
    or
    auth.uid() = (
      select user_id from public.projects
      where id = project_id
    )
  );
