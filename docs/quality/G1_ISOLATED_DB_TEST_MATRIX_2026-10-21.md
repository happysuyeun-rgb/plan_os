# G1-B-08 isolated DB acceptance matrix — 2026-10-21

Status: SQL review and test planning only. No isolated database was created or changed.

## Evidence / gaps
- 001_initial_schema.sql defines documents with RLS and a documents_all_own policy, without content_revision.
- 013_fix_project_members_select_recursion.sql changes a member SELECT policy; verify migration dependency order and actual roles.
- 016_atomic_chat_document_edit.sql uses a SECURITY DEFINER function that directly updates documents. A revision trigger would increment this write but would NOT block a stale, blind client UPDATE.
- 017_document_revision_cas_DRAFT.sql is an incomplete candidate: the CAS function relies on can_edit_project_content and table-level grants/RLS must be reviewed before use.
- Existing direct upsert, regeneration and document restores require a coordinated revision contract; the restore SQL file/path must be located and audited before tests.

## Required isolated test scenarios
| ID | Scenario | Expected |
|---|---|---|
| DB-01 | existing document migration | revision defaults to 0, no content changes |
| DB-02 | two authenticated editors, same revision | exactly one write succeeds, other rejected |
| DB-03 | content update via chat RPC | revision increments once |
| DB-04 | version restore | atomic restoration and revision increment once |
| DB-05 | regenerate/upsert | cannot overwrite concurrent user edit without conflict |
| DB-06 | viewer/outsider/revoked member | cannot update or call CAS |
| DB-07 | owner/editor, active project | permitted only with expected revision |
| DB-08 | deleted project | save rejected |
| DB-09 | direct UPDATE content_revision manipulation | prevented by server trigger/privileges |
| DB-10 | no-op update / failed transaction | no extra revision, no partial write |
| DB-11 | long document body | POST JSON only; no document body in query URL |
| DB-12 | network retry/ambiguous response | idempotent or safely rejected; local draft retained |

## Release gate
- [x] Existing DB sources inspected and scenario matrix drafted.
- [ ] Full migration names, grants, policies, SECURITY DEFINER functions enumerated.
- [ ] Reproducible disposable PostgreSQL/Supabase environment prepared.
- [ ] Actual SQL migrations and DB-01..12 executed with evidence.
- [ ] PR #15/#19/#23/#24 cross-branch integration completed.
- [ ] Production deployment/DB change approved separately.

No claim of real database PASS is allowed until evidence is recorded.
