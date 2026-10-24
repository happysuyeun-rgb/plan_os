# G1-B-06 document writer audit (2026-10-21)

**Status:** code-path inspection only. Full repository search and database function body inspection remain open. No production DB mutation.

| Writer | Evidence | Revision gap | Correct stage |
|---|---|---|---|
| Manual autosave | `src/store/documentStore.ts` and `src/lib/api/documents.ts` | Legacy blind content UPDATE and newer branch body-equality CAS | G1-B-06/07 |
| Initial generation | `src/lib/api/generation.ts:runGenerationPipeline` → `upsertDocument` | Existing document overwritten via upsert | G1-B-06/07 |
| Single regeneration | `src/lib/api/generation.ts:regenerateDocument` → `upsertDocument` | Existing document overwritten | G1-B-06/07 |
| Cascade regeneration | `src/lib/api/generation.ts:regenerateCascade` | Repeats single regeneration for multiple docs | G1-B-07 |
| Chat document commit | `src/lib/api/chat.ts:commitChatDocumentRPC` | RPC implementation and revision interaction unverified | G1-A/B-07 |
| Historical version restore | `src/lib/api/versions.ts:restoreDocumentVersion` | DB RPC must enforce same revision and atomicity | G1-A/B-07; Issue #16 |
| Other direct updates | Edge Functions / migrations / triggers / stored procedures | Not fully searched; possible bypass | G1-B-07 |

## Invariants
1. Every server-side change to `documents.content` increments `content_revision` once, irrespective of writer.
2. A client cannot increment or rewrite revision directly; a BEFORE UPDATE trigger derives it from OLD.
3. The trigger alone is **not enough** to prevent legacy blind updates from overwriting another client. Enforce conditional compare at every editing interface, or remove broad direct content UPDATE rights after client migration.
4. Snapshot/version saving that does not change current document content must not increment current content revision.
5. CAS RPC uses owner/editor RLS, never discloses forbidden-row existence, and reports conflict without discarding local drafts.
6. Do not deploy DRAFT migration 013 until complete all-writer audit, isolated Postgres/RLS race tests, and actual client integration.

## Next acceptance tests
- Two concurrent editors with expected revision 1: exactly one wins, other retains draft.
- Old autosave arrives after chat/restore/regeneration: must fail without clobber.
- Direct UPDATE cannot spoof revision, even if a user has UPDATE privilege.
- No-op content UPDATE does not advance revision; changed content advances once.
- Cross-project, viewer, outsider and revoked member reject writes.
- Long document body is supplied in POST body; URL carries no full text.

## G1-B-07 staged write contract (2026-10-21)
- [x] Draft CAS RPC now checks that the project is active and the actor can edit it, independently of generic UPDATE RLS. SECURITY DEFINER requires a separate privilege/search_path review and isolated permissions test.
- [x] Revision trigger keeps all changes monotonic, without double-increment in CAS RPC.
- [ ] **Critical bypass:** users retaining direct UPDATE(content) permissions or legacy upsert can silently overwrite changed content despite the trigger. Only after all clients/RPCs are migrated, revoke direct write permissions or enforce a server-only guarded write path. A column revoke alone does not cancel an existing table-level UPDATE grant.
- [ ] Chat and restore SECURITY DEFINER RPCs require separate owner/editor and revision checks; verify migration order and SQL under isolated Postgres before deploy.
- [ ] Concurrent editor race, revocation, stale content retry and rollback need executable DB assertions.
**Rollout:** Phase A draft SQL/client APIs and tests; Phase B isolated DB with all writers migrated; Phase C coordinated privilege cutover only with deployment approval. No partial production rollout.
