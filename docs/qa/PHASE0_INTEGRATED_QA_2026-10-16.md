# PlanOS Phase 0 — 통합 브랜치·격리 브라우저 QA 실행 기록

**최초 작성일:** 2026-10-16  
**최종 수정일:** 2026-10-16  
**문서 버전:** v1.4  
**진행 상태:** 앱 빌드·17개 단위·RLS SQL/REST·격리 Chromium B-01/B-02/C-01 및 B-05 정상 복원 PASS / 복원 실패·미저장 초안·18개 B/C 브라우저 미검증  
**대상:** [Draft PR #15](https://github.com/happysuyeun-rgb/plan_os/pull/15) · `test/planos-phase0-integrated-20261016`

## 1. 통합 구조 (기존 main·운영 DB 변경 없음)

| 계열 | 포함된 수정 | 검증 상태 |
|---|---|---|
| [Draft PR #8](https://github.com/happysuyeun-rgb/plan_os/pull/8) → [#9](https://github.com/happysuyeun-rgb/plan_os/pull/9) → [#11](https://github.com/happysuyeun-rgb/plan_os/pull/11) | TS/lint 기준, 문서별 자동저장·명시적 복원/재생성, 채팅 쓰기 충돌 및 저장 테스트 | 앱 기준선 17개 단위 테스트 PASS |
| [Draft PR #13](https://github.com/happysuyeun-rgb/plan_os/pull/13) → [#14](https://github.com/happysuyeun-rgb/plan_os/pull/14) | migration 009 프로젝트 멤버 RLS 재귀 제거·010 댓글/알림/버전 권한 보완, 실제 JWT 부정/허용 테스트 | 격리 PostgreSQL·Supabase Auth/JWT/REST PASS |
| [Draft PR #15](https://github.com/happysuyeun-rgb/plan_os/pull/15) | 두 계열을 테스트 전용 브랜치의 **2-parent merge commit**에 통합, 워크플로를 QA 브랜치에서 실행 | 3종 CI PASS, 브라우저 별도 실증 진행 |

- **통합 시작 부모:** 앱 계열 PR #11 head `108048f4acfb7244c019bb5a8d16c313a3cad4c0`, 보안 계열 PR #14 head `7436e420c18cfe3a056fdbdfcfed63c4ace85051`.
- **통합 머지 커밋:** `992bb60c8f458f4f813a52747d40463f83674d22`. 보안 브랜치는 `main` 대비 **13개 신규 파일만 추가**했고 앱 계열의 기존 파일은 통합 시 덮어쓰지 않았다. 이후 워크플로별 push 트리거만 테스트 브랜치에서 추가 설정.
- **목적:** 보안 SQL과 앱 수정이 하나의 소스 트리에 공존하고, 실제 프로젝트의 계정/운영 데이터 없이 함께 검증할 수 있도록 환경을 구성.
- **금지:** `main` 또는 기존 PR 병합, 운영 Supabase 프로젝트의 DDL/DML, Vercel 운영 배포, 유료 개발 DB 브랜치 생성.

## 2. 검증된 자동 CI 근거

| ID | 항목 | 실증/근거 | 현재 상태 |
|---|---|---|---|
| I-01 | TypeScript·빌드·ESLint·단위 테스트 | [Baseline #38855752421](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38855752421) — SHA `da81cabb65e77b36eb3652d9fa19f2b0a308b293` | **PASS** |
| I-02 | PostgreSQL RLS 무한 재귀 재현·009 적용 | [RLS SQL #38855752463](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38855752463) — 동일 SHA | **PASS** |
| I-03 | 실제 로컬 Supabase Auth/JWT/REST + migration 001~010 | [RLS REST #38855748722](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38855748722) — SHA `3996986106deeae6b2a7d67381debeb54749f6ce` | **PASS** |
| I-04 | 실제 웹 로그인 → Dashboard → PRD 열기 → 새로고침 | [Chromium Actions #38856198235](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38856198235) — SHA `4600ed4e313f03713be5680dab40b6a28bb01528`, `tests/e2e/browser_smoke.mjs` | **PASS** |
| I-05 | B-01·B-02·C-01 실제 브라우저 편집/서버 저장 | [Chromium #38867219334](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867219334), SHA `e933ea9647bd169ec675c1c6ad9061343f14a901`: PRD→기능명세서 탭 이동, 5회 수정, 미저장→채팅, 리로드 및 서버 content 대조 | **PASS (3/22 B/C)** |
| I-06 | 댓글 목록 반복 GET 방지 및 상이한 문서 응답 보호 | [PR #11 CI #38867723560](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867723560), [통합 Baseline #38867796471](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867796471), [Chromium #38867796404](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867796404) (SHA `c1ae3a73a56dffe7865e6024377a37a05e221ec5`) | **build/17 unit/댓글 미재조회/B-01/B-02/C-01 PASS** |
| I-07 | B-05 정상 버전 저장·과거 미리보기·복원·DB 불변성 | [Chromium #38869950232](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38869950232) SHA `9f5ff4965490f0ac43b902b9a1a1234e59391ad0`: v1/v2 생성, v1 읽기전용 미리보기, v3 복원, v1/v2 immutable, 리로드 후 문서 본문과 DB 일치 | **정상 복원 PASS; 복원 중간 실패·미저장 초안·동시성 미검증** |
| I-08 | 나머지 브라우저 B/C, CSEC-01~12 | 개별 [문서 저장 QA](DOCUMENT_SAVE_REGRESSION.md), [RLS QA](RLS_CONTENT_HARDENING_2026-10-16.md) | **B/C 18개 미실행(4/22 정상경로 확인), CSEC는 JWT/REST 수준 PASS(브라우저 아님)** |

**이력 주의:** CI 실행 중 신규 커밋이 추가되므로 **각 CI 성공 SHA를 반드시 기록**한다. 단일 CI 성공을 서로 다른 커밋에도 자동 적용된 것으로 처리하지 않는다. 초기 통합 이후 **PR #11의 `DocumentPage`·`commentStore` 소스 수정이 통합 브랜치에 별도 반영**되었고, 앱 빌드·Chromium B-01/B-02/C-01 및 댓글 GET 0회 검증을 해당 수정 뒤의 SHA에서 다시 통과했다. migration 009/010 SQL은 그 이후 바뀌지 않았으므로 RLS SQL·Auth/REST CI의 이전 성공 결과를 그대로 인용하되 테스트 SHA를 구분한다.

## 3. 실제 브라우저 QA 환경 구성

- GitHub Actions hosted runner에서 **로컬** Supabase CLI `2.84.2`: PostgreSQL(`127.0.0.1:54322`), GoTrue/Kong/PostgREST(`127.0.0.1:54321`)만 실행. hosted Supabase 토큰·DB URL·운영 사용자 미사용.
- migration `001~010`을 `psql`로 이 일회용 DB에만 적용. 임시 테스트 사용자는 로컬 Auth Admin API가 생성하며 SQL 테스트 계정과 구분한다.
- `tests/e2e/local_browser_env.mjs`는 로컬 CLI 출력에서 anon 키를 읽어 GitHub runner의 `.env.local`에만 기록하며 원본 키를 로그에 출력하지 않는다. `VITE_SUPABASE_URL=http://127.0.0.1:54321`.
- Vite `http://127.0.0.1:5173`, 개발 로그인 표시. Playwright Chromium 헤드리스 브라우저로 비밀번호 로그인, 대시보드 테스트 프로젝트 열람, PRD 본문 표시 및 새로고침까지 확인.
- 로컬 서비스는 종료 시 `supabase stop --no-backup`, 테스트 키 파일 `.env.local` 삭제. 실패 시 합성 데이터만 담은 화면 캡처를 3일간 Actions 아티팩트로 수집(키/토큰 파일 미수집).
- **구분:** 이 스모크는 로그인이 가능하고 핵심 화면이 열린다는 검사이며, 문서 저장·댓글·권한 변경·초대·휴지통·재생성·결제의 모든 E2E를 검증하지 않는다.

## 3.2 과거 버전 저장·미리보기·복원 B-05 실제 브라우저 확인 (2026-10-16)
- [GitHub Actions #38869950232](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38869950232), SHA `9f5ff4965490f0ac43b902b9a1a1234e59391ad0`, **completed SUCCESS**. 동일 커밋 [Baseline #38869950358](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38869950358)도 build/lint/17개 unit SUCCESS.
- 일회용 로컬 Supabase Auth/JWT/REST, 실제 Vite·Playwright Chromium 사용: PRD의 현재 내용을 이름 있는 버전 **v1('B05-old')**로 저장 → 새로운 본문으로 수정·저장하고 **v2('B05-current')** 저장 → v1 미리보기 시 textarea 읽기 전용 확인 → `이 버전으로 복원` → v3('복원') 생성 → 새로고침 후 최신 본문 유지 확인.
- 실제 로컬 PostgREST의 `document_versions` 기록은 버전번호 **1,2,3**, 이름 `B05-old`, `B05-current`, `복원`, 각 기록의 본문 `old,new,old`임을 검증. `documents.content`도 복원된 v1 본문과 일치. 기존 v1/v2 기록 불변성 확인. **단, v2를 복원 이전에 사용자가 명시적으로 스냅샷 저장한 경로만 검증했다.**
- **P0 이슈 [#16](https://github.com/happysuyeun-rgb/plan_os/issues/16)**: 현재 복원은 버전 INSERT→문서 UPDATE 별도 DB 작업이며, 두 번째 작업 실패·중복 클릭·버전 번호 동시 할당이나 별도 스냅샷 없는 최신 입력 보존이 검증되지 않음. 문구 `현재 버전은 보존`이 *스냅샷 저장되지 않은 최신 원고*에도 보장되는지 정책 명확화 필요. **정상 B-05 PASS를 트랜잭션 안전/전체 B-10 승인으로 간주 금지**.
- 다음 P0: B-05 실패 주입·B-10 새로 저장하지 않은 최신 수정 중 복원/동시성, C-03 채팅/문서 전환, B-03 네트워크 저장 실패. 운영 스키마/코드 main 변경은 별도 승인.

## 3.1 누락 점검과 실제 보완 결과 — 2026-10-16
| 등급 | 점검 항목 | 판정 | 이번 실제 조치 / 남은 차단 |
|---|---|---|---|
| **P0** | B-01 문서 이동 중 자동저장 | **보완·PASS** | 격리 Chromium PRD+기능명세서 각각 리로드/DB 값 비교 |
| **P0** | B-02 짧은 시간 다중 수정 | **보완·PASS** | 5회 수정 후 마지막 수정 서버 저장 검증 |
| **P0** | C-01 미저장 본문 + 채팅 | **보완·PASS** | 본문/메모 병합→실제 PostgREST 내용 유지 확인 |
| **P1** | 편집할 때마다 댓글 재조회 | **코드 수정·PASS** | `DocumentPage` 댓글 요청 dependency를 문서 ID로 한정, B-02 입력 중 추가 comment GET 0개 브라우저 확인 |
| **P0** | 늦은 댓글 응답이 다른 프로젝트/문서에 표시됨 | **코드 수정·추가 부정 테스트 필요** | `commentStore` 요청 순번·reset 무효화. 빌드 통과했지만 인위적 지연 응답 E2E는 미실행 |
| **P0** | 자동저장 실패·네트워크/페이지 이동 B-03/B-04 | **미실행** | 오프라인·느린 API 요청/복구·미저장 상태 테스트 |
| **P0** | 과거 버전 선택·복원 B-05/B-10 | **B-05 저장된 스냅샷 정상 흐름 PASS; 실패·동시성 미검증** | [Chromium #38869950232](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38869950232) 정상 v1→v3/DB; [Issue #16](https://github.com/happysuyeun-rgb/plan_os/issues/16) 문서/버전 2단계 원자성·미저장 내용 보존·버전 번호 경합 차단 |
| **P0** | AI 단일/연쇄 재생성 B-06~09 | **미실행** | 느린 응답/수정 충돌·재생성 실패·API 비용·결과 UI 확인 |
| **P0** | 채팅 C-02~10 | **9개 미실행** | 메시지 INSERT 성공 후 문서 UPDATE 실패 시 **원자성·멱등성 없음**. 타 프로젝트/읽기 전용/오프라인 경합 검증 필요 |
| **P0** | 팀 초대·역할/소프트 삭제·복원 B-11/12 | **미실행** | 로컬 JWT RLS 009/010은 검증했지만 실제 초대 이메일·pending user_id 연결·trash 후 멤버 접근 검증 안 됨 |
| **P1** | 알림 본문/actor·활동 user_id 위조·타 프로젝트 참조 | **미해결 보안 설계** | 읽기/행 소유권은 검사했으나 서비스 생성 데이터 진위성은 별도 PR 필요 |
| **문서** | QA에 남아 있던 'Supabase INACTIVE' 상태 | **정정 완료** | 현재 운영 Plan OS `ACTIVE_HEALTHY`, 적용 migrations 001~008. 009·010은 일회용 DB에만 적용, [문서 저장 QA v1.3](DOCUMENT_SAVE_REGRESSION.md) 동기화 |

**중요:** 통합 CI와 일부 브라우저 PASS는 모든 기능의 상용 안전성 검증이 아니다. B-01/B-02/C-01 및 B-05 **정상 복원 경로**까지만 실제 브라우저 확인했으며, 나머지 미검증 **18개 B/C**와 복원 오류/미저장 내용 보존을 섞어 'Phase 0 완료'로 표기하지 않는다.

## 4. 이후 화면별 체크 (실행 전 상태)

| 우선 | 시나리오 | 수용 기준 | 상태 |
|---|---|---|---|
| P0 | 로그인·프로젝트 카드·PRD 링크·새로고침 | 실제 계정 로그인 및 문서 표시; 로그아웃·미인증 접근은 별도 테스트 | **로그인·대시보드·PRD·리로드 PASS / 로그아웃·미인증 미실행** |
| P0 | PRD 편집 후 기능명세서 탭 전환·새로고침·빠른 연속 수정 | 서로 다른 문서 내용 유지·서버 반영 | **B-01/B-02 격리 Chromium PASS** |
| P0 | 버전 저장→과거 버전 읽기→복원 | 이력 불변·복원 본문 유지 | 미실행 |
| P0 | 채팅 저장 중 편집·문서 전환·오프라인 실패 | 편집 보존·중복 메시지/성공 오안내 없음 | **C-01 PASS / C-02~10 미실행** |
| P0 | 소유자 초대/역할 관리·pending 자기 초대·viewer 제한 | 화면/서버 권한 일치, 42P17 재발 없음 | 미실행 |
| P0 | 댓글 작성/답글·삭제/복원·반응·완료 상태 | 정상 기능 허용, 타인 데이터 변조 거부 | 미실행 |
| P0 | 알림 생성·수신·읽음, 프로젝트 휴지통·복원 | 수신자/프로젝트 격리·링크 및 복원 정상 | 미실행 |
| P0 | AI 재생성·연쇄 재생성 vs 자동저장 | 늦은 저장 덮어쓰기·중복 발생 없음 | 미실행 |
| P1 | 스냅샷 동시 번호·알림 본문/활동 위조·삭제 프로젝트 접근 | 서버 권한/원자성 명시 및 거부 테스트 | 미실행 |

## 5. 남은 일정과 종료 조건

- **통합 브랜치/자동 검증:** 기존 3종 CI 모두 PASS, 격리 Chromium B-01/B-02/C-01·B-05 정상 복원 PASS, 편집 중 댓글 재조회 0개 확인. 복원 실패·동시성·미저장 본문 보존은 Issue #16으로 차단. 서로 다른 CI 커밋들은 각 실행별로 위 표에 명확히 기재.
- **브라우저 전체 회귀:** 테스트 계정·기능 조합에 따라 **1~3 작업일** 잠정 추정.
- **채팅 INSERT와 문서 UPDATE 원자성, 후속 데이터 정합성:** **1~2 작업일 이상** 별도; 오류 재현 결과에 따라 변동.
- **Phase 0 종료:** PR #8/#9/#11/#13/#14 코드 및 009/010 역할별/실제 브라우저 테스트 PASS, 신규 P0 결함 수정, 백업·롤백 계획 검토, 별도 병합·배포 승인 필요.
- **전체 추정:** 기존 **Phase 0 잔여 5~10 작업일**, 전체 **43~79 작업일**을 최신 실증 결과 검토 전까지 임의로 변경하지 않음.

## 변경 이력

| 날짜 | 버전 | 변경 | 상태 |
|---|---|---|---|
| 2026-10-16 | v1.0 | 통합 2-parent 커밋·세 CI 결과와 Playwright 격리 브라우저 준비, 화면별 QA/남은 차단 기준 | 브라우저 스모크 실행 중 |
| 2026-10-16 | v1.1 | Playwright Chromium 실제 로그인→대시보드→PRD→새로고침 통과 증빙 및 전체 E2E 미완료 구분 | 4가지 자동 검증 범위 PASS / 전체 UI QA 진행 필요 |
| 2026-10-16 | v1.2 | B-01/B-02/C-01 브라우저·격리 DB 저장 확인, 댓글 반복 GET 및 늦은 응답 보완, 누락/미검증 B/C 19건·보안/원자성 게이트 정리 | 일부 B/C PASS / 전체 UI QA·릴리스 전 |
| 2026-10-16 | v1.3 | 초기 통합 뒤 실제 앱 소스 2개 수정·PR #11/통합 재검증을 SHA별로 명시, SQL 변경 없음의 범위 구분 | 검증 근거 정합화 |
| 2026-10-16 | v1.4 | B-05 실제 Chromium 정상 버전 복원(v1/v2 불변·v3 복원)과 DB 검증 PASS, 실패/원자성/미저장 본문 Issue #16 별도 차단·잔여 B/C 18개 재산정 | 정상 B-05 PASS / 전체 안정성 미완료 |
