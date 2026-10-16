-- 009: Remove recursive project_members SELECT policy.
--
-- Verified on 2026-10-16 on the active Plan OS database using a READ ONLY
-- transaction and SET LOCAL ROLE authenticated:
-- ERROR 42P17: infinite recursion detected in policy for relation "project_members".
--
-- WHY: migration 006 introduced a SELECT policy whose EXISTS subquery reads
-- public.project_members again, causing the PostgreSQL policy rewriter to
-- recursively expand the same relation's RLS policy.
--
-- Existing public.can_access_project(uuid) delegates to public.get_project_role,
-- a SECURITY DEFINER function owned by the database's BYPASSRLS role. It
-- authorizes project owner or ACTIVE member without a recursive policy scan.
--
-- The change is intentionally restricted to the SELECT policy. No tables,
-- functions, grants, data, or other RLS policies are changed in this migration.
--
-- IMPORTANT: This file is a proposed migration in a Draft PR. Do NOT run
-- against the live Plan OS project until isolated-db regression tests and
-- explicit release approval are complete.

drop policy if exists "멤버 조회" on public.project_members;

create policy "멤버 조회"
  on public.project_members
  for select
  using (public.can_access_project(project_id));
