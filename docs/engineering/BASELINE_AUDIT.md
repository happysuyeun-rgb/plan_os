# Phase 0 — Repository Baseline Audit (in progress)

**최초 작성일:** 2026-10-14  
**최종 수정일:** 2026-10-15  
**문서 버전:** v1.3  
**진행 상태:** 진행 중  


**초기 조사 범위:** 2026-10-14 GitHub 기본 브랜치의 일부 코드 파일. 이후 저장소 tree 전체 목록 및 SQL 8개 정적 검토로 확장됨. **운영 DB 적용 상태 및 실제 권한 테스트는 아직 미확인.**

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
4. **P0**: SQL 마이그레이션 8개 목록 및 원문 정적 검토 완료. 실제 적용된 최종 RLS·GRANT·트리거·롤백/재현 검증은 미완료.
5. **P0**: Need inspect Vercel project settings, env variable names (never secret values), deploy protection, preview/prod separation.
6. **P1**: GitHub Actions에서 `npm ci` 및 build 성공, lint 13 errors/3 warnings 실패 확인. PR #8 부분 수정 후 재검증은 미완료.
7. **P1**: Need create test harness, baseline regression and CI.
8. **P1**: Document `generation_runs` semantics before new task/job tables.

## 감사 범위 및 한계 (최신)
- 저장소 tree 212개 항목 목록과 SQL 8개 원문 정적 검토 완료. 저장소 전체 **소스 파일 내용 전수 검토**와 실제 DB 권한 재현은 별개이며 미완료.
- GitHub Actions 실행 로그 확인: 의존성 설치/빌드 통과, lint 실패. PR #8은 별도 브랜치에서 일부 코드 수정 중.
- 운영 Supabase, Vercel 배포 설정·실고객 데이터·운영 서비스에는 변경 없음.

## Next audit sequence
1. 저장소 tree 목록 확인 완료; 후속 검증에는 대상 commit SHA와 기준 브랜치 기록.
2. SQL 8개 정적 검토 완료; 실제 DB의 적용 마이그레이션·권한·재귀 재현은 미완료.
3. Inspect existing API, stores, route compatibility and auth flows.
4. Verify deployment, secrets separation and CI.
5. 기존 CI 실패(13 errors/3 warnings)를 PR #8에서 해결하고 build/lint 재검증 및 회귀 테스트 추가.
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

## 2026-10-15 계획 정합성 재검토
- **Phase 0 차단 위험:** RLS 정책의 멤버 조회 재귀, 댓글·반응 소유권, 이력 수정 가능성은 실제 개발 DB에서 역할별 테스트가 필요. 정적 발견을 운영 취약점 확정으로 간주하지 않음.
- **회귀 위험:** PR #8의 프로젝트 복원 사용자 필터 변경은 실제 스키마와 소유자/편집자/관리자 시나리오 검증 전 병합 금지.
- **품질 게이트:** CI 워크플로 존재와 통과는 다름. build 통과, lint 실패, 테스트 스크립트 미확인을 구분.
- **외부 AI 게이트:** FreeLLMAPI는 개인 실험용 단일 사용자 게이트웨이. 제공업체 약관·비식별 데이터·모델 capability 확인 전 PlanOS 고객 운영 트래픽 연결 금지.
- **다음 순서:** PR #8 lint/build/복원 회귀 → Issue #7 안전한 DB 재현 → Issue #2/#3 운영 환경 읽기 전용 검증 → Issue #4 서버 실행/ModelGateway ADR.

## 변경 이력
| 날짜 | 버전 | 내용 |
|---|---|---|
| 2026-10-14 | v1.0 | 코드 기준선 감사 초안 |
| 2026-10-14 | v1.1 | 저장소 목록 및 CI 로그 기록 |
| 2026-10-14 | v1.2 | SQL 8개 정적 검토와 RLS 위험 가설 기록 |
| 2026-10-15 | v1.3 | 구형 미검증 서술 수정, 회귀·보안·외부 AI 진입 게이트 추가 |
