-- 026: Re-assert the append-only contract for document_versions.
--
-- Migration 014 dropped the "document_versions_update" policy and revoked
-- UPDATE on public.document_versions from authenticated/anon, making
-- historical versions immutable for API clients (restores go through the
-- SECURITY DEFINER restore_document_version RPC, which appends new rows).
--
-- A disposable local database was found with that policy and grant
-- resurrected out of band (drift), which silently allowed editors to
-- rewrite historical version content. The committed migration chain is
-- correct on a clean database; this migration simply re-asserts the same
-- two statements idempotently so any database that drifted converges back
-- on the next migration run. It is a no-op on a healthy database.
drop policy if exists "document_versions_update" on public.document_versions;
revoke update on public.document_versions from authenticated, anon;
