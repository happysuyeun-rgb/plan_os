# Phase 0 — Repository Baseline Audit (in progress)

**최초 작성일:** 2026-10-14  
**최종 수정일:** 2026-10-14  
**문서 버전:** v1.2  
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

## 2026-10-14 SQL 마이그레이션 8개 정적 검토
**범위:** 저장소 `001`~`008` SQL 원문을 모두 읽음. 운영 DB에 실제 적용된 상태·실행 권한·GRANT·함수 소유자·데이터는 **미확인**. 다음 항목은 코드 기반 위험 가설이며 재현 검증 필요.

| 우선순위 | 위치 | 발견 사항 | 권장 검증/개선 |
|---|---|---|---|
| **P0** | `006_member_project_access_rls.sql` | `project_members` SELECT 정책이 같은 `project_members`를 직접 다시 조회함. 001의 재귀 문제를 002에서 수정했지만 006에서 재도입했을 가능성 | 실제 Postgres에서 `infinite recursion detected in policy` 재현 확인. `SECURITY DEFINER` 보조 함수 등 비재귀 정책으로 재설계 |
| **P0** | `006` `project_comments_update` | `can_access_project`만 검사하므로 viewer 포함 모든 활성 멤버가 다른 작성자의 댓글 본문/작성자 등 행을 수정할 수 있는 정책으로 보임 | 작성자/프로젝트 소유자와 수정 가능 필드 분리, 악의적 UPDATE 테스트 |
| **P0** | `006` `comment_reactions_write`, `comment_participant_status_write` | `FOR ALL USING`에 행 소유자 조건이 없어, 다른 멤버 행 DELETE 및 일부 UPDATE 시도 가능성 | `USING (user_id = auth.uid())` 및 명령별 분리 정책 검토 |
| **P1** | `007_user_notifications.sql` | INSERT는 `actor_id`와 프로젝트 접근만 검사하며 `user_id` 수신자가 해당 프로젝트 참여자인지 확인하지 않음 | 수신자 프로젝트 접근 검증, 허용된 알림 유형/트리거 설계 |
| **P1** | `006` `project_activities_insert` | viewer도 활동 로그 임의 INSERT 가능. `user_id`가 실제 호출자와 같은지 검증하지 않음 | 이벤트 서버 생성, 행 작성자 제한 및 스푸핑 테스트 |
| **P1** | `006` `document_versions_update` | 편집자가 과거 버전 내용을 UPDATE할 수 있어 버전 이력의 불변성이 보장되지 않음 | 버전 불변/추가 전용 정책 검토 |
| **P1** | `006` `generation_runs_access` | 편집자에게 실행 상태 전체 CRUD 권한. 미래 서버 실행 작업과 클라이언트 기록을 구분해야 함 | 서버 전용 실행 상태 전이 및 권한 분리 |

**주의:** 실제 RLS 영향은 운영 DB의 적용 마이그레이션·역할/GRANT·SECURITY DEFINER 실행 맥락에 따라 달라진다. 코드 정적 분석을 침해 재현이나 운영 취약점 확정으로 표현하지 않는다.

### 남은 완료 조건
- 별도 안전한 개발 DB에서 owner/editor/viewer/외부인 행위별 SQL 권한 테스트.
- 운영 환경 마이그레이션 적용 현황은 읽기 전용으로 확인.
- 정책 수정 SQL은 **별도 PR**로 작성하고 승인 전 운영 DB에는 적용하지 않음.
- 문서/댓글/알림/프로젝트 기존 사용자 흐름 회귀 테스트.
