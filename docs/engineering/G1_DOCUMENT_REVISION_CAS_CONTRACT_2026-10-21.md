# Document revision CAS — G1-B-05 (2026-10-21)

Status: DRAFT. No database migration executed. No production deployment.

## Contract
- A document has a short numeric content_revision.
- The write request sends the full document as a POST body and expected revision as a small parameter.
- One atomic database update changes content and increments revision only if expected revision matches.
- A stale request must return an error and preserve the user's device-local draft.
- Access checks must match editor and owner permissions. Real RLS checks are required.

## Unresolved blockers
- Direct document edits, regenerate, chat, version restore and upsert must advance the same revision.
- Ensure the revision cannot be manipulated by clients.
- Test two editors, stale writes, access revocation, long documents, failed retries and browser restoration in a disposable DB.
- Integrate with the existing autosave and recovery branches only after these checks.

The SQL file 017_document_revision_cas_DRAFT.sql (renumbered from PR 013) illustrates the contract but is NOT a ready-to-run migration. Do not apply it until cross-writer protection and isolated tests are complete.

## G1-B-06 addendum
- DRAFT 013 now illustrates a BEFORE UPDATE trigger deriving revision on every content change. The CAS RPC does not increment again.
- This trigger cannot stop legacy blind updates from overwriting newer content. Writer-by-writer conditional mutation and permission checks remain release blockers.
- [Document writer audit](G1_DOCUMENT_WRITER_AUDIT_2026-10-21.md) records code paths and remaining inspection work.
