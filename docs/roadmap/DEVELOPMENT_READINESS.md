# PlanOS 3.0 — Development Readiness & Gap Register

Date: 2026-10-14
Status: planning only; no production changes
Source: PlanOS 3.0 PRD / 30 functional flows; sampled repository files. Not a complete code or database audit.

## Confirmed repository observations
- React + TypeScript + Vite + Supabase; default branch `main`.
- `src/App.tsx`: `/projects/:projectId` routes to `DocumentPage`.
- `src/pages/ProjectCreatePage.tsx`: form → interview → document generation.
- `src/lib/api/generation.ts`: placeholder content, not live LLM execution.
- `src/lib/api/chat.ts`: appends requested text and saves a fixed assistant response.
- `src/lib/api/generationRuns.ts`: generation-run records, not a durable worker.
- `src/lib/permissions.ts`: human roles; no confirmed tool-execution authorization.
- `package.json`: build/lint scripts, no test script.
- `README.md`: starter template.
- GitHub code search returned no indexed matches; **do not infer absence** of features solely from search.

## Eight required decisions before implementation
| ID | Decision | Acceptance gate | Priority |
|---|---|---|---|
| R-01 | Narrow first paid pilot to PM + 1–2 real executable job types | one verified end-to-end workflow | P0 |
| R-02 | Backward-compatible schema and URL migration | existing project/documents work after upgrade | P0 |
| R-03 | Choose server execution, queue, worker, scheduling and recovery architecture | logout, retry, cancel, dedupe proven | P0 |
| R-04 | Metering, budget reservation, cost caps, refunds | no unauthorized overspend or duplicate charge | P0 |
| R-05 | Task-specific quality rubric and provenance | verified artifact != claimed completion | P0 |
| R-06 | Threat model for prompt injection, secret leakage, tenant crossover, tool abuse | negative authorization tests pass | P0 |
| R-07 | Separate dev/staging/prod environments and secrets | staging E2E without touching production | P0 |
| R-08 | Operational incident, support, contract, billing and retention playbooks | owners and escalation paths identified | P0 |

## Additional cross-cutting specifications
- **Observability:** structured event logs, job trace IDs, token/cost attribution, alerts.
- **Idempotency and concurrency:** queue leases, heartbeat, cancellation semantics, version locks.
- **Model policy:** supported providers, fallbacks, data handling and model retirement.
- **Human oversight:** irreversible action classes, approval expiry, policy changes, break-glass stop.
- **Data lifecycle:** export, retention, deletion, consent revocation and legal review.
- **Accessibility & responsive:** keyboard navigation, status announcements, mobile approvals.
- **Performance & limits:** task timeouts, quotas, rate limits, API/provider failures.
- **Analytics:** time-to-first-value, real completion, intervention/rework, retention, gross margin.
- **Vendor dependencies:** API costs, contracts, regional data handling and outages.
- **Feature flags:** staged rollout, kill switches, legacy route compatibility.

## Recommended documents (tracked in repo)
1. `docs/product/PRD.md` — scope, non-goals, personas, success metrics.
2. `docs/product/TASK_FLOWS.md` — TF-01..30 with acceptance tests.
3. `docs/ux/IA.md` and `docs/ux/UX_FLOWS.md` — route/screen/CTA map.
4. `docs/engineering/BASELINE_AUDIT.md` and `REPO_MAP.md` — verified current state.
5. `docs/engineering/ARCHITECTURE.md` and `EXECUTION_ENGINE.md` — workers/queues/model adapters.
6. `docs/engineering/DATA_MODEL.md` and `MIGRATION_PLAN.md` — backward compatibility, RLS, rollback.
7. `docs/engineering/API_CONTRACTS.md` — auth, idempotency, errors, versioning.
8. `docs/security/THREAT_MODEL.md` and `APPROVAL_POLICY.md` — controls and abuse cases.
9. `docs/business/UNIT_ECONOMICS.md` and `BILLING_POLICY.md` — limits, ledger, refunds.
10. `docs/qa/TEST_PLAN.md` and `E2E_ACCEPTANCE.md` — functional/security/failure tests.
11. `docs/operations/ENVIRONMENTS.md`, `RELEASE_RUNBOOK.md`, `INCIDENT_RUNBOOK.md`.
12. `docs/adr/` — dated architectural decisions and tradeoffs.

## Execution plan and gates
**Gate 0 — Baseline:** enumerate repository, migrations, RLS, deployment; build/lint; regression map. No code changes before baseline report.

**Gate 1 — Foundations:** PRD, architecture ADR, threat model, acceptance criteria, staging/CI; reviewed PR.

**Gate 2 — Solo task loop:** durable task model, ownership, artifacts, state transitions, existing routes preserved.

**Gate 3 — Controlled AI execution:** server-only model credentials, one real model provider, durable queue, budget + approval enforcement, validation.

**Gate 4 — PM loop:** plan → delegate → execute → verify → approve → brief with provenance.

**Gate 5 — Staffing UX:** profiles, contract, consent, kickoff, handoff, cancellation.

**Gate 6 — Pilot:** security regression, cost limits, observability, user tests, incident handling.

## Immediate GitHub work packages
- [ ] Inventory all tracked files and current commit; inspect migrations and RLS.
- [ ] Capture baseline build/lint results and known broken flows.
- [ ] Create traceability matrix: TF → screen → API → data → tests → issue.
- [ ] Draft ADR on queue/worker deployment and model gateway.
- [ ] Draft migration/rollback plan before schema edits.
- [ ] Add CI and automated tests on a separate branch.
- [ ] Implement first small vertical slice only after design gates.

## Safety
- Do not commit API keys, secrets, private customer data or model credentials.
- Do not modify production Supabase, billing, deployments or merge into main without explicit review.
- Current document is a gap register, **not** proof that the full repository or production environment has been audited.
