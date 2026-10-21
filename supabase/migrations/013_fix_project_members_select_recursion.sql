-- 013 (renumbered from PR 009): Remove recursive project_members SELECT policy.
--
-- Live, READ ONLY reproduction on 2026-10-16:
-- ERROR 42P17: infinite recursion detected in policy for relation "project_members".
-- Cause: migration 006's SELECT policy queries public.project_members within itself.
--
-- This replaces ONLY that SELECT policy with a nonrecursive role helper.
-- Preserve the previous rule allowing an authenticated invited user with a
-- linked user_id to see THEIR OWN pending invitation row. Pending members
-- must NOT see other members or project documents without active membership.
-- The security-definer helper is owned by postgres/BYPASSRLS in the current DB.
--
-- Deployment gate: isolated Postgres/Supabase role tests + browser invitation
-- regression + explicit approval. Do not run on the live Plan OS database.

drop policy if exists "멤버 조회" on public.project_members;

create policy "멤버 조회"
  on public.project_members
  for select
  using (
    auth.uid() = user_id
    or public.can_access_project(project_id)
  );
