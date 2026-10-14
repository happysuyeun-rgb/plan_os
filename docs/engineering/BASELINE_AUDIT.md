# Phase 0 — Repository Baseline Audit (in progress)

**최초 작성일:** 2026-10-14  
**최종 수정일:** 2026-10-14  
**문서 버전:** v1.1  
**진행 상태:** 진행 중  


Date: 2026-10-14
Source: GitHub default branch file reads. This is **not** a complete repository tree or deployed database audit.

## Verified
| Area | File | Finding | Impact |
|---|---|---|---|
| Runtime | `package.json` | React 19, TypeScript 6, Vite 8, Supabase client; build/lint scripts; no test script | add test runner + CI |
| Routes | `src/App.tsx` | project root and document routes share `DocumentPage` | preserve legacy deep links when introducing workspace |
| Creation | `src/pages/ProjectCreatePage.tsx` | form → interview → generated documents | add project mode and AI team onboarding |
| Generation | `src/lib/api/generation.ts` | `buildGeneratedContent` placeholder + timed character streaming | replace fake AI with authenticated server execution |
| Chat | `src/lib/api/chat.ts` | appends request text to document and saves fixed response | not real model-based editing |
| Runs | `src/lib/api/generationRuns.ts` | DB run metadata only | not a durable queue/worker |
| Client execution | `src/store/generationStore.ts` | module-local `abortFlag`, client-side loop | browser close interrupts work; cancel is not server-enforced |
| Authorization | `src/lib/permissions.ts` | owner/editor/viewer frontend permission mapping | server-side tool and approval policy still required |
| Auth config | `src/lib/supabase.ts` | browser anon key and URL env vars | server-side secrets must not use VITE_ prefix |
| DB baseline | `supabase/migrations/001_initial_schema.sql` | users/projects/documents/versions/chat/members; RLS enabled and initial policies | inspect all later migrations before editing schema |
| DB tooling | `scripts/db-push.mjs` | script invokes `supabase db push --yes` | NEVER execute against production during audit |
| Local Supabase | `supabase/config.toml` | local development config exists | separate from cloud deployment |
| Docs | `README.md` | default Vite starter text | replace with project setup and safety instructions |

## Findings requiring follow-up
1. **P0**: Client-only generation and fake chat success create misleading AI capability. Replace only after preserving legacy user flows.
2. **P0**: No demonstrated durable server-side jobs, queue lease, retries, or execution authorization.
3. **P0**: DB push script can mutate remote schema; audit is strictly read-only.
4. **P0**: Need enumerate ALL SQL migrations and evaluate final RLS, triggers, permissions, indexes, rollback.
5. **P0**: Need inspect Vercel project settings, env variable names (never secret values), deploy protection, preview/prod separation.
6. **P1**: Need capture reproducible `npm ci && npm run build && npm run lint` results in trusted local/CI environment; not run yet.
7. **P1**: Need create test harness, baseline regression and CI.
8. **P1**: Document `generation_runs` semantics before new task/job tables.

## Scope of this checkpoint
- Read-only inspection of selected repository files.
- No complete file enumeration, runtime execution, Supabase cloud inspection or deployed site testing yet.
- No application source code or production settings modified.

## Next audit sequence
1. Enumerate all tracked files and exact current commit.
2. Read every migration and evaluate effective RLS.
3. Inspect existing API, stores, route compatibility and auth flows.
4. Verify deployment, secrets separation and CI.
5. Run build/lint and add tests on isolated branch.
6. Produce file-by-file KEEP / MODIFY / NEW matrix and migration ADR.

## Required decision gate
Do not start AI worker or DB migration until baseline, auth/RLS risk review, architecture ADR and rollback plan are reviewed.

## 2026-10-14 추가 검증 결과
- GitHub REST recursive tree: **212 entries**, `truncated=false`. SQL 마이그레이션 **8개** (`001_initial_schema.sql`, `002_fix_project_members_rls.sql`, `003_generation_runs_rls.sql`, `004_add_wireframe_document_type.sql`, `005_project_comments.sql`, `006_member_project_access_rls.sql`, `007_user_notifications.sql`, `008_project_chat_title.sql`). **목록 확인만 완료**, 최종 SQL 정책 검토는 미완료.
- [CI run 38517379376](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38517379376): `npm ci` **통과**, `npm run build` **통과**, `npm run lint` **실패**.
- ESLint: **13 errors / 3 warnings**. `react-hooks/set-state-in-effect`, `react-hooks/refs`, `@typescript-eslint/no-unused-vars`, `react-hooks/exhaustive-deps` 관련. 소스 변경 전 위치별 원인 및 UI 동작 영향을 확인해야 함.
- 다음 단계: lint 13건을 개별 검토 후 안전하게 수정하는 별도 PR, 이후 CI 재실행. 기존 규칙을 전역 비활성화해서 통과시키지 말 것.
