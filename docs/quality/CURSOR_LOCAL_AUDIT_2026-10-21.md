# PlanOS 3.0 × AI 인력사무소 — Cursor 로컬 점검 보고서 2026-10-21

- **작업 지시:** Cursor 작업 지시서 01 — 프로젝트 실행 및 전체 개발 현황 점검
- **점검 기준 문서:** `docs/REPOSITORY_GUIDE.md`, `docs/plans/PLANOS_INTEGRATED_EXECUTION_PLAN_2026-10-21.md`, `docs/plans/PLANOS_WORK_EXECUTION_PROTOCOL_2026-10-21.md`, `docs/product/FUNCTIONAL_SPEC_V1_2026-10-20.md`, `docs/product/SERVICE_OPERATIONS_POLICY_V1_2026-10-20.md`
- **판정 원칙:** 실행계획서·운영규칙에 따라 코드 존재, 테스트 실행, 기능 완료를 구분한다. 검증되지 않은 기능은 완료로 표기하지 않는다.
- **작업 범위 준수:** 로컬 실행·현황 조사·본 문서 작성만 수행했다. 기능 코드 수정, `main` 병합·push, 운영 DB 마이그레이션, Vercel 배포, 유료 AI API 호출은 하지 않았다.

> 상태 표기: **구현 완료 및 검증됨 / 코드 존재, 검증 미완료 / 일부 구현 / Mock만 구현 / 미구현 / 현재 다운로드본에 없음**

---

## 1. 로컬 실행 결과

### 1.1 작업 폴더·환경 확인

| 항목 | 실제 확인 결과 |
|---|---|
| 작업 폴더 | `C:\Users\happy\Projects\lab\Cursor\Plan-OS-main\plan_os-main` |
| `.git` 존재 | **없음.** ZIP 다운로드본으로 확인. 현재 폴더를 Git 저장소로 간주하지 않으며, 로컬에서 브랜치·병합·push를 수행할 수 없다. |
| GitHub `main`과의 동일성 | 원격 `main` HEAD `29780a3e6f097313d0a081c89bb18b706d90aa84` (2026-10-21T05:07:03Z, "docs(plan): check F401 human PM mock implementation and passing CI")의 파일 목록(237개)과 로컬 파일 목록을 대조했다. 차이는 점검 중 생성한 `.env.local`과 한글 파일명 인코딩 표기뿐이었다. 대표 파일 5개(`src/App.tsx`, `src/pages/ProjectTasksPage.tsx`, `src/store/documentStore.ts`, `package.json`, 실행계획서)는 줄바꿈 정규화 후 내용이 원격과 동일했다. **즉 다운로드본 = 현재 GitHub `main` 최신과 동일하다.** |
| Node / npm | Node `v22.19.0`, npm `10.9.3` |
| `package.json` 스크립트 | `dev`(vite), `build`(tsc -b && vite build), `lint`(eslint), `test:s1`(task-prototype만 실행), 기타 `db:push`·개발용 사용자 스크립트. 전체 테스트용 단일 스크립트는 없다. |
| 의존성 설치 | `npm ci` 실행 **성공** — 198 packages 설치, audit 경고 9건(3 moderate, 6 high). `npm audit fix`는 임의로 실행하지 않았다. |
| `.env` 상태 | 원본에는 `.env.local.example`만 있고 실제 `.env.local`이 없었다. 이 상태에서는 `VITE_SUPABASE_URL`이 비어 `createClient`가 `supabaseUrl is required` 오류를 던져 **화면이 빈 검은 화면**으로 렌더링됨을 실제 브라우저로 확인했다. |
| 로컬 실행용 조치 | 운영 Supabase 정보를 사용하지 않고, 프로젝트 코드가 의도한 로컬 개발 경로(`src/lib/localDevAuth.ts`의 `placeholder.supabase.co` 판정)에 맞춰 `.env.local`을 placeholder 값으로 생성했다. `.env.local`은 `.gitignore` 대상이다. |
| Mock 실행 가능 여부 | **부분 가능.** placeholder 환경에서는 개발용 임시 로그인(`VITE_DEV_LOGIN_EMAIL/PASSWORD`, 기본값 `dev@example.com`)과 대시보드·프로젝트 목록(빈 상태)·프로젝트 생성 폼까지 접근할 수 있다. 그러나 `projectStore.createProject`는 로컬 개발 모드 가드가 없어 placeholder Supabase 호출이 실패하므로 **로컬에서 프로젝트 생성→문서→업무 흐름은 끝까지 실행할 수 없다.** 프로젝트가 필요한 S1/S2 화면의 실제 사용자 흐름 검증은 격리 Supabase 또는 별도 fixture가 필요하다. |

### 1.2 실행한 명령과 결과

| 명령 | 결과 | 비고 |
|---|---|---|
| `npm ci` | ✅ 성공 (exit 0) | 198 packages, 32~42초 |
| `npm run build` | ✅ 성공 (exit 0) | 1936 modules, JS 1,119.43 kB(gzip 303.31 kB), CSS 34.04 kB. 경고 2종: `lottie-web`의 direct `eval` 사용, 500 kB 초과 청크(코드 스플리팅 없음) |
| `npm run test:s1` | ✅ 성공 — 6/6 pass | `tests/task-prototype.test.mjs`만 실행하는 스크립트 |
| `node --test tests/task-prototype.test.mjs tests/task-sql-contract.test.mjs tests/audit-source-selection.test.mjs` | ✅ 성공 — **14/14 pass** | 저장소의 전체 `.mjs` 테스트를 개별 실행한 결과. `npm test` 같은 통합 스크립트는 없어 이 결과를 "전체 테스트 통과"로 일반화할 수 없다. |
| `npm run lint` | ❌ 실패 (exit 1) — **13 errors, 3 warnings / 8개 파일** | 상세는 §5.4 |
| `npm run dev -- --port 5173 --host 127.0.0.1` | ✅ 실행 중 | §2 참조 |
| `npm run db:push` | ⛔ 실행하지 않음 | 지시서·운영규칙상 운영 DB 변경 금지. 격리 DB 포함 어떤 DB에도 마이그레이션을 적용하지 않았다. |

---

## 2. 실제 접근 가능한 화면 및 URL

로컬 서버: **http://127.0.0.1:5173** (Vite v8.0.16). 개발용 임시 로그인 후 실제 브라우저(Chromium)로 확인했다.

| URL | 화면 | 실제 확인 결과 |
|---|---|---|
| `/` | 랜딩 | 정상 렌더링. "아이디어를 기획서로, 기획서를 코드로", 체험 입력·예시 칩 표시 |
| `/login` | 로그인 | 개발용 임시 로그인 폼 표시. 임시 로그인 성공 → `/dashboard` 이동, 토스트 "임시 로그인되었습니다" |
| `/dashboard` | 대시보드 | 정상. 프로젝트 없음 빈 상태, "새 프로젝트" 버튼 |
| `/projects` | 프로젝트 목록 | 정상. 검색·서비스 유형 필터, 빈 상태 |
| `/projects/new` | 프로젝트 생성 1단계 폼 | 정상 렌더링(폼 검증 포함). 단, 제출 이후 생성은 placeholder 백엔드라 실패 경로로 빠진다(§1.1) |
| `/projects/trash`, `/settings`, `/onboarding` | 휴지통·설정·온보딩 | 라우트 존재. 로컬 개발 모드에서는 데이터가 비어 검증 범위가 빈 상태 표시에 한정됨 |
| `/projects/:projectId` 및 `/projects/:projectId/:docType` | 문서 작업 화면(`DocumentPage`) | 라우트·코드 존재. 실제 프로젝트 데이터가 필요한 화면이라 로컬 placeholder 환경에서는 E2E 검증 불가 |
| `/projects/:projectId/tasks` | S1 프로젝트 업무 관리 | 화면 존재를 코드와 라우트로 확인. 존재하지 않는 프로젝트 ID로 접근 시 "프로젝트를 확인할 수 없습니다" 경고가 뜨지만 "프로젝트를 확인하는 중입니다" 문구가 함께 남아 있는 표시 결함 확인(§5.3 P2-01) |
| `/projects/:projectId/audits/new` | S2 감사자료 선택 | 화면·라우트 존재(`AuditSourceSelectionPage`). 실제 문서 데이터 없이는 사전 검증 흐름 검증 불가 |
| `/projects/:projectId/specialists/request` | S3 AI 전문가 업무 요청(PR #25) | **404 "존재하지 않는 페이지입니다"** — 다운로드본에 없음 (§4) |
| 그 외 미정의 경로 | 404 | `NotFoundPage` 정상 동작 |

접근 가능 화면은 "라우트+렌더링" 수준의 확인이다. Supabase 실데이터가 필요한 저장·권한·동시성 흐름은 본 점검에서 검증되지 않았다.

---

## 3. 기능별 구현 현황 (F-ID 기준)

판정은 로컬 코드 직접 확인 + 위 테스트/브라우저 실행 근거 기준이다. 기능정의서 자체의 "실제 상태" 열과 다른 부분은 비고에 적었다.

### 3.1 기존 PlanOS (F-001 ~ F-005)

| F-ID | 기능 | 현황 | 근거 |
|---|---|---|---|
| F-001 | 가입·로그인·온보딩 | **코드 존재, 검증 미완료** | `LoginPage`, `OnboardingPage`, `authStore`, Google 로그인 및 개발용 임시 로그인 코드 존재. 로컬 임시 로그인은 실제 동작 확인. Supabase 실인증·세션 만료·재접속 회귀는 미검증 |
| F-002 | 프로젝트 생성·조회·수정 | **코드 존재, 검증 미완료** | `ProjectListPage`, `ProjectCreatePage`, `projectStore`, 휴지통(`TrashPage`, soft-delete/복원/영구삭제 API) 존재. 실 DB CRUD·프로젝트 간 격리(403/404)는 미검증. 로컬 모드에서는 생성 자체가 불가 |
| F-003 | 문서 편집·자동 저장 | **일부 구현 (P0 결함 포함)** | `DocumentPage`(776줄), `MarkdownEditor`, `documentStore` 자동저장(2초 디바운스) 존재. 그러나 저장 API가 무조건 덮어쓰기(blind update)이고 채팅도 같은 문서를 직접 갱신해 동시 편집 시 유실 가능(§5.1 P0-01, P0-03). "입력 유실 없음" 수용 기준 미충족 |
| F-004 | 문서 버전·복구·휴지통 | **일부 구현 (P0 결함 포함)** | `versions.ts`, `versionStore`, `HistoryPanel`, `SaveVersionModal` 존재. 복원이 원자적이지 않아 중간 실패 시 버전만 남거나 본문만 바뀌는 불일치 가능(§5.1 P0-02). 복구 E2E 미검증 |
| F-005 | 프로젝트 멤버·역할 관리 | **코드 존재, 검증 미완료** | `MemberPanel`, `InviteMemberModal`, `memberStore`, `permissions.ts`, 마이그레이션 002·006 존재. 멤버 RLS 재귀 수정(009)은 PR #15에만 있어 다운로드본에 없고, 실 JWT/RLS 역할별 검증은 미수행(§5.1 P0-04) |
| (부속) | 댓글·채팅·알림·활동기록 | **코드 존재, 검증 미완료** | `commentStore`/`CommentSidebar` 등 댓글 UI, `chatStore`/`ChatPanel`, `notificationStore`/`NotificationBell`, `activityStore` 존재. 채팅의 문서 직접 갱신이 자동저장 경로를 우회함(P0-03). 실권한 검증 미수행 |
| (부속) | 문서 AI 생성 | **Mock만 구현** | `generation.ts`의 생성 내용은 `src/lib/generation/placeholderContent.ts`의 고정 템플릿이다. 실제 AI 생성이 아니며 화면·문서가 이를 실제 생성으로 오인하게 해서는 안 된다(§5.3 P2-04) |

### 3.2 AI 인력사무소 (S1 ~ S7)

| F-ID | 기능 | 현황 | 근거 |
|---|---|---|---|
| F-101 | S1 사람 업무 생성·조회 | **일부 구현, 검증 미완료** | `ProjectTasksPage`에 생성·목록 UI 존재. 기본 경로는 `taskPrototype.ts`의 **localStorage 저장**이며, 서버 저장은 `VITE_S1_SERVER_TASKS=true` 개발 플래그 + 마이그레이션 011 적용 시에만 동작. 브라우저 E2E·격리 DB 검증 없음 |
| F-102 | S1 담당자 배정·업무 수정 | **일부 구현** | 활성 멤버 선택·수정 UI, 서버 모드 version CAS(`patchServerTask`의 `.eq('version', expectedVersion)`) 코드 존재. 실제 동시수정 충돌 검증 없음 |
| F-103 | S1 상태 전이·차단 사유 | **일부 구현** | `permittedTransition` 전이표와 DB 트리거(011)의 전이표가 일치하고, blocked 사유 필수 처리(UI prompt + DB 체크 제약) 존재. 서버에서 불법 전이를 막는 것은 011 적용 DB에서만 성립 |
| F-104 | S1 소프트 삭제·복원·감사 이력 | **일부 구현 (불일치 포함)** | 삭제/복원 UI와 `project_task_events` 트리거·조회 API(`listServerTaskEvents`)가 있으나, **이벤트 조회 API를 화면에서 호출하는 곳이 없어 감사 이력이 사용자에게 표시되지 않는다.** 또한 DB는 삭제·복원을 owner만 허용하는데 UI는 editor에게도 버튼을 노출한다(P1-02) |
| F-105 | S1 성공기준·AI 담당·작업 상세 | **일부 구현** | 완료 기준(acceptance criteria) 입력·표시는 구현됨. 그러나 업무 상세 화면(`/tasks/:taskId`) 라우트가 없고 목록 인라인 편집만 존재하며, AI 담당 지정 UI가 없다. 기능정의서의 "상세·저장 E2E" 미충족 |
| F-201 | S2 감사 대상 문서 선택 | **일부 구현** | `AuditSourceSelectionPage`에서 같은 프로젝트 문서 2개 이상 선택, 사전 검증(타 프로젝트·삭제·미저장 차단 로직 `auditSourceSelection.ts`) 존재. 다운로드본 기준으로는 기능정의서의 "설계만" 표기보다 진척돼 있으나, 실제 문서 데이터로 검증되지는 않았다 |
| F-202 | S2 입력 자료 버전·해시 고정 | **일부 구현 (개발 플래그 뒤)** | 브라우저 SHA-256 사전 계산 + 마이그레이션 012의 manifest RPC(`create_audit_source_manifest`, 멱등 request_key, stale 확인 `is_audit_source_manifest_current`) 코드 존재. UI 저장은 `DEV && VITE_S2_MANIFEST_RPC=true`일 때만 노출. 격리 DB 실행·RLS 검증 없음. 실행 전 서버 재검증은 아직 어떤 실행 단계와도 연결되지 않음 |
| F-301 | S3 AI 역할 카드·권한 안내 | **현재 다운로드본에 없음** | PR #25에만 존재(§4). 로컬에서 해당 URL은 404 |
| F-302 | S3 계약 초안·동의·철회·만료 | **현재 다운로드본에 없음 (Mock 설계만 PR에)** | PR #25의 모의 계약 검토는 실제 동의·서버 검증이 아니다. 실 기능은 미구현이며 상용 정책 결정도 대기 중(운영정책 §10) |
| F-303 | S3 예산 한도·비용 고지 | **현재 다운로드본에 없음 (Mock만 PR에)** | PR #25의 비용 안내 Mock은 가격 미확정 고지 수준. 실제 비용 상한·원장·계산은 미구현 |
| F-401 | S4 무과금 사람 PM 계획 초안 | **현재 다운로드본에 없음 (Mock만 PR에)** | PR #27에만 존재. 메모리 기반 임시 화면이며 서버 저장·버전 CAS 없음(§4) |
| F-402 | S4 PM 계획 승인·반려·재수정 | **미구현** | 다운로드본·대상 PR 어디에도 승인 상태머신 없음 |
| F-501 | S5 실행 요청·서버 작업 큐 | **미구현** | 코드·테이블·큐 없음 |
| F-502 | S5 제한된 AI 문서 검수 수행 | **미구현** | worker 없음. provider 승인 전 단계 |
| F-503 | S5 실행 상태·취소·재시도 | **미구현** | 실행 리소스 자체가 없음 |
| F-504 | S5 비용 예약·사용량 정산 | **미구현** | 원장 없음 |
| F-601 | S6 근거 있는 보고서·검증 | **미구현** | 보고서/validator 없음 |
| F-602 | S6 사람 수락·반려·수정요청 | **미구현** | artifact/acceptance 없음 |
| F-603 | S6 작업 결과·상태 브리핑 | **미구현** | 없음 |
| F-701 | S7 통합 사용자 흐름 | **미구현** | S3~S6 부재로 연결 불가 |
| F-702 | S7 보안·접근성·장애·성능 회귀 | **미구현** | 린트 실패(§5.4), 청크 1.1 MB, 격리 RLS/E2E 미실행 상태 |
| F-801 | 후속(면담·추천·평판) | **미구현 (범위 외 정상)** | MVP 후 별도 기준 |

### 3.3 요약

- "구현 완료 및 검증됨"으로 판정할 수 있는 기능은 **없다.** 가장 앞선 기존 기능(F-001~F-005)도 실 DB 회귀·권한 검증이 없고, F-003/F-004에는 데이터 유실 계열 P0가 남아 있다.
- S1(F-101~105)·S2(F-201~202)는 코드가 상당 부분 존재하지만 기본 동작이 localStorage이거나 개발 플래그 뒤에 있고 DB/E2E 검증이 없다.
- S3·S4는 다운로드본에 없고 Draft PR의 Mock만 존재한다. S5~S7은 설계 문서만 있다.

---

## 4. 다운로드본과 GitHub Draft PR의 차이

모든 PR은 2026-10-21 점검 시점에 **OPEN·Draft**이며, 어떤 PR도 병합하지 않았다. `.git`이 없는 다운로드본이므로 차이는 GitHub API로 조회한 PR 메타데이터·변경 파일 목록과 로컬 파일 존재 여부 대조로 조사했다.

| PR | 제목(요지) | 상태 / base | 변경 규모 | CI (점검 시점) | 다운로드본과의 차이 |
|---|---|---|---|---|---|
| [#15](https://github.com/happysuyeun-rgb/plan_os/pull/15) | Phase 0 통합 — 문서 자동저장/채팅·RLS 009-010 격리 QA | OPEN·Draft, **CONFLICTING**, base는 `main`이 아닌 `fix/planos-chat-document-write-20261016` | 22파일 +1866/−21 | build-and-lint pass (run 38909724056) | 마이그레이션 `009_fix_project_members_select_recursion.sql`, `010_harden_comments_notifications_versions.sql`, RLS/E2E 테스트(`tests/rls/*`, `tests/e2e/*`), QA 문서가 **다운로드본에 없음**. `DocumentPage.tsx`, `commentStore.ts` 변경도 미반영. base가 main이 아니어서 그대로는 main 병합 판단 불가 |
| [#19](https://github.com/happysuyeun-rgb/plan_os/pull/19) | 로컬 초안 복구(B-04) | OPEN·Draft, MERGEABLE, base는 `fix/planos-chat-atomic-c10-20261017` | 5파일 +178/−6 | test pass (run 39495619001), **SonarCloud fail** | `src/lib/unsavedDraft.ts`, `tests/unsaved-draft.test.mjs`, 초안 복구 워크플로가 **다운로드본에 없음**. `documentStore.ts`·`DocumentPage.tsx`도 PR 버전과 다름. "MERGEABLE"은 충돌이 없다는 뜻일 뿐 검증 완료가 아니다 |
| [#22](https://github.com/happysuyeun-rgb/plan_os/pull/22) | 문서 조건부 저장(CAS) 계약 — 미연결 | OPEN·Draft, base `main` | 4파일 +131/−0 | verify pass (run 39496715024), SonarCloud fail | `saveDocumentContentIfUnchanged` 조건부 저장 API와 CAS 계약/행동 테스트 2종이 **다운로드본에 없음**. PR 제목대로 실제 저장 경로에 연결되지 않은 계약 단계 |
| [#23](https://github.com/happysuyeun-rgb/plan_os/pull/23) | 자동저장·CAS 통합 | OPEN·Draft, base `main` | 54파일 +4170/−220 | **verify 계열 run 없음**, SonarCloud fail만 존재 | `documentAutosave.ts`, `chatDocumentEdit.ts`, 마이그레이션 `011_atomic_document_version_restore.sql`·`012_atomic_chat_document_edit.sql` 등 대량 변경이 **다운로드본에 없음**. 실행계획서 기록대로 CI 미실행을 PASS로 볼 수 없다. **주의: PR의 마이그레이션 번호 011/012가 다운로드본(main)의 `011_project_tasks.sql`·`012_audit_source_manifests.sql`과 중복**된다(P1-01) |
| [#24](https://github.com/happysuyeun-rgb/plan_os/pull/24) | 서버 Revision CAS 설계 | OPEN·Draft, base `main` | 61파일 +4396/−220 | **verify 계열 run 없음**, SonarCloud fail만 존재 | PR #23 변경을 대부분 포함하는 누적 PR에 `013_document_revision_cas_DRAFT.sql`, revision CAS 계약 문서·격리 DB 테스트 매트릭스가 추가된 형태. **다운로드본에 없음.** SQL은 DRAFT(실행 금지)이고 클라이언트 저장 흐름과 미통합 |
| [#25](https://github.com/happysuyeun-rgb/plan_os/pull/25) | AI 전문가 업무 요청·계약 검토 Mock | OPEN·Draft, base `main` | 10파일 +378/−0 | verify pass 2건 + **Chromium E2E pass** (run 39504118698 외), SonarCloud fail | `SpecialistRequestMockPage.tsx`, `mockSpecialistRequest.ts`, `/projects/:projectId/specialists/request` 라우트, S3 테스트 3종이 **다운로드본에 없음**(로컬 접속 시 404 확인). Mock 초안은 메모리 전용이며 실제 계약·전송·과금 없음. 실행계획서에 기록된 CI 성공과 이번 조회 결과가 일치한다 |
| [#27](https://github.com/happysuyeun-rgb/plan_os/pull/27) | 사람 PM 계획 초안 Mock | OPEN·Draft, base `main` | 6파일(조회상 5개 경로 표시) +112/−0 | verify pass 2건 (run 39547654748, 39547654761), SonarCloud fail | `HumanPmPlanDraftPage.tsx`, `humanPmPlanDraft.ts`, 업무관리 진입 링크, F-401 테스트가 **다운로드본에 없음**. 메모리 기반 Mock이며 서버 저장·승인(F-402) 없음. GitHub `main` 최신 커밋 메시지가 이 PR의 CI 기록을 참조하지만 코드는 main에 병합되지 않았다 |

### 4.1 PR 간 중복·충돌 관계 (병합 전 필수 확인)

1. **마이그레이션 번호 충돌 (최우선):** PR #23/#24의 `011_*`·`012_*`는 main의 `011_project_tasks.sql`·`012_audit_source_manifests.sql`과 번호가 겹친다. 어느 쪽도 번호를 바꾸지 않고 병합하면 적용 순서·추적이 깨진다.
2. **누적(스택) 구조:** PR #24 ⊃ PR #23 성격의 변경을 포함하고, PR #23은 PR #15의 009/010과 PR #19의 초안 복구 파일을 함께 포함한다. 개별 PR을 독립 병합 단위로 취급하면 중복 적용·중복 충돌이 발생한다.
3. **공통 파일 중복 수정:** `DocumentPage.tsx`는 PR #15·#19·#23·#24가 모두 수정하고, `documentStore.ts`·`src/lib/api/documents.ts`도 #19·#22·#23·#24에 걸쳐 겹친다. 실행계획서의 "patch hunk는 별도 영역" 기록과 별개로, 파일 단위 병합 충돌 가능성은 높다.
4. **base 불일치:** PR #15·#19는 base가 `main`이 아니다. 현재 main 기준으로 재작성(rebase/재적용)하지 않으면 병합 결과를 예측할 수 없다.
5. **SonarCloud 전 PR 실패:** 대상 PR 7개 중 확인 가능한 범위에서 SonarCloud Code Analysis가 반복 실패한다(#15는 해당 체크 없음). 원인 분석 없이 "CI 통과"로 보고하면 안 된다.
6. **미실행 CI:** PR #23·#24는 verify/build 계열 run이 조회되지 않는다. 실행계획서의 기록("워크플로 run 미조회, PASS로 기록하지 않음")과 일치함을 이번에 재확인했다.

---

## 5. 발견한 결함·누락·불일치

심각도 기준: P0 = 데이터 유실·권한 우회·출시 차단, P1 = 기능 불일치·잘못된 동작·중요 검증 누락, P2 = 개선·표시·유지보수.

### 5.1 P0 (치명)

| ID | 결함 | 근거 (다운로드본 기준) |
|---|---|---|
| P0-01 | **문서 자동저장의 무조건 덮어쓰기 + 전역 단일 타이머.** 저장 API가 문서 ID만으로 UPDATE하고, 자동저장 타이머가 문서별이 아닌 모듈 전역 1개이며, 문서 탭 전환 시 미저장 편집을 flush하지 않는다. 동시 편집·다중 탭·전환 시 다른 사용자의 최신 본문을 오래된 내용으로 덮거나 편집이 사라질 수 있다. | `src/lib/api/documents.ts`의 `saveDocumentContent` (`.update({ content }).eq('id', id)`), `src/store/documentStore.ts`의 전역 `saveTimer`와 `setActiveDocType` |
| P0-02 | **버전 복원의 비원자성.** 복원이 "새 버전 INSERT"와 "본문 UPDATE" 두 번의 독립 호출로 수행돼, 중간 실패 시 버전 기록과 실제 본문이 어긋난다. 복원 전 현재 미저장 편집 보호도 없다. | `src/store/versionStore.ts` `restoreVersion` (62~64행). 실행계획서 Issue #16과 동일 결함이 다운로드본에 그대로 존재 |
| P0-03 | **채팅이 자동저장 경로를 우회해 문서를 직접 갱신.** 채팅 전송이 문서 본문을 읽어 문자열을 덧붙인 뒤 직접 UPDATE한다. 편집 중 자동저장과 경합하면 한쪽 변경이 유실되고, 화면 상태(`documentStore`)와 서버 본문이 어긋날 수 있다. | `src/lib/api/chat.ts` `sendChatMessage`의 `.from('documents').update(...)` (61~67행). 실행계획서 Issue #10과 동일 |
| P0-04 | **멤버 RLS 재귀 수정(009) 미반영 상태의 권한 미검증.** 다운로드본에는 002·006만 있고 PR #15의 009/010이 없다. 역할별(owner/editor/viewer/outsider) 실 JWT/RLS 테스트가 한 번도 실행된 적이 없어, 권한 경계가 실제로 닫혀 있는지 보장할 수 없다. UI 메뉴 숨김은 보안이 아니라는 운영정책 원칙상, 검증 전 출시·통합 완료 판정 금지. | `supabase/migrations/` 목록(009·010 부재), 실행계획서 G1-04/Issue #12 |

> P0-01~P0-03의 수정 방향(CAS 계약, 초안 복구, revision CAS)은 PR #22·#19·#23·#24에 초안이 있으나 어느 것도 실제 저장 경로에 완전히 연결·검증되지 않았고, 그 PR들의 CI·DB 실증 상태는 §4와 같다. **현재 다운로드본 기준으로 P0는 전부 미해결이다.**

### 5.2 P1 (중요)

| ID | 결함 | 근거 |
|---|---|---|
| P1-01 | PR #23/#24 마이그레이션 번호(011/012)가 main의 011/012와 중복 | §4.1-1 |
| P1-02 | **S1 삭제·복원 권한의 UI/서버 불일치.** DB 트리거는 삭제·복원을 owner만 허용(`ONLY_OWNER_MAY_DELETE_TASK`/`ONLY_OWNER_MAY_RESTORE_TASK`)하지만, 업무 화면은 editor에게도 삭제·복원 버튼을 노출한다. 서버 모드에서 editor가 누르면 저장이 실패하고 사용자는 이유를 알기 어렵다. | `supabase/migrations/011_project_tasks.sql` 트리거 vs `src/pages/ProjectTasksPage.tsx`의 `canEdit`(owner/editor) 기반 버튼 렌더링. 기능정의서 F-104의 "owner 삭제/복원"과도 UI가 불일치 |
| P1-03 | **S1 감사 이력 API가 화면에 미연결.** `listServerTaskEvents`가 정의만 되고 호출처가 없어, DB에 쌓이는 이벤트를 사용자가 볼 수 없다. F-104 수용 기준("변경 주체/시간/버전 이벤트" 확인) 미충족 | `src/lib/api/projectTasks.ts` 77행, 저장소 전체에서 호출처 없음 |
| P1-04 | **S1 업무 상세 화면·AI 담당 부재.** 기능정의서 화면 인덱스의 `/projects/:projectId/tasks/:taskId` 라우트가 없고, F-105의 AI 담당 지정 UI가 없다. 목록 인라인 편집으로 대체 중이나 수용 기준과 불일치 | `src/App.tsx` 라우트, `ProjectTasksPage.tsx` |
| P1-05 | **S1 기본 저장이 localStorage.** 서버 모드는 환경변수 플래그를 켜고 011을 적용한 개발 DB에서만 동작한다. 일반 실행에서는 재접속·기기 변경·권한과 무관하게 브라우저에만 남는다. 화면에 "개발 시안" 고지는 있으나, 기능 완료로 오인할 여지가 있어 상태 표기를 계속 분리해야 한다. | `src/lib/taskPrototype.ts`, `ProjectTasksPage.tsx`의 `useServerTasks` 분기 |
| P1-06 | **S2 manifest가 개발 플래그 뒤에서만 저장 가능하고 실행 단계와 미연결.** 기본 실행에서는 사전 검증까지만 가능하며, 고정된 manifest를 소비하는 계약·실행 단계가 없다. F-202의 "실행 전 소스 재검증"은 미구현 | `AuditSourceSelectionPage.tsx`의 `enableManifest` 조건 |
| P1-07 | **로컬 Mock 실행의 단절.** placeholder 환경에서 프로젝트 생성이 백엔드 호출로 실패해, 다운로드본만으로는 프로젝트→문서→업무/감사 흐름을 한 번도 끝까지 검증할 수 없다. 실행계획서가 요구하는 브라우저 E2E의 로컬 선행 조건이 갖춰져 있지 않다. | `projectStore.createProject`에 로컬 가드 없음(§1.1) |
| P1-08 | **린트 실패 상태로 CI 청정 판정 불가.** 전체 린트 13 errors(§5.4). 실행계획서 Issue #6과 같은 상태가 유지 중이며, PR들의 SonarCloud 실패도 반복된다. | `npm run lint` 실측 |
| P1-09 | **문서 중복 실행 경로.** 문서 생성/재생성은 `upsertDocument`(project_id,type 충돌 기준)를 쓰고, 재생성 결과는 실제 AI가 아닌 고정 템플릿이다(§3.1). "재생성"이 기존 수동 편집을 무조건 대체하는 정책·경고가 수용 기준 수준으로 검증되지 않았다. | `src/lib/api/generation.ts`, `placeholderContent.ts` |

### 5.3 P2 (개선)

| ID | 결함 | 근거 |
|---|---|---|
| P2-01 | 업무 화면에서 프로젝트 확인 실패 시 오류 경고와 "확인하는 중" 문구가 동시에 남는다(ready 상태가 실패 경로에서 정리되지 않음) | §2에서 실제 브라우저로 확인. `ProjectTasksPage.tsx`의 로딩 분기 |
| P2-02 | 프로덕션 번들 1.1 MB 단일 청크. 코드 스플리팅이 없어 초기 로딩 성능 리스크(F-702 성능 회귀 항목) | `npm run build` 출력 |
| P2-03 | `lottie-web`의 direct `eval` 경고. CSP 강화 시 문제가 될 수 있어 의존성 교체·설정 검토 필요 | `npm run build` 출력 |
| P2-04 | 생성 Mock(placeholder)이 실제 생성과 같은 UI 흐름으로 노출됨. 결과물 신뢰에 대한 사용자 고지가 부족하면 Mock/실기능 구분 오류가 된다. | `placeholderContent.ts` |
| P2-05 | 템플릿 잔재 파일(`src/assets/react.svg`, `vite.svg`, 빈 폴더용 `.gitkeep`)과 사용처 없는 조회 API(`listServerTaskEvents`, P1-03과 별개의 정리 관점) 등 정리 대상 존재. 단, 삭제는 참조 검증 후 별도 작업으로만 수행할 것 | 파일 목록 확인 |
| P2-06 | 한글 파일명 애니메이션 JSON 3개가 ZIP/도구 체인에서 인코딩이 깨져 보일 수 있다(`src/assets/animations/*.json`). 실제 파일은 존재하나 크로스 플랫폼 도구에서 경로 문제가 생길 수 있다. | 원격/로컬 파일 목록 대조 시 확인 |
| P2-07 | `npm audit` 취약점 9건(3 moderate, 6 high). 즉시 악용 여부와 무관하게 의존성 점검 항목으로 기록 | `npm ci` 출력 |

### 5.4 린트 상세 (`npm run lint`, 13 errors / 3 warnings)

| 파일 | errors | 주요 규칙 |
|---|---|---|
| `src/pages/DocumentPage.tsx` | 3 (+3 warnings) | `react-hooks/set-state-in-effect`, `exhaustive-deps` |
| `src/lib/api/projects.ts` | 4 | `@typescript-eslint/no-unused-vars` |
| `src/components/common/EditableInlineTitle.tsx` | 1 | `react-hooks/set-state-in-effect` |
| `src/components/document/SaveVersionModal.tsx` | 1 | 〃 |
| `src/components/document/ScreenListTable.tsx` | 1 | 〃 |
| `src/components/document/WireframeSlideView.tsx` | 1 | 〃 |
| `src/components/project/RenameProjectModal.tsx` | 1 | 〃 |
| `src/hooks/useDebouncedSave.ts` | 1 | `react-hooks/refs` |

빌드(TypeScript 포함)는 통과하므로 타입 오류는 없다. 린트 오류는 실행계획서 Issue #6의 "레거시 오류"와 같은 계열로 보이나, 이번 점검에서 신규/기존 구분을 위한 기준선 비교는 수행하지 않았다.

---

## 6. 즉시 수정이 필요한 P0

§5.1의 4건을 그대로 최우선으로 한다. 수정 자체는 본 지시 범위가 아니므로 착수 순서와 완료 조건만 제시한다.

1. **P0-01 (문서 저장 덮어쓰기)** — 실행계획서 G1-B 순서대로, 문서별 마지막 서버 확인값 기반 조건부 저장(CAS)을 실제 자동저장 경로에 연결하고 오래된 초안의 자동 덮어쓰기를 차단한다. PR #22(계약)→#19(초안)→#23(통합)의 관계를 정리하되, 장문 본문을 URL 필터로 보내는 방식의 한계 때문에 PR #24의 revision 기반 설계를 먼저 확정하는 것이 안전하다. 완료 조건: 동시 편집·다중 탭·전환·재접속 실패 테스트 통과.
2. **P0-02 (복원 비원자성)** — 버전 생성+본문 교체를 단일 트랜잭션(RPC)으로 묶고, 실패 시 전체 롤백과 미저장 편집 보호를 보장한다. 완료 조건: 중간 실패 주입 테스트에서 버전/본문이 항상 일치.
3. **P0-03 (채팅 우회 갱신)** — 채팅 반영을 자동저장과 같은 단일 쓰기 경로(CAS 포함)로 통합한다. 완료 조건: 편집 중 채팅 반영 시 어느 쪽 변경도 유실되지 않는 회귀 테스트.
4. **P0-04 (RLS 미검증)** — 격리 DB에서 마이그레이션 전체(001~012 + 병합 시 009/010 재번호 포함)를 적용하고 owner/editor/viewer/outsider JWT로 읽기·쓰기·삭제·복원을 실증한다. 완료 조건: 역할별 허용/차단 매트릭스 전 항목 실측 기록. **운영 DB 적용은 이 완료 후에도 별도 승인이 필요하다.**

어느 P0도 "코드 작성"만으로 닫지 않는다. 운영규칙대로 실제 실행한 테스트 근거가 있을 때만 완료 처리한다.

---

## 7. 기능별 다음 작업 우선순위

실행계획서의 게이트 순서를 따른다. 앞 게이트의 P0를 은폐하는 다음 단계 진행은 금지한다.

| 순서 | 게이트/기능 | 다음 작업 | 완료 조건 |
|---|---|---|---|
| 1 | G1 (F-003/F-004, P0-01~03) | §6의 저장 안전성 통합. PR #15/#19/#22/#23/#24 중 채택할 단일 통합 경로 확정 + 마이그레이션 재번호 | 동시성·복원·채팅 회귀 + 브라우저 reload 테스트 PASS (격리 환경) |
| 2 | G1 (F-005, P0-04) | 격리 DB RLS 실증, 009/010과 main의 002/006 관계 정리 | 역할별 JWT 매트릭스 PASS |
| 3 | G2 (F-101~105) | S1 서버 모드 정식화: 삭제/복원 권한 UI 일치(P1-02), 감사 이력 화면 연결(P1-03), 업무 상세·AI 담당(F-105), done 재오픈 정책(FD-06) 결정 | 격리 DB + 브라우저 E2E, 새로고침·CAS 충돌 검증 |
| 4 | G2 (F-201~202) | S2 manifest 서버 고정 정식화와 stale 재검증 연결, 개발 플래그 졸업 조건 정의 | 타 프로젝트·삭제·미저장·변경 stale 차단 실증 |
| 5 | G3 (F-301~303) | PR #25 Mock의 병합 여부 결정(마이그레이션 충돌과 무관하므로 독립 판단 가능). 단 실제 계약·비용은 정책 승인(OP-01~03) 전 Mock 유지 | Mock 범위 명시, owner 외 접근 차단 E2E |
| 6 | G4 (F-401~402) | PR #27 Mock 검수 후 F-402 승인 상태머신 설계. 서버 저장·version CAS는 G1 패턴 재사용 | 구버전 승인 무효·중복 승인 차단 테스트 |
| 7 | G5/G6 (F-501~603) | 실제 실행·보고서는 계약·예산·provider 승인이 선행 조건. 승인 전에는 Mock/설계만 | 승인 문서 확보 후 착수 |
| 8 | G7 (F-701~702) | 린트 13건 정리(P1-08), 번들 분할(P2-02), 통합 E2E | 전체 회귀 PASS 후에만 출시 후보 |

병행 가능: G1을 건드리지 않는 PR #25/#27 Mock의 UX 검수·브라우저 E2E 보강은 실행계획서의 "신규 기능 레인"으로 병행할 수 있다.

---

## 8. 수정 전 확인이 필요한 사항

1. **통합 경로 선택:** PR #22(본문 비교 CAS) 방식을 폐기하고 PR #24(revision CAS)로 일원화할 것인지, PR #23을 통합 베이스로 삼을 것인지 결정이 필요하다. 다섯 개 PR을 각각 병합하는 방식은 §4.1의 충돌 때문에 불가능하다.
2. **마이그레이션 재번호 정책:** PR #23/#24의 011/012와 main의 011/012 중 어느 쪽을 재번호할지, 이미 격리 DB에 적용한 이력이 있는지 확인이 필요하다(적용 이력 확인 없이 재번호하면 환경 간 불일치가 생긴다).
3. **PR #15/#19의 base 처리:** base 브랜치가 main이 아닌 두 PR을 main 기준으로 재적용할지, 신규 통합 브랜치에서 재작성할지 결정이 필요하다.
4. **SonarCloud 실패 원인:** 전 PR 반복 실패가 설정 문제인지 실제 품질 게이트 위반인지 확인 전까지 CI 상태를 "일부 통과"로만 표기해야 한다.
5. **S1 권한 정책 확정:** 업무 삭제·복원을 owner 전용(DB 현행)으로 확정할지, editor 허용으로 DB를 바꿀지 제품 결정이 필요하다(F-104, FD-06의 done 재오픈 정책과 함께).
6. **로컬 검증 환경:** 격리 Supabase(또는 로컬 Supabase) 접속 정보와 테스트 계정 시드를 누가 어떤 환경에 준비할지 결정이 필요하다. 이게 없으면 G1/G2의 완료 조건을 어떤 작업자도 충족할 수 없다. **운영 Supabase 정보를 이 용도로 전용하지 않는다.**
7. **상용 정책 승인:** 운영정책 OP-01~07(가격, provider, 데이터 처리, 보존/삭제 등)이 미승인인 동안 S3 실계약·S5 실제 실행은 착수할 수 없다.
8. **Git 작업 방식:** 현재 폴더는 `.git`이 없는 ZIP이다. 실제 수정 작업에 들어가기 전에는 GitHub에서 정식으로 클론한 작업본에서 브랜치를 나누는 것을 권장한다. 이 점검 폴더를 그대로 `git init`해 원본으로 삼지 않는다.

---

## 부록. 이번 점검에서 수행하지 않은 것

- 기능 코드·문서(본 보고서 제외)·마이그레이션의 수정 또는 삭제
- Draft PR 병합, 리뷰 승인, 브랜치 생성, commit/push
- `npm run db:push` 및 모든 DB 마이그레이션 적용(운영·격리 포함)
- Vercel 배포, 유료 AI API·외부 모델 호출
- 실제 Supabase 프로젝트 접속 및 실사용자 데이터 조회
- 발견한 결함(P0 포함)의 임의 수정 — 전부 본 보고서에 기록만 했다

## 부록. 로컬 산출물

| 산출물 | 설명 |
|---|---|
| `.env.local` | 로컬 실행용 placeholder 환경변수(`.gitignore` 대상). 운영 정보 아님. 불필요하면 삭제할 것 |
| `dist/` | `npm run build` 결과물(`.gitignore` 대상) |
| `docs/quality/CURSOR_LOCAL_AUDIT_2026-10-21.md` | 본 검수 문서 |
| 개발 서버 | `http://127.0.0.1:5173` 백그라운드 실행 중 (점검 종료 시점 기준) |
