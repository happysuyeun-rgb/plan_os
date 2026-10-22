# PlanOS 3.0 — Cursor 문서 기반 자율 개발 실행전략 v1.0 (2026-10-22)

**적용:** 개발 작업의 기본 운영 계약 / 문서 작성만으로 기능 구현 완료 아님. **작업 원본:** 제품 설계 Draft PR #28의 기능·화면 계약과 실제 GitHub 코드/CI. [화면·기능 교차감사 V4](../quality/PLANOS_SCREEN_FUNCTION_CROSS_AUDIT_V4_2026-10-22.md)의 A4-01~19를 개발 선행조건으로 사용.

> **목표:** Cursor가 단순히 화면 시안을 만드는 대신 기능정의서 F-ID/STAFF-ID → Task Flow TF-ID → IA N-ID/C-ID → 화면 상태/필드/CTA → 데이터·인가/API → 구현 코드 → 격리 테스트 → 보고의 추적 가능한 *한 작업 루프*를 수행한다. 문서에 URL이나 테이블이 있다는 이유만으로 존재한다고 가정하지 않는다.

## 1. 정본 읽기 순서 (매 개발 시작 시 자동 확인)

| 순위 | 읽기 자료 | 개발자가 꺼내야 할 사실 | 충돌 처리 |
|---|---|---|---|
| 0 | GitHub 최신 main/head·열린 PR·CI, 현행 `src/App.tsx`, `src/lib/documentTypes.ts`, 실제 마이그레이션 | 존재하는 라우트/DB/테스트/기능 플래그와 구현 상태 | 실코드·DB에 없는 것은 TARGET. 호스팅 DB는 검증 전 추정 금지 |
| 1 | [서비스기획 v2.0](../product/SERVICE_PLAN_V1_2026-10-20.md) + [사업 개선 제안 PR #31](https://github.com/happysuyeun-rgb/plan_os/pull/31) | 기본 AI 기획 유지, PM/직원 가치, 고객 유료 결과·첫 수직 슬라이스 | PR #31은 **제안**; 승인된 가격/범위로 오인 금지 |
| 2 | [기능정의서](../product/FUNCTIONAL_SPEC_V1_2026-10-20.md) | F-001~801 + STAFF-01~11 ID, 수용·오류, 구현/미구현 | [A4 감사](../quality/PLANOS_SCREEN_FUNCTION_CROSS_AUDIT_V4_2026-10-22.md)에 수정·미결정이 있으면 확인 |
| 3 | [Task Flow](../product/TASK_FLOWS.md), [IA](../ux/IA.md), [화면 전수 매트릭스](../ux/PLANOS_ALL_SCREENS_ACCEPTANCE_MATRIX_2026-10-21.md) | TF-01~46/C01~11/N01~32 / 대상 CTA/내비/상태 | TF-S/ST-UI/P-*는 옛 별칭; N24~32 다수가 N16~21의 패널 |
| 4 | [SCREEN_SPEC](../ux/SCREEN_SPEC.md), [AI 직원 상세 스토리보드](../ux/AI_STAFF_SCREEN_STORYBOARD_V1_2026-10-21.md), [UX_FLOWS](../ux/UX_FLOWS.md) | 입력·검증·실패/취소·접근성, 사람 작성/실제 AI 실행 표시 | 부족한 수용 조건은 PR에 구현 후보/차단으로 기록; 독단적 상품정책 금지 |
| 5 | [권한 정책](../product/PERMISSIONS_POLICY.md), [직원 단일 데이터/API 계약](../engineering/AI_STAFF_DATA_AUTH_CONTRACT_V1_2026-10-21.md), [기존 API 계약](../engineering/API_CONTRACTS.md), [QA](../quality/TEST_PLAN_2026-10-20.md) | 역할·프로젝트 격리·버전·동의/원가·STAFF-API-01~15·실행 API-01~23 | 명세 API는 목표 URL이며 실행 서버가 아니다; 실제 브라우저 Supabase API 별도 |

**정본 원칙:** 사용자의 명시 제품 요구와 데이터·보안·사전 승인 경계가 우선. 이어 서비스/기능/TF/화면/데이터 계약의 해당 분야 정본을 적용한다. 기존 기술 문서에 서로 다른 URL·enum·ID가 나오면 **새로운 이중 구현을 금지**하고 V4 감사에 이슈를 기록한 뒤 수직 슬라이스에 한 개만 선택한다.

## 2. 개발할 때 Cursor가 지켜야 할 9단계 루프

1. **현상 읽기:** `git status --short`, `git branch -vv`, 원격 최신 PR/브랜치, 실제 `src/App.tsx` 라우트, 변경 대상 파일, 기존 테스트와 CI를 확인한다. 이전 보고의 SHA를 최신으로 추정 금지. 사용자가 넘긴 미커밋 파일을 임의 삭제 금지.
2. **한 슬라이스 선택:** [#32](https://github.com/happysuyeun-rgb/plan_os/issues/32)에서 아직 미검증인 *최소 실제 기능* 1개를 고른다. F/STAFF-ID, TF-ID, C/N-ID, 기존 코드, 새 API/DB, actor, 측정 가능한 수용 조건, 예상 변경 파일, 불필요한 변경을 적는다.
3. **실행 전 충돌 검사:** C09/C10 문서 딥링크, G1 revision CAS, 011/012 migrations, 다른 열린 PR #25/#27/#28/#30의 변경 파일과 중복·의존성을 비교. SQL 번호를 이름만 보고 자동 증가시키지 말고 main/병합 대상 브랜치 트리 조회.
4. **상태·권한 먼저:** `current`/`mock`/`target`/`verified`를 엄격히 구분. 프로젝트 소유자·editor·viewer·outsider, old/new session, contract active/stale/expired, 견적/예산/동의, 취소·실패를 화면/백엔드 각각 정의.
5. **실제 구현:** 별도 기능 브랜치에 기존 컴포넌트 재사용. Mock을 실제 생성·채용·실행·결제라고 표현 금지. `owner/editor` 사람 계획 초안만, owner가 계약/예산·외부전송·최종 승인/결과 수락. AI worker가 자기 승인 금지.
6. **테스트를 코드와 함께 작성:** 최소 build + lint + 변경 함수 unit + 같은 프로젝트/타 프로젝트 JWT/RLS + 실제 Chromium 로그인/뒤로가기/새로고침/입력 손실/중복/403·404/409. 서버 근거 없이 fake PASS 표기 금지.
7. **불일치 자체 수정:** 필드/상태/권한/URL과 기능정의서가 다르면 수정을 하나 선택해 근거와 테스트를 남기고 기능/화면/QA 계약 모두 연결. 승인 미정인 요금·법률/기밀·모델/운영 공개는 UNDECIDED로 보류하고 무과금/합성 대체로 진행.
8. **GitHub 기록:** SHA, 변경 파일, CI URL, 실제 PASS/FAIL/NOT RUN, 접근권한 회귀, 정본과의 차이, 다음 작업 1개, 재현 가능한 작업 단계. 문서만 작성했으면 `DOCS DONE`이지 `FEATURE DONE` 아님.
9. **다음 단위 자동 선택:** 같은 Issue의 미완 수용 기준을 먼저 보고, P0가 없으면 새 화면/기능 코드로 즉시 이동. 문서 감사/계획서 리라이팅 무한 반복 금지. main 병합/hosted SQL/유료 공급자/실배포는 별도 승인 전 실행 금지.

## 3. 개발 순서: 빠른 실제 사용자 가치와 독립성

| 패키지 | 착수 조건·최소 변경 | 완료 실증 | 연관 ID |
|---|---|---|---|
| **G1 통합 릴리스 준비** | PR #30 이후 `UPSERT` 최초 생성 경합 수정 및 G1 CI 확인. **DB schema rollout과 웹 자동 배포 순서를 별도 검토**. PR #30은 2026-10-22 현재 HEAD `d9e34e9`, main 미병합. | 같은 문서 2창 경쟁 시 덮어쓰기 0, Auth/JWT+CAS/복원+브라우저 회귀, 배포 호환성·롤백 승인 | F-003/004, C09/10, #29 |
| **DEV-01 사람 PM 계획 서버 초안** | PR #27 F401 임시 화면 + main S1 실코드 재사용. 로컬 합성 fixture/격리 DB부터. 신규 계획/step/event DB와 owner/editor 스코프. **기존 인력 채용 API 테이블이 있다고 가정 금지**. | draft 저장/재접속, 기대 version 충돌, editor 초안 허용/owner 승인 권한 분리, viewer·외부인 읽기/쓰기 방어 | F-401, N08, N09, TF-13~14, #32 |
| **DEV-02 최종 승인·S1 업무 연결** | 서버 `owner` 최종 승인 + 한 승인 버전 기준 S1 업무 1건 생성. 승인 전 실행 및 결제 0. 메모리 Mock 이벤트를 운영 승인으로 전환 금지. | `pending_owner_approval→approved/rejected/needs_revision`, idem 요청 중복 업무 0, 서버 audit/reload 복구 PASS | F-402/F-101~105, N03/04/08/09/12, TF-14~18, #32 |
| **DEV-03 문서 간 검수 한 건** | S2 문서 2개 이상/원본 revision·digest manifest 고정. 합성 보고서와 실모델 보고서 출처 분리; 유료 외부 모델 전송/사용 고객자료는 별도 법무·공급자/예산 승인까지 금지. | mock reporting/validation+owner 수락·재작업/반려 영속, 제출한 근거의 doc ID·digest/locator + 책임자 | F-201/202/F-501~603, N05/11/12/30, TF-16~24 |
| **DEV-04 직원 채용 UX** | PR #25 S3 Mock, N16/24→N17/25→N19/26/27/20→N28 직원 경력 목적별 동의. `/agents` 후보/실제 라우트 하나로 고정. | 최소 1개 실제로 지원 가능한 역할, 계약 초안 vs 최종 채용 구분, 명시 owner 프로젝트만 선택, 공개·적립 OFF 재현 | STAFF-02/03/06/08/11, STAFF-API-01~15, TF-07~12/31~36 |
| **DEV-05 유료 PM 단·복수 프로젝트와 경력** | 실제 worker/lease/outbox/idempotency/계약·공급자·모델 전송·비용 증빙 승인 후. 첫 1개 프로젝트를 완주한 뒤 A/B 2개 프로젝트로 확장; 미선택 C 금지. | 지속 상태·가격/비용 + 위임/결과 수락, C 접근 0; 경력 일수는 검증 이벤트만·철회 후 재산정. 가짜 성공률 없음 | STAFF-04/05/07/09/10, N29~32 |

**첫 제품적 증명:** PM이 프로젝트 브리핑 → 실제 제안 → owner 승인 → 전문 업무 1건 수행/검수 → 근거와 함께 owner 수락까지 연결되는가. **첫 사업적 증명:** 그 운영력이 기본 AI 대비 고객 시간을 줄이고 다시 구매할 만큼 유용한가. 단발 기획 검수는 첫 유료 상품 후보이지 인력사무소 전체 비전의 대체가 아니다.

**기존 기본 기획 주의:** `main src/lib/documentTypes.ts`의 실제 파이프라인 문서 타입은 **6종**(`prd,ia,screen_list,policy,wireframe,cursor_prompt`), UI 표시는 `screen_list`를 숨긴 **5종**. 따라서 5종/6종 수는 기준을 밝혀 사용. `src/lib/api/generation.ts`는 `placeholderContent.ts` 템플릿을 호출하는 상태다. 실제 AI 생성/프롬프트 품질을 검증한 기능으로 표시하거나 유료 실공급자 호출을 수행하지 않는다.

## 4. 기능 개발 시 1페이지 이행 계약(복사 가능한 형식)

```text
[Slice] 이름 / Issue / 작업 브랜치 / base/head SHA
CURRENT: main에 이미 있는 파일·API·migration / 기존 Mock PR / 실제 DB 적용 상태(미확인 포함)
SPEC: F- / STAFF- / TF- / C|N- / 정책 / API / DATAUTH / T-QA
사용자 가치: 시작 사건 → 클릭/입력 → 서버 사건 → 사용자 눈에 보이는 결과
역할: owner/editor/viewer/outsider/AI worker
상태: draft, pending approval, approved, run, artifact accepted — 리소스별 별도 enum
권한·비용: 데이터 원본/모델 전송/실금액/승인·회수/중간 실패
수용: Given/When/Then 성공·권한·충돌·중복·재시도·새로고침·타 프로젝트
변경: app route/component/store/API/DDL/SQL/test/docs
비변경: 운영 DB/main/실배포/유료 공급자
검증: 명령/실행 환경/SHA/CI URL/PASS|FAIL|NOT RUN
결과: 남은 P0·P1/제품 미결정/실제 다음 개발 1건
```

## 5. UI 단위 필수 검수 계약

각 화면은 **고유 ID** 및 연결 F/TF/테스트 1개 이상을 가진다. 최소 `entry/permission, source+revision, primaryCTA, alternateCTA, field validation, loading/empty/error/403/404/409, cancellation/retry, success destination, audit event, keyboard/focus/mobile` 11요소를 확인한다. 구현 전 고정 못 한 요소는 다음 막대/대응표에 **미결정**으로 추적하되 Mock 구현 자체를 멈추지 않는다.

**가장 중요한 중복 방어:**
- `C09/C10`은 기존 DocumentPage; N01 허브가 프로젝트 문서 URL을 차지하지 않는다.
- `N03`은 main `/projects/:projectId/tasks`를 먼저 재사용; N08은 PR #27 `/projects/:projectId/plans/new`의 F401 사람 작성 Mock을 점진 확장. 별도 N08 AI 계획 자동실행은 고객 데이터·비용 승인 뒤.
- `N16+N24` 하나의 직원 목록, `N17+N25` 하나의 프로필, `N19/20+N26/27` 하나의 채용 플로우; N28 공개/경력 동의는 별도 데이터 이벤트.
- 고객 실행상태, 승인상태, 산출물 수락상태, 계약상태, PM 배정상태는 **서로 다른 필드**. 같은 `status` 하나로 병합 금지.
- 실제 DB에서는 외래키/role/버전·idempotency와 민감정보 축소를 서버측에서 강제. 브라우저 버튼 숨김 = 권한 검증 아님.

## 6. PR/배포 운영 게이트 및 사람 판단이 필요한 항목

- 기능 PR은 1 vertical slice/1 검증 범위로 쪼갠다. CI green만으로 사용자 의도·보안·운영 DB 호환성을 자동 증명하지 않는다.
- PR #30과 #25/#27의 `src/App.tsx`, `ProjectTasksPage.tsx`, DB migration 파일 중복을 재검토하여 자동 합치기 금지. #30은 #15~24 계열을 선별 대체; 구 PR 모두 순차 병합 금지.
- **schema expand-first**: 현재 hosted DB read-only 확인/백업/forward-fix 계획 → 앱 최신/구버전 호출 혼재 대응 → DB 변경/배포 승인. main 자동 배포 정책을 반드시 읽어 안전한 릴리스 순서를 결정한다.
- 미승인 가격/원가, 공급자 모델, 개인정보 공개권·해외전송, AI 자동 스케줄, 경력 등급/수익배분, production rollout은 UNDECIDED로 보존. Cursor는 Mock/fixture/정적 계약·실 DB 격리 테스트까지는 수행 가능하나 위 결정을 대리 확정하지 않는다.
- **매 차수 종료 질문:** ‘기능이 실제 고객 행동으로 작동했나? 아니면 문서/Mock/단위검사만 늘었나?’ PASS 없이 체크박스 업데이트 금지.

## 7. 바로 다음 실행 지시

1. **G1 진행 중인 변경 덮어쓰지 말 것.** 해당 Cursor 결과가 repo에 push됐는지 확인하고 PR #30 위험 0으로 판정 후 병합·데이터 적용 순서를 제시.
2. 병행 신규 기능의 첫 커밋은 [Issue #32](https://github.com/happysuyeun-rgb/plan_os/issues/32) **DEV-01**: 프로젝트 계획 초안 실제 서버 저장·편집권한·reload, 곧이어 DEV-02 owner 승인·S1 연결. **다른 감사/전략 문서만 만들고 종료 금지**.
3. V4 교차감사에서 아직 OPEN인 항목 중 해당 슬라이스를 차단하는 것만 최소한으로 해결하고, 완료 결과에 반드시 코드 SHA와 실제 CI URL을 남긴다.

**실행 상태:** 이 문서는 Cursor 지시를 위해 작성된 전략. DEV-01~05의 코드 개발 및 운영 반영 완료가 아니다.
