# Phase 0 — Repository Baseline Audit (in progress)

**최초 작성일:** 2026-10-14  
**최종 수정일:** 2026-10-16  
**문서 버전:** v2.7  
**진행 상태:** 진행 중  


**초기 조사 범위:** 2026-10-14 GitHub 기본 브랜치 일부 코드 파일로 시작, 이후 저장소 목록·SQL 8개 및 2026-10-16 실제 Supabase READ ONLY 점검으로 확장됨. **운영 DB 001~008 적용 확인·멤버 SELECT 재귀 실증, 나머지 역할별 권한/브라우저는 미검증.**

## 2026-10-16 B-05 버전 복원 정상 경로와 P0 원자성 잔여 위험
- **브라우저 실증:** [Chromium/로컬 Supabase Actions #38869950232](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38869950232) `SUCCESS`, code SHA `9f5ff4965490f0ac43b902b9a1a1234e59391ad0`. 명시적 v1/v2 버전 저장→이전 v1 읽기전용 선택→v3 복원→문서 새로고침, DB `document_versions` 1/2/3 내용 old/new/old 불변성·현재 `documents.content` 검증. 같은 SHA [Baseline #38869950358](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38869950358) PASS.
- **위험은 아직 해소되지 않음:** `src/store/versionStore.ts`에서 `apiCreateVersion` INSERT 후 `saveDocumentContent` UPDATE를 별도 요청으로 처리. 두 번째 실패 때 유령 복원 이력/문서 불일치, 재시도 중복, SELECT MAX+1 버전 번호 경합 가능성. 사용자 안내 `현재 버전은 보존`이 *명시적 스냅샷이 없는 편집 내용*을 보존한다는 증거 없음. 이 항목은 **코드 감사상 잠재 결함**이지 장애 직접 재현이라고 주장하면 안 됨.
- **[P0 Issue #16](https://github.com/happysuyeun-rgb/plan_os/issues/16)**에 실제 실패 주입·unsnapshotted draft·버전 잠금/트랜잭션·멱등성·UX 처리 게이트를 분리. B/C 4개 정상 경로 PASS, 18개 미실행. 실제 브라우저 전체 QA와 배포 전 사전 검증이 필요.
- **운영 경계:** PR #15 테스트 브랜치에서만 Playwright/일회용 Supabase 사용. 운영 hosted Supabase 009/010 미적용·`main` 미병합.

## 2026-10-16 앱 실제 브라우저 회귀 보완 및 누락 감사
- **실제 Chromium 저장 검증:** [Actions #38867219334](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867219334)에서 **B-01 PRD/기능명세서 빠른 전환 각각 저장, B-02 문서 연속 5회 편집 마지막 값, C-01 미저장 초안+채팅 병합** 모두 PASS. 새로고침/일회용 PostgREST DB `content`까지 대조; 운영 DB 검증 아님.
- **추가 코드 결함:** `src/pages/DocumentPage.tsx`의 `useEffect([activeDoc])`가 문서 입력에 따른 `Document` 객체 변경마다 댓글 스레드를 GET하는 불필요한 요청을 반복. `activeDocumentId` 기반으로 수정. `commentStore.fetchThreads`에 요청 순서/프로젝트 reset 판별 추가, 낡은 응답 반영 방지.
- **자동 테스트 검증:** [PR #11 Actions #38867723560](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867723560)와 [통합 #38867796471](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867796471) TS/build/lint/17 unit PASS. [통합 Chromium #38867796404](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867796404)에서 B01/B02/C01 재검증 및 문서 입력 중 comment GET **0건** PASS.
- **남은 P0:** `versionStore.fetchVersions` 늦은 응답/부분적 복원 트랜잭션, B-03/B-04 실패 복구, B-05/10 이력/복원, B-06~09 AI 재생성, C-02~10 채팅 프로젝트 이동·메시지 INSERT/문서 UPDATE 원자성·멱등성, 실제 초대/휴지통/댓글/알림 UI·soft-delete 멤버 권한/참조 무결성. **B/C 22개 중 3개만 실제 브라우저 PASS, 19개 미실행**.
- **구체적 QA:** [통합 누락·검증 보고서 v1.2](https://github.com/happysuyeun-rgb/plan_os/blob/test/planos-phase0-integrated-20261016/docs/qa/PHASE0_INTEGRATED_QA_2026-10-16.md), [문서 저장 QA v1.3](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-chat-document-write-20261016/docs/qa/DOCUMENT_SAVE_REGRESSION.md). 운영 Supabase는 `ACTIVE_HEALTHY`이나 운영 009/010 미적용, Draft/미병합·운영 배포 없음.

## 2026-10-16 통합 기준선 및 브라우저 스모크
- **통합 [Draft PR #15](https://github.com/happysuyeun-rgb/plan_os/pull/15)**: 앱 코드 PR #11을 첫 부모, RLS PR #14를 두 번째 부모로 하는 통합 commit `992bb60c8f458f4f813a52747d40463f83674d22`. GitHub compare에서 RLS 변경 13개는 **기존 파일 수정 없는 신규 파일 추가**였으며 앱 TS/Supabase 소스 충돌 없음.
- **실측 검증:** [Baseline #38855752421](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38855752421) (build/lint/17 단위), [RLS PostgreSQL #38855752463](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38855752463) (42P17→009), [Auth/JWT/REST #38855748722](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38855748722) (001~010 댓글/알림/버전), [실제 Chromium #38856198235](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38856198235) (로그인·대시보드·PRD·리로드) 각각 **SUCCESS**. CI별 SHA 차이는 QA 워크플로 편집 때문이며, 앱과 RLS SQL 소스는 통합 후 변경되지 않음.
- **경계:** 실제 브라우저 E2E는 로그인·대시보드·문서 확인의 스모크만 수행. 기존 저장/복원/채팅 B-01~12/C-01~10, 팀 초대·권한 변경·댓글·알림·문서 버전·휴지통 회귀 및 알림 스푸핑/활동 감사/저장 원자성은 아직 미검증.
- **운영:** Supabase hosted DB에 009/010 미적용, `main`·Vercel 운영 배포/유료 인프라/결제 미변경. [통합 QA 보고서](https://github.com/happysuyeun-rgb/plan_os/blob/test/planos-phase0-integrated-20261016/docs/qa/PHASE0_INTEGRATED_QA_2026-10-16.md).

## 2026-10-16 추가 권한 하드닝 — 댓글·반응·알림·문서 버전
- **변경은 별도 [Draft PR #14](https://github.com/happysuyeun-rgb/plan_os/pull/14)**, base PR #13. migration `010_harden_comments_notifications_versions.sql`에서 댓글 댓글 작성자/스레드 귀속 필드 UPDATE 트리거, 타인의 반응/참여 상태 UPDATE·DELETE 금지, 알림 수신자 프로젝트 active/owner 확인 및 읽음 필드 외 수정 금지, 이력 UPDATE 차단, soft-delete 댓글 빈 본문 허용. `009`를 선행 적용해야 한다.
- **CI 실증 완료:** [Actions #38854258418](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38854258418) `success`, code/test SHA `f2dc298484fbf8c7fda9373a9b0ef46e2c5b5c7f`. 일회용 로컬 Supabase의 실제 Auth/JWT/REST 및 DB migrations 001~010에서 댓글 소유권·정상 수정/삭제·반응/참여 자기 행·알림 actor/recipient/readonly·문서 버전 append-only 부정/허용 테스트 모두 PASS.
- **초기 실패 해결:** CI #38854082810은 발신자가 수신자의 알림 SELECT 권한이 없는데 `return=representation`을 기대한 **테스트 요청 오류**였다. 실제 클라이언트대로 `return=minimal`로 보내고 수신자 JWT로 확인한 뒤 최종 CI 성공.
- **잔여 정합성 위험:** 클라이언트 알림 payload/actor_name/타입 위조, project_activities user_id 위조, 댓글 document_id/parent_id의 프로젝트 FK 간 무결성, 프로젝트 soft-delete된 active member의 RLS, 버전 번호 동시성은 추가 설계/부정 테스트 필요. **권한 검증 전체 완료로 표기하면 안 됨**.
- **QA 체크리스트:** [RLS 내용 권한 검증 v1.1](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-rls-content-hardening-20261016/docs/qa/RLS_CONTENT_HARDENING_2026-10-16.md). 실제 웹 브라우저 회귀/운영 DB 적용 검증은 미완료. hosted Supabase 009/010 미적용, `main` 미병합, 배포 없음.

## 2026-10-16 실제 로컬 Supabase Auth/JWT/PostgREST API 통합 검증
- **격리 환경:** [GitHub Actions #38852999398](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38852999398) **SUCCESS**. 공식 CLI 기반 일회용 GoTrue(Auth)/PostgREST/Kong/Postgres 컨테이너, migration 001~009 적용. 생성 계정은 전부 임시이며 운영 접속 정보/실사용자 데이터 없음.
- **실제 JWT:** 로컬 GoTrue Admin API에서 합성 계정 7명 생성, 비밀번호 로그인으로 JWT 발급, JWT로 `/rest/v1/project_members`·`documents` 접근 확인.
- **통과:** owner/editor/viewer 해당 프로젝트 SELECT, pending 본인 초대 행만 SELECT, 타 프로젝트 소유자/회원 및 outsider/anon 조회 차단, viewer 문서 PATCH 차단 및 내용 무손상. `42P17` 재귀는 수정된 `009`에서 발생하지 않음.
- **실패/수정:** 최초 #38852770669의 테스트 기대값에 프로젝트 소유자를 `project_members` 행으로 잘못 포함한 결함이 있었으며, DB 구조(`projects.user_id`) 기준으로 수정 후 위 성공 실행 확인.
- **한계:** 실제 운영 DB의 `009`는 아직 **미적용**. 웹 UI(팀/초대·역할 전환·프로젝트 삭제/복원), 나머지 RLS 정책, 메시지/문서 저장 원자성 검증 미실행. [상세 QA v1.2](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-rls-member-recursion-20261016/docs/qa/RLS_LIVE_READONLY_2026-10-16.md).
- **보류:** PR #13 Draft, production schema/API/코드 `main` 미변경. 실제 운영 마이그레이션 적용은 역할별 UI QA/백업·롤백 계획과 별도 승인 후 진행.

## 2026-10-16 격리 PostgreSQL 17 RLS 009 실증 후속
- **격리 데이터베이스 구성 완료:** GitHub Actions [#38849011220](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38849011220)의 일회용 PostgreSQL 17 (서비스 컨테이너, 합성 데이터, Supabase 운영 DB 미연결). migrations 001~008 원본 적용 및 known 42P17 재귀 재현 → `009` 수정 적용 → 역할별 SELECT 검증 **SUCCESS**.
- **초대 회귀 차단:** 첫 `009` 제안은 pending 사용자의 자기 초대 행까지 가릴 수 있었음. 실제 [PR #13](https://github.com/happysuyeun-rgb/plan_os/pull/13)을 `auth.uid() = user_id OR public.can_access_project(project_id)`로 보완. 합성 owner/editor/viewer/pending/타 프로젝트/outsider/anon 역할 검사에서 정상 통과.
- **CI 보장 범위:** 인증 역할·JWT 세션은 CI에 정의한 `auth.uid()` 최소 에뮬레이션이며, **실제 Supabase Auth/PostgREST·실제 초대 및 삭제/복원 사용자 흐름을 테스트한 것은 아님**. 브라우저/RLS 전체 시스템 배포 게이트는 유지.
- **근거:** [RLS 읽기 전용·격리 CI 검증 보고서 v1.1](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-rls-member-recursion-20261016/docs/qa/RLS_LIVE_READONLY_2026-10-16.md) 및 [개발 실행계획 v1.5](../roadmap/IMPLEMENTATION_PLAN.md) 잔여 43~79 작업일(잠정).
- **허용되지 않는 행동:** 운영 DB DDL/DML, 재귀 오류 해결됐다는 운영 주장, 승인 없는 main 병합/배포, 새 유료 Supabase 브랜치 생성.

## 2026-10-16 Supabase 재활성화: 실제 READ ONLY 감사 (최신)
- **DB 상태:** Plan OS `ACTIVE_HEALTHY`; 마이그레이션 `001`~`008` 실제 적용 이력 조회, 공개 스키마 12개 테이블 RLS 활성. 개발 DB 브랜치 **0개**. 이전 `INACTIVE`·timeout 문구는 아래 기록의 **과거 시점 상태**.
- **실제 오류 검증:** `BEGIN READ ONLY; SET LOCAL ROLE authenticated; SELECT count(*) FROM public.project_members; ROLLBACK;` → PostgreSQL **42P17 infinite recursion detected in policy for relation "project_members"**. 재귀 SQL은 migration `006`의 `"멤버 조회"` 정책.
- **함수 소유권/격리 확인:** `get_project_role`, `can_access_project`, `can_edit_project_content`은 SECURITY DEFINER, postgres 소유, BYPASSRLS 확인. 존재하지 않는 프로젝트 접근 함수 결과는 false/null. 역할별 fixture는 미설치.
- **다른 RLS 조회:** 댓글 UPDATE는 프로젝트 멤버면 허용, 반응·참여 상태 UPDATE/DELETE 기존 행의 user_id 소유권 검사 부족, 활동 이벤트 작성자/알림 수신자 검증 부족, document_versions UPDATE 가능 등 **정책 코드 사실**을 실제 pg_policies로 확인. 사용자 간 조작 성공은 재현하지 않음.
- **Security Advisor 경고:** `set_updated_at()` search_path 1개, SECURITY DEFINER 4개 anon EXECUTE + 같은 4개 authenticated EXECUTE, leaked-password protection 비활성화 1개. [함수 search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [익명 함수 실행](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [인증 함수 실행](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [Auth 보호](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). 경고 = 악용 증명은 아님.
- **미적용 개선:** [Issue #12](https://github.com/happysuyeun-rgb/plan_os/issues/12), [Draft PR #13](https://github.com/happysuyeun-rgb/plan_os/pull/13)로 `009` SELECT 정책 비재귀 변경 및 [QA 실측 보고서](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-rls-member-recursion-20261016/docs/qa/RLS_LIVE_READONLY_2026-10-16.md) 작성. 실제 DB DDL/DML/fixture/백업 변경/배포/병합하지 않음.
- **다음:** 격리 DB/로컬 Supabase에서 `009` 적용→A~F 역할별 접근·초대·삭제/복원 테스트→고객 UI 회귀→롤백 확인→운영 DB 적용은 별도 승인.

## 최신 기준선 요약 (2026-10-16)
- **현재 CI 근거:** PR #8 [Actions #38680673570](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38680673570)에서 build/lint **성공(ESLint 오류 0개·경고 1개)**. 아래 2026-10-14 lint 실패 기록은 **과거 이력**이지 최신 판정이 아니다.
- **실측 미완료:** 브라우저 E2E/문서 자동저장·버전/프로젝트 복원 회귀, 개발 DB owner/editor/viewer/outsider RLS 재현, 운영 DB 마이그레이션 적용 상태/배포 보호 설정 확인.
- **제품 문서 추가:** [12개 문서 교차 감사](../quality/DOCUMENT_REVIEW_2026-10-16.md), [데이터 모델](DATA_MODEL.md), [API 계약](API_CONTRACTS.md). 설계 초안이 현행 코드에서 구현되었다는 뜻이 아님.
- **승인 전 금지:** 운영 DB 변경, CI 통과만으로 PR #8 자동 병합, 실제 권한 테스트 없는 신규 서버 서비스 역할 배포.

## 2026-10-16 실제 Supabase 환경 확인 및 코드 회귀 대응
- **Plan OS Supabase 상태:** 프로젝트 `INACTIVE`; 개발 브랜치 0개. 마이그레이션 조회는 DB connection timeout. **실제 적용된 정책·GRANT·데이터 무검증**. 개발 환경을 별도로 확보해야 SQL RLS 역할 테스트 가능.
- **코드 변경 별도 Draft PR:** [PR #9](https://github.com/happysuyeun-rgb/plan_os/pull/9) (`fix/planos-document-autosave-safety-20261016`), base PR #8: 문서 ID별 예약 저장, 순차 요청, 문서 전환 중 dirty content 보존, 오래된 프로젝트 fetch 응답 무시. **코드는 변경 브랜치에만 있으며 main 미반영.**
- **실측 CI:** [Actions #38844552645](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38844552645)에서 npm ci·build/TypeScript·lint·자동저장 유닛테스트 4개 **PASS**. 로컬 Node 22에서도 4개 통과.
- **미검증 회귀:** 브라우저에서 문서 탭 전환, 이전 버전 보기/복원, regenerate/regenerateCascade, 저장 실패 후 복구, 다른 프로젝트로 이동 중 pending/in-flight save, 비동기 문서 목록 응답, URL/댓글 딥링크. 특히 재생성과 복원이 큐의 미완료 저장과 충돌할 가능성은 추가 차단/회귀 필요.
- **RLS 계속 보류:** 격리 개발 DB가 없어 실제 SQL 실험을 하지 않았다. 운영 DB 부활·마이그레이션·새 유료 브랜치 생성도 하지 않았다.

## 2026-10-16 PR #9 보강: 명시적 문서 덮어쓰기까지 직렬화
- [Draft PR #9](https://github.com/happysuyeun-rgb/plan_os/pull/9): `createDocumentAutosave.replace`를 문서별 **동기적 쓰기 슬롯 예약 + 미저장 초안 저장 + 명시적 덮어쓰기 + 이후 신규 편집 저장** 순으로 구성. `versionStore.restoreVersion`, `documentStore.regenerate`, `regenerateCascade`가 사용함.
- **CI 성공:** [Actions #38845602357](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38845602357), 코드 SHA `abf15fcb9331b6d8675c9cd95edeb1a9644caa03` — npm ci, TypeScript/build, lint, **11개 unit tests 통과**. 이전 단계의 테스트 실패는 수정됨.
- **계속 위험:** `sendChatMessage`는 문서를 직접 UPDATE하므로 이 대기열을 우회([Issue #10](https://github.com/happysuyeun-rgb/plan_os/issues/10)); 직접 브라우저/프로젝트 DB 동작, 버전 복원 저장 트랜잭션, 서버 RLS 검증 미실행. [브라우저 QA 체크리스트](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-document-autosave-safety-20261016/docs/qa/DOCUMENT_SAVE_REGRESSION.md) 참고.
- **판정:** 단위 테스트 수준 개선이며 브라우저/DB 회귀 완료가 아님. PR #9 Draft 유지, `main` 병합·배포·DB 변경 없음.

## 2026-10-16 추가 코드 대응: 채팅 문서 직접 쓰기 (Issue #10)
- **이전 문제:** `src/lib/api/chat.ts`의 `sendChatMessage`가 직접 `documents.content`를 조회/수정했고 ChatPanel이 다시 활성 탭에 `updateContent`를 호출해 저장 충돌/중복 가능성이 있었음.
- **수정 Draft [PR #11](https://github.com/happysuyeun-rgb/plan_os/pull/11):** 기존 직접 DB UPDATE 제거, 현재 편집 버퍼에 메모를 합쳐 `documentStore.applyChatEdit`을 통한 문서 ID별 큐에 예약/저장. 화면 활성 탭 중복 쓰기 제거, 프로젝트/문서 불일치 및 과거버전 보기 거부, 채팅 UI/버전 목록은 문서 ID 변화에만 로딩.
- **CI 실측:** [Actions #38847021222](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38847021222), 커밋 `108048f4acfb7244c019bb5a8d16c313a3cad4c0` — npm ci/TS·빌드/lint, 채팅 병합 6개 + 기존 저장/복원/재생성 11개 = **17/17 PASS(실패 0)**. 브라우저·DB 테스트는 별개.
- **남은 위험:** 사용자 메시지가 먼저 INSERT되고 문서 저장에 실패하면 메시지·문서 상태가 불일치할 수 있음. 서버 트랜잭션·멱등성 설계가 필요. 채팅 메모/AI 작업 결과의 버전 복원 충돌, 다른 기기 동시 편집, RLS/브라우저 실제 테스트는 여전히 미검증.
- **테스트 체크리스트:** [PR #11 브랜치 C-01~10](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-chat-document-write-20261016/docs/qa/DOCUMENT_SAVE_REGRESSION.md). 운영 Supabase 비활성, DB 변경/배포/병합 금지.

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


## 2026-10-16 RLS 개발 DB 검증 매트릭스 (계획 작성 완료, 실행 미완료)
- **환경:** 운영 DB가 아닌 격리 개발 DB. 마이그레이션 적용 순서 확인 후 owner(A), editor(B), viewer(C), 외부인(D), 타 프로젝트 owner(E) 테스트 계정을 각각 준비. service_role로 일반 사용자 동작을 대체하지 않음.
- **RLS 재귀:** 각 계정으로 `project_members` SELECT 실행. 정책 재귀 오류/성능, 동일 프로젝트와 다른 프로젝트 멤버 노출 범위 확인.
- **댓글 수정:** B/C가 타인의 `project_comments` 본문/상태 UPDATE 시도. 본인 댓글과 타인 댓글 권한을 구분하여 허용/차단 기대값을 제품 정책에 따라 명시.
- **반응·참여상태:** B/C가 타인 `comment_reactions` / `comment_participant_status` UPDATE/DELETE 시도; 자기 레코드만 변경 가능한지 확인.
- **알림:** A가 동일 프로젝트/외부 프로젝트/존재하지 않는 recipient에게 알림 INSERT 시도. recipient membership과 actor_id 검증.
- **활동·버전·생성:** viewer의 `project_activities` 이벤트 위조, editor의 `document_versions` 기존 버전 UPDATE, editor의 `generation_runs` 임의 상태 변경 시도.
- **판정:** 각 시나리오에 테스트 SQL, 계정 역할, 기대값, 실제 결과, 오류 메시지, 적용 migration hash 기록. 허용되지 않아야 할 조작이 가능하면 별도 수정 migration PR 작성. 실제 권한 확인 전까지 '취약점 확정'으로 표기하지 않음.
- **승인 경계:** 운영 DB에 직접 테스트/마이그레이션 적용하지 않음. 개발 DB 접속정보 미확보로 실제 SQL 실행은 미완료.

## 2026-10-16 CI 검증 및 회귀 시나리오
- **실측:** [GitHub Actions run #38680673570](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38680673570) on `fix/ci-lint-baseline-20261014` at commit `152e33968a90eea9e23dc58c63e4ba1beedc6dc4`: `npm ci` PASS, `npm run build` PASS, `npm run lint` PASS with **0 errors, 1 warning**.
- **남은 경고:** `DocumentPage.tsx:307` effect dependency (`activeDoc`, `setContent`, `setReadOnly`, `versions`). 무작정 의존성을 추가하면 문서/버전 목록 갱신 때 저장 중인 내용을 덮어쓸 수 있으므로 실제 회귀 테스트와 함께 처리.
- **필수 회귀 체크리스트(아직 실행 안 함):** (1) URL `?panel=comments&thread=...` 직접 진입 및 화면 내 URL 변경 (2) 편집/리뷰 모드와 viewer 권한 (3) 버전 선택·원본 복귀·버전 복원 (4) 화면 목록/와이어프레임 빠른 편집 중 debounce 저장 및 문서 변경 (5) 모달 닫기/재열기·기본값 갱신 (6) owner 프로젝트 휴지통 복원 및 타인 복원 차단.
- **관찰된 정적 위험:** `DocumentPage.tsx`는 댓글 패널 열림을 URL에서 초기화하므로 동일 컴포넌트가 유지된 채 query만 변경되면 패널 자동 열림이 보장되지 않음. `documentStore.ts`의 전역 saveTimer와 현재 activeDocType 참조도 문서 전환/저장 경합 위험. **실행 재현 전까지 확정 버그로 단정하지 않음.**
- **다음:** 안전한 개발 환경에서 위 회귀를 수행하고, Issue #7의 RLS 정책은 별도 개발 DB에서 역할별 재현. 운영 DB 변경 금지.

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
| 2026-10-16 | v1.4 | CI 성공 근거와 잔여 lint 경고, 회귀 시나리오·정적 저장 경합 위험 기록 |
| 2026-10-16 | v1.5 | RLS 역할별 재현 매트릭스·기대 결과·운영 DB 변경 금지 조건 추가 |
| 2026-10-16 | v1.6 | CI 최신 성공을 문서 상단에서 단일 상태로 표시·과거 실패 이력 구분·교차 감사 연결 |
| 2026-10-16 | v1.7 | Plan OS DB 비활성·별도 브랜치 없음/조회 타임아웃 실측, PR #9 자동저장 코드 및 4개 테스트 CI 통과·실제 회귀 미완료 기록 |
| 2026-10-16 | v1.8 | 복원·재생성 직렬화/신규 입력 경합 11개 유닛 테스트 CI 성공 및 채팅 직접 문서 UPDATE 잔여 위험 기록 |
| 2026-10-16 | v1.9 | PR #11의 채팅 직접 DB 쓰기 제거·6개 테스트 추가, 프로젝트/문서 격리 및 메시지 원자성 QA 리스크 기록 |
| 2026-10-16 | v2.0 | PR #11 GitHub CI 성공 실측(빌드·린트·17개 테스트 통과) 기록, 브라우저/RLS·메시지 원자성 차단 유지 |
| 2026-10-16 | v2.1 | 재활성 Plan OS DB 001~008·RLS 실측, project_members 42P17 직접 재현, Supabase Advisor 경고 및 Draft PR #13 기록 |
| 2026-10-16 | v2.2 | 일회용 PostgreSQL 17 001~008 재귀 재현→009 수정·권한 테스트 CI 성공 및 pending 초대 정보 보존 확인 |
| 2026-10-16 | v2.3 | 실제 로컬 Supabase Auth 로그인/JWT·PostgREST 역할별 조회/뷰어 쓰기 차단 CI 성공 및 운영/브라우저 미검증 경계 기록 |
| 2026-10-16 | v2.4 | PR #14 migration 010 댓글/반응/참여/알림/버전 실제 로컬 Supabase JWT/REST 12개 권한 시나리오 CI PASS 및 잔여 보안 정리 |
| 2026-10-16 | v2.5 | 통합 2-parent PR #15과 앱 TS/build/lint/17개 유닛·RLS 009/010 SQL/REST·Chromium 로그인/문서 스모크 CI 통과 증빙 기록 |
| 2026-10-16 | v2.6 | B-01/B-02/C-01 일회용 Chromium+DB 실증, 댓글 객체 의존 중복 GET/낡은 응답 방지 후 재검증·19개 UI 누락 판정 |
| 2026-10-16 | v2.7 | B-05 과거 버전 정상 복원 Chromium+DB old/new/old 검증 성공, 2-step INSERT/UPDATE 비원자성·미저장 현재 버전 보존 미검증 P0 Issue #16 기록 |

