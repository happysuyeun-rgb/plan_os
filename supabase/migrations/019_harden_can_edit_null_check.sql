-- 019: Make can_edit_project_content NULL-safe.
--
-- Defect found during C-02 isolated-DB verification (2026-10-21):
-- get_project_role() returns NULL for a caller with no membership row in
-- the project (complete outsider, or a member of a DIFFERENT project).
-- `NULL in ('owner','editor')` is NULL, so can_edit_project_content()
-- returned NULL instead of false. RLS policies treat NULL as deny, so
-- table access stayed safe, but the PL/pgSQL guards in
-- restore_document_version (015) and commit_chat_document_edit (016):
--
--   if not exists (...) or not public.can_edit_project_content(...) then
--     raise ...
--
-- evaluated `not NULL` to NULL, which IF treats as false — the guard was
-- skipped and an outsider with a leaked document/version id could restore
-- or chat-edit any document. Verified against disposable PostgreSQL:
-- pre-019 an outsider successfully restored and chat-edited a document.
--
-- Fix: the helper can never return NULL. Every caller (RLS policies in
-- 006/011, RPCs in 015/016/018) becomes safe at once. Callers that need
-- belt-and-braces should still write `coalesce(check, false)` (018 does).
-- get_project_role() itself is unchanged: its NULL is meaningful for
-- display purposes ("no role"), it just must not feed boolean guards raw.

create or replace function public.can_edit_project_content(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_project_role(p_project_id) in ('owner', 'editor'), false)
$$;
