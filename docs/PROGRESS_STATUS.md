# PlanOS 3.0 — 전체 개발 진행 현황

**최초 작성일:** 2026-10-14  
**최종 수정일:** 2026-10-25  
**문서 버전:** v4.9  
**진행 상태:** 운영 중인 관리 문서 (개발 완료를 의미하지 않음)

### 2026-10-25 PR 통합 완료 (#43·#44·#45·#46)

| PR | 고유성 | 처리 |
|---|---|---|
| **#46** | Mock MVP 스키마·무과금 UX·local server-store CI | **main 병합 완료** (`ec3ab6b`, 2026-10-25) |
| **#45** | BCD 기능·로컬 027·Playwright E2E 정본 | **main 병합 완료** (`f780691`, 2026-10-25) |
| **#44** | #45에 코드/테스트 완전 포함 | **CLOSED** (중복) |
| **#43** | ops RO·Preview 문서 + DEPLOYMENT V1.1 | 고유 문서 #45에 이식 후 **CLOSED** |

> 기준: GitHub에서 실제 확인한 커밋·PR·Issue만 완료 근거로 인정. 아래 **2026-10-25 정본 스냅샷**이 현시점 우선. 그 이하 역사 섹션은 보존용이며 당시 표현을 덮어쓰지 않는다.

## 2026-10-25 정본 스냅샷 (GitHub 실측 · 최우선)

### 상태 레이어 (혼동 금지)

| 레이어 | 상태 | 증거 |
|---|---|---|
| **GitHub main 병합** | Phase A + BCD Mock MVP **완료** | main tip **`ec3ab6b`** · #30/#36/#42/#45/#46 merged |
| **코드 완료** | Phase B·C·D **Mock이 main에 포함** | `/ai-review`, S1 상세, Vite/Preview AI BFF, local_only 027 |
| **단위·RLS CI** | #46 병합 시 체크 통과 (local server-store E2E 포함) | Preview/ops DB에 027 **미적용** |
| **로컬 Playwright E2E** | **일회용 스택에서 통과** | `tests/e2e/browser_ai_review.mjs` · `ai-review-local-e2e.yml` |
| **Preview 검증** | **미완료** · 027 Preview는 **승인 게이트** | [`PREVIEW_027_APPLY_RUNBOOK_2026-10-25.md`](./plans/PREVIEW_027_APPLY_RUNBOOK_2026-10-25.md) |
| **운영 DB 스키마** | Phase A V1.1 통합 **적용됨** · 추가 mig/027 **금지** | 009/010≡013/014 (파일명) |
| **Production 출시** | **미완료** | 배포 승인 없음 |

### Phase 요약

| Phase | 코드 | 테스트 | Preview | 운영 DB | Production |
|---|---|---|---|---|---|
| **A** G1·PM·C04 | main 병합 완료 | CI 통과 | Preview 가이드 있음 | V1.1 스키마 (추가 mig 금지) | 미배포 |
| **B** S1 상세·권한 | **main 포함** (#45) | 단위·S1·RLS·로컬 Playwright | 통합 Preview E2E 미완료 | 011 등 기존 | 미배포 |
| **C** LLM | Provider·BFF·budget (유료 차단) | 단위·BFF placeholder | 유료 미연결 | n/a | 미배포 |
| **D** 기획 검수 | **Mock MVP main** (#46) · 027 `local_only` | 단위·로컬 RLS·Playwright | Preview 전수 미증빙 | 027 **호스티드 미적용** | 미배포 |
| **E/F** AI PM·출시 | 미구현 | — | — | — | 미완료 |

### 브랜치 계보

- **#46** MERGED → `main` @ `ec3ab6b`. **이후 모든 신규 브랜치는 이 tip에서만 분기.**
- **#45** MERGED → `f780691` (BCD 기반). **#43/#44** CLOSED.

### 남은 P0/P1 (2026-10-25)

- **P0:** Preview 호스티드 E2E 전수 · 운영 009/010≡013/014 **읽기 전용** 확인
- **P1:** **(명시 승인 후)** Gate A-027 Preview 적용 — 런북 [`PREVIEW_027_APPLY_RUNBOOK_2026-10-25.md`](./plans/PREVIEW_027_APPLY_RUNBOOK_2026-10-25.md) · 실 LLM · AI PM(E)
- **P2:** 인력사무소 · 서버 스토어 프로덕션 경로

## 2026-10-19 최신 검수 스냅샷 (역사 보존 · 위 정본보다 우선하지 않음)

**문서 기준 브랜치:** [docs/planos-v3-readiness-20261014](https://github.com/happysuyeun-rgb/plan_os/tree/docs/planos-v3-readiness-20261014/docs) / [Draft PR #1](https://github.com/happysuyeun-rgb/plan_os/pull/1). 코드 격리 검증 [Draft PR #18](https://github.com/happysuyeun-rgb/plan_os/pull/18) ([Baseline](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38992737372), [Chromium](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38992737370))은 **main 미병합·운영 DB 변경/배포 없음**. 아래 10/16 '최신', '다음 작업' 표현은 작성 당시 기록으로 보존되며 이번 항목이 현시점 우선 판정이다.

### Phase 1 P1-1 — 첫 전문 AI 업무 설계 및 누락 검수
- [x] **설계 문서 작업 완료:** [FIRST_SPECIALIST_AI_MVP_2026-10-19.md](product/FIRST_SPECIALIST_AI_MVP_2026-10-19.md) 후보 3개 비교, 1순위 '기획 검수 AI', 실제 기존 DocumentType 6종 확인, R0 동일 프로젝트 문서 읽기 + R1 비공개 보고서 초안 작성, PM/전문 AI/검증기/owner 역할 분리, 12개 설계 테스트(AC-01~12), FR/TF/화면/API/DB 1차 연결.
- [x] **누락 분석 기록:** 서버의 추가 GET/승인 이벤트·자료 버전·비용/정산, 의미 품질 오탐/근거 허위·인젝션·비인가 접근·중복/재실행·브라우저 종료/워커 재시작, 문서 변경 충돌·RLS·데이터 보존을 설계안의 미검증 항목으로 식별.
- [ ] **제품 D-01 최종 확정:** 첫 전문 AI 역할/범위 및 사람 수락 기준 사용자 승인·실제 사용자 평가 전. 제안 문서를 'AI 기능 완성' 또는 'Phase 1 완료'로 표시 금지.
- [ ] **기획 잔여:** P1-2 승인·계약·예산·무료/환불·데이터 보존, P1-3 UX 와이어플로, P1-4 영속 큐/워커·ModelGateway 기술 ADR, P1-5 API/SQL, P1-6 Threat Model/QA/Runbook, P1-7 교차 감사.
- [ ] **기술 격리 남은 P0:** B-04 브라우저 종료 초안 회복, C-07 프로젝트 전환/첨부, 멀티클라이언트 PATCH, 직접 채팅 INSERT/RLS, 팀/댓글/알림/휴지통/재생성 회귀, 운영 검증/승인. Phase 0 전체 종료 아님.
- **문서 수용 상태:** 설계안 작성과 링크 검증만 가능, 12개 AC의 실제 자동화 실행 0건. 메인 병합·배포·유료 모델 호출 0건. 회사 최상위 오늘 P0는 크몽 판매면 출고 승인 대기이며, PlanOS 설계는 별도 프로젝트의 요청에 따른 문서 작업이다.

### 2026-10-19 P1-1 재감사 + P1-2 정책 설계 스냅샷 (금일 최신)
- [x] **교차 감사 문서:** [AUD-01~12](quality/PHASE1_CROSS_AUDIT_2026-10-19.md)에서 **계약/PM 모델 비용 생성 선후관계**, 자동 근거 검증 vs 인간 수락, 공급자 실비 vs 고객 청구·환불, R0 tool vs R1 artifact 서비스 권한, 문서 snapshot, Phase 3 내부 계약 vs Phase 5 고객 UI, owner/editor 권한, API/원가/보존을 대조.
- [x] **관련 문서 정합성 보완:** [첫 전문 AI 설계](product/FIRST_SPECIALIST_AI_MVP_2026-10-19.md), PRD, TF, SCREEN_SPEC, PERMISSIONS_POLICY, ARCHITECTURE, DATA_MODEL, API_CONTRACTS의 미리보기→owner 계약/데이터/PM 비용 동의→유료 AI PM 계획 job→owner 계획 승인→전문 AI 실행→서버 검사→사람 수락 순서와 R0 읽기/R1 새 보고서 범위 일치. **문서 수준 검토 완료**.
- [x] **P1-2 정책 초안:** [MVP 계약·승인·비용 정책](product/MVP_CONTRACT_APPROVAL_COST_POLICY_2026-10-19.md) 작성. 예산 예약/공급자 실제 원가/고객 요금·환불을 구별하고 실패·취소·동시 실행·데이터 처리/보존·owner 승인/해지 규칙과 **POL-01~12 테스트 시나리오**를 정의. 실제 구현/테스트 0건.
- [ ] **P1-1 최종 결정:** 기획 검수 AI D-01 owner/제품 승인, fixture 정확도 및 실제 사용자 검증.
- [ ] **P1-2 최종 정책:** DEC-01~08, 공급자 약관, 원가/상한 금액, 구독·무료·환불·보존·법률/상용처리 확정. **문서 초안 ≠ 승인/실행 검증 완료**.
- [ ] **후속 P1-3/4/5/6/7:** UX_FLOWS, worker/queue/ModelGateway ADR, 승인 요청 생성/비동기 계획 GET/원장 API+SQL, 위협 모델/실행 QA/운영 런북, 전수 추적·승인. Phase 0의 B-04/C-07/동시성/RLS 및 Phase 2 구현은 여전히 별개 미완료.
- **브랜치:** [docs/planos-v3-readiness-20261014](https://github.com/happysuyeun-rgb/plan_os/tree/docs/planos-v3-readiness-20261014/docs) / [Draft PR #1](https://github.com/happysuyeun-rgb/plan_os/pull/1) OPEN; main 병합/운영 DB·배포/유료 API 호출 없음.

### 2026-10-20 Phase 1 P1-3 UX 문서 진행 (최신)
- [x] **P1-3A UX 설계 초안:** [UX_FLOWS.md](ux/UX_FLOWS.md) — 첫 AI 감사 업무에 대해 C05/N01/N05/N17/N19/N20/N08/N09/N11/N12/N03/N14 동선, 계약과 유료 계획 생성 선후, 승인/수락 중복 방지, 네트워크·권한·비용·stale 예외 및 UX-01~12 시나리오 설계.
- [x] **누락 점검:** 기존 문서 딥링크 유지, 보고서 사람 수락 위치 N11 단일화, N09/N12 계획 승인 동일 이벤트, Phase 3 내부 계약 vs Phase 5 고객용 화면, 모델 비용/데이터 동의 이전 실행 금지 반영.
- [ ] **P1-3B 최종 검증:** 와이어프레임 시안·모바일/키보드/스크린리더 실제 테스트, API/SQL 화면 동작 연결, 정책·사용자 최종 승인 및 UX-01~12 실제 실행 미완료.
- [ ] **다음:** P1-4 영속 worker/queue/ModelGateway/원가 사용량 ADR, P1-5 서버 API/DB, P1-6 QA/보안/출시. Phase 0 안전성 문제와 main/운영 승인 미완료.

### 2026-10-20 Phase 1 P1-3 재감사 + P1-4 아키텍처 초안 (최신)
- [x] **P1-3 UX 누락 재감사:** [UXA-01~10](quality/PHASE1_UX_ARCH_AUDIT_2026-10-20.md) 발견/조치·미해결 검증 기록. UI 실패→재실행은 무제한 자동 재시도가 아니라 서버 원가·상태 대사와 owner 승인 후 제한 실행. N05 임시 선택·PM 비용/계약·N09/N12 동일 승인/N11 단일 수락·브라우저 복귀/권한 캐시 점검.
- [x] **P1-4A 상세 구조 설계 초안:** [AI_EXECUTION_ADR_002](engineering/AI_EXECUTION_ADR_002_2026-10-20.md)에 BFF/Auth Policy, 영속 run+budget reservation+outbox, 단일 lease worker, 공급자 어댑터 ModelGateway, R0 문서 read/R1 검증 산출물 write, 감사·비용 원장/재시도/장애 복구와 격리 PoC 검증 게이트 작성.
- [ ] **P1-4B 기술 확정/검증:** 실제 worker 호스트·queue 서비스·모델/provider 데이터 처리/가격·PM plan job 스키마·예산 트랜잭션 선택/승인, 격리 worker crash/중복/예산/RLS 테스트 미실행.
- [ ] **P1-3B:** 실제 UI 와이어프레임·모바일/접근성·API 연계/실사용 검증. Phase 0/1 전체 종료, main·운영 DB·배포 미실행.
- **다음:** P1-5 상세 OpenAPI/SQL·RLS/승인/원가 상태 계약, P1-6 위협모델/QA/릴리스 런북, P1-7 정합성 재검수.

### 2026-10-20 Phase 1 P1-5 API·DB 상세 설계 (최신)
- [x] **P1-5A 문서 초안:** [AI_API_DB_CONTRACT_P1_5](engineering/AI_API_DB_CONTRACT_P1_5_2026-10-20.md) 작성. 기존 API의 계약/계획/승인·실행 이벤트/산출물 수락 조회·원가 관리 누락에 대해 P5-01~16 제안 URL/권한·응답/오류와 DB 무결성/상태/트랜잭션·P5T-01~12 테스트 **명세** 정리.
- [x] **문서 누락 검수:** 계약 없는 AI PM 모델 과금 차단, owner 승인, server-issued approval, run/예약/outbox 원자성, provider 비용 pending, tenant FK/비공개 R1 artifact, 인간 수락과 자동 검증/정산 분리.
- [ ] **P1-5B 구현/검증/최종 승인:** OpenAPI 기계 스키마/실제 DDL·RLS/worker·API 테스트, 모델 공급자 비용/데이터 정책 미확정. P5T 12건 실제 테스트 0건.
- [ ] **다음 P1-6:** 위협모델·QA 계획·운영 출시/롤백 런북. P1-7 전체 추적 감사. Phase 0 미완·main/운영 DB/배포 미수행.

### 2026-10-20 P1-5 재감사 + P1-6 보안·QA·운영 문서 (최신)
- [x] **P1-5 재감사:** [P5A-01~13](quality/PHASE1_P5_REAUDIT_2026-10-20.md). 최초 생성 vs 기존 리소스 If-Match 요구 충돌, 서버 전용 승인 생성 라우트 노출, 중복 예산 차감, PM 생성 run 구조, project composite FK·R1 Storage partial write·공급자 재호출/비용 등 13건 기록. [P1-5 명세](engineering/AI_API_DB_CONTRACT_P1_5_2026-10-20.md)에 중요한 규칙 보정.
- [x] **P1-6A 설계 산출물:** [위협 모델](quality/THREAT_MODEL_2026-10-20.md)(TM-01~12), [QA 계획](quality/TEST_PLAN_2026-10-20.md)(QA-A~I), [런북](operations/RELEASE_RUNBOOK_2026-10-20.md)(릴리스 차단·feature flag/worker pause·rollback/backup·복구 조건) 작성.
- [ ] **P1-5B/P1-6B 실제 검증:** 구현된 SQL/RLS·OpenAPI/worker·예산 원장, 4역할/재시도/비용/데이터 손실 CI/E2E/보안 재현, backup/restore 리허설·운영 승인 **미완료**. 위 문서 작성으로 P1/Phase 0 종료 불가.
- [ ] **P1-7:** FR/TF↔화면↔API↔DB↔QA/보안 전수 추적·설계 정책 미결정/누락 정리, 최종 승인 게이트.
- **안전:** 문서 Draft PR #1, main/운영 DB/배포/유료 모델 실행 미실행.

## 전체 로드맵
| 단계 | 진행 상태 | 완료한 것 | 미완료·다음 확인 |
|---|---|---|---|
| 0. 기술 기준선 | **진행 중** | 저장소 212개 항목 목록 확인, SQL 8개 정적 감사, CI 실행·실패 원인 확인, 린트 부분 수정 PR #8 | CI 성공 증빙 확보, 남은 lint 경고 1건·운영 DB 적용 상태, RLS 재현/개선, PR #9 브라우저 회귀 검증 |
| 1. 기획·아키텍처 | **초안·교차 감사 진행 / 확정 미완** | 기존 8개 초안 + 첫 전문 AI 역할 설계안 + P1-2 계약·비용 정책안 + AUD-01~12 감사 및 교차 문서 보정 | D-01/DEC-01~08 승인, 공급자·비용, UX/Worker/API/SQL, Threat Model/QA/출시 등 실제 검증 |
| 2. 프로젝트·업무 기반 | **미착수** | 없음 | 업무 상태/CRUD/워크스페이스/호환성 |
| 3. 통제된 AI 실행 | **미착수** | 없음 | 서버 모델, 큐/워커, 승인, 예산, 복구 |
| 4. AI PM 통합 | **미착수** | 없음 | 계획→위임→실행→검증→브리핑 |
| 5. AI 인력사무소 MVP | **미착수** | 없음 | 프로필·추천·면담·계약·킥오프 |
| 6. 협업·운영 안정화 | **미착수** | 없음 | 승인함·알림·취소·보안·회귀 |
| 7. 제한 파일럿 | **미착수** | 없음 | 사용자 검증·원가·장애 대응 |

## 2026-10-16 Phase 0 — B-05 버전 저장·복원 실제 브라우저 검증 (최신)
- **실제 Chromium + 일회용 Supabase:** [GitHub Actions #38869950232](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38869950232) **SUCCESS** (source SHA `9f5ff4965490f0ac43b902b9a1a1234e59391ad0`). 같은 SHA [Baseline #38869950358](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38869950358) TS/build/lint/17 unit PASS.
- **정상 흐름 B-05:** v1('B05-old') 저장 → 새 본문/명시적 v2('B05-current') 저장 → v1 읽기전용 미리보기 → v1 복원해서 v3('복원') 생성 → 브라우저 리로드/로컬 PostgREST `document_versions`의 v1/v2/v3 콘텐츠(old,new,old)·`documents.content` 확인. 원래 v1/v2 역사 불변.
- **커버리지:** B-01·B-02·B-05 정상 복원·C-01 = **22 B/C 중 4개 브라우저 정상 경로 확인**, **18개 미실행**. **B-05 실패 시 복구·미저장 최신 입력 보존·동시성은 별도 미검증**, 따라서 B-05 전체 안전성 완료라고 판단 불가.
- **추가 P0 이슈 [#16](https://github.com/happysuyeun-rgb/plan_os/issues/16):** 버전 복원은 클라이언트에서 version INSERT→documents UPDATE 2건을 순차 실행해 중간 오류/중복 재시도에 원자성 없음(코드상 위험). 사용자 안내 `현재 버전은 보존`은 명시적으로 저장하지 않은 최신 초안에도 보장되는지 미확인. 서버 트랜잭션/잠금/멱등성, 실패 주입 E2E 필요.
- **다음:** 복원 실패 및 unsnapshotted draft 테스트(B-05 미완 구간) → C-03 채팅 중 탭·프로젝트 이동 → B-03/B-04 오프라인 저장 실패 → 사용자 역할별 팀/댓글/알림/휴지통 회귀. **운영 DB migrations 001~008 유지**, 009/010 미적용; Draft·미병합·미배포.
- **근거:** [통합 QA v1.4](https://github.com/happysuyeun-rgb/plan_os/blob/test/planos-phase0-integrated-20261016/docs/qa/PHASE0_INTEGRATED_QA_2026-10-16.md).

## 2026-10-16 Phase 0 누락 점검·브라우저 회귀 추가 (현재 최우선)
- **실제 격리 Chromium 사용자 회귀 3건 PASS:** [Actions #38867219334](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867219334) (commit `e933ea9647bd169ec675c1c6ad9061343f14a901`), B-01 PRD→기능명세서 빠른 전환/각각 저장, B-02 5회 연속 편집/마지막 내용 유지, C-01 미저장 초안+채팅 병합 및 리로드. **일회용 PostgREST 저장 데이터까지 대조**했다.
- **새 누락 발견·코드 보완:** [PR #11](https://github.com/happysuyeun-rgb/plan_os/pull/11)에서 `DocumentPage` 댓글 스레드 effect의 `activeDoc` 객체 의존으로 문서 입력마다 GET 반복되는 문제를 **documentId 의존**으로 교체. `commentStore.fetchThreads`는 요청 순서/프로젝트 reset을 가드하여 늦은 이전 문서 응답이 현재 댓글 목록을 덮지 않도록 했다.
- **실증:** 수정된 [PR #11 CI #38867723560](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867723560) 및 [통합 Baseline #38867796471](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867796471) **TS/build/lint/17 unit PASS**. [통합 Chromium #38867796404](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867796404) **SUCCESS**: B-01·B-02·C-01 재통과 및 5회 문서 입력 중 comment GET **0건**.
- **QA 최신화:** [문서 회귀 v1.3](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-chat-document-write-20261016/docs/qa/DOCUMENT_SAVE_REGRESSION.md)의 과거 `INACTIVE` 표기를 `ACTIVE_HEALTHY`로 정정, B/C 실행 여부 분리. [통합 QA 누락 점검 v1.2](https://github.com/happysuyeun-rgb/plan_os/blob/test/planos-phase0-integrated-20261016/docs/qa/PHASE0_INTEGRATED_QA_2026-10-16.md)에 판정·증빙·차단 목록 작성.
- **여전히 미검증:** **B-03~12(10개)·C-02~10(9개)** 브라우저, 버전 과거 조회/복원, 느린 API·저장 실패/재시도, AI 재생성, 동시 프로젝트 변경, 임시 초대 이메일/역할변경/휴지통, 실제 댓글/알림 화면. **채팅 메시지와 문서 쓰기의 원자성/멱등성, 프로젝트 soft-delete 멤버 권한, 과거 버전 동시성은 미해결**. 코드 순서 보호만으로 해당 경합 전체가 실증된 것은 아님.
- **다음 P0:** B-05 버전 복원, C-03 채팅 중 문서 이동, B-03 느린 저장/프로젝트 이동의 Chromium 재현을 차례로 진행. 전체 Phase 0 잔여 5~10 작업일/전체 43~79 작업일은 보수적으로 유지.
- **영향 범위:** 모든 PR Draft/미병합. Plan OS 운영 Supabase migrations 001~008 유지, 009/010 미적용, `main`·배포·유료 인프라 변경 없음.

## 2026-10-16 Phase 0 — 테스트 전용 통합 브랜치 및 실제 브라우저 스모크 (최신)
- **Draft [PR #15](https://github.com/happysuyeun-rgb/plan_os/pull/15)** / `test/planos-phase0-integrated-20261016`: 앱 PR #8→#9→#11과 RLS PR #13→#14를 두 부모를 가진 통합 커밋 `992bb60c8f458f4f813a52747d40463f83674d22`으로 연결. 보안 계열의 신규 13개 파일만 앱 기준 트리에 추가해 앱 소스와 충돌 없이 통합. **main/기존 Draft PR은 미병합**.
- **앱 자동 테스트:** [Baseline #38855752421](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38855752421) 성공 — npm ci, TS/빌드, lint, 17개 unit 테스트.
- **SQL 재현:** [RLS PostgreSQL #38855752463](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38855752463) 성공 — 기존 42P17 재현, 009 적용 뒤 owner/editor/viewer/pending/outsider/anon 격리.
- **실제 JWT·REST:** [RLS Auth/PostgREST #38855748722](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38855748722) 성공 — 일회용 로컬 Supabase migrations 001~010, 실제 GoTrue 로그인/토큰으로 댓글·알림·문서 버전 권한 검사. 이 실행은 *워크플로 전용 마지막 변경 전 커밋*에 해당하며 앱/SQL 소스는 동일.
- **실제 Chromium 화면:** [Browser Smoke #38856198235](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38856198235) 성공 — 임시 계정 로그인 → 허가된 대시보드 프로젝트 조회 → PRD 문서 열기 → 전체 새로고침 후 문서 표시. 운영 Supabase 접근/배포 없음.
- **상태:** [통합 QA 보고서 v1.1](https://github.com/happysuyeun-rgb/plan_os/blob/test/planos-phase0-integrated-20261016/docs/qa/PHASE0_INTEGRATED_QA_2026-10-16.md) 작성. **브라우저 자동저장·버전 복원·채팅 충돌·댓글·초대·알림·휴지통 등 전체 회귀는 아직 미실행**. 메신저/문서 저장의 원자성·잔여 보안 정합성도 미완료.
- **다음:** 브라우저 B-01~12/C-01~10, 팀/댓글/알림/버전/휴지통 수동·자동 회귀 → 충돌/원자성 보완 → Phase 0 승인 게이트. 잔여 추정 5~10 작업일 유지. 모든 PR Draft/미병합·운영 DB 009/010 미적용.

## 2026-10-16 Phase 0 — 댓글·반응·알림·문서 버전 RLS 보완 (최신)
- **별도 [Draft PR #14](https://github.com/happysuyeun-rgb/plan_os/pull/14)** (기반 PR #13)에서 migration `010_harden_comments_notifications_versions.sql` 작성. 댓글 필드 보호 트리거, 본인 반응/참여 행 UPDATE·DELETE 제한, 유효 프로젝트 수신자 알림만 발송, 알림 `read_at` 이외 수정 차단, 과거 문서 버전 UPDATE 차단, soft-delete 댓글 빈 본문 CHECK 불일치 보완. 실제 운영 DB **미적용**.
- **실제 격리 CI 완료:** [Actions #38854258418](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38854258418) **SUCCESS**, migration 001~010을 일회용 로컬 Supabase Auth/JWT/REST에 적용하고 댓글·반응·참여·알림·버전의 **12개 테스트 시나리오(CSEC-01~12) 허용/거부 검증 통과**. CI 검증 소스 SHA `f2dc298484fbf8c7fda9373a9b0ef46e2c5b5c7f`.
- **중간 실패 설명:** [CI #38854082810](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38854082810)은 발신자가 수신자 알림의 비공개 응답을 요구한 테스트 설계 오류(`return=representation`)로 실패. 실제 앱과 동일한 `return=minimal` 및 수신자 토큰으로 조회로 수정 후 최종 CI PASS.
- **[QA 검증 보고서 v1.1](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-rls-content-hardening-20261016/docs/qa/RLS_CONTENT_HARDENING_2026-10-16.md)**에 대상 테이블·기능 유지 범위·CI 증빙 및 추가 위협 기록.
- **잔여 보안:** actor_name/title/body 등 알림 payload 위조, 활동 기록의 타인 user_id 사칭, 댓글 document_id/parent_id 프로젝트 일치, 문서 버전 번호 동시성, soft-delete 시 active member 접근 규칙 등은 아직 미해결(추가 설계 필요).
- **남은 실제 QA:** 브라우저 댓글/초대/알림/버전·휴지통 회귀, PR #9/#11 저장/채팅 B-01~12/C-01~10, 메시지↔문서 저장 원자성, 운영 백업/롤백 승인. PR #13/#14는 Draft·미병합, hosted Supabase 009·010 **미적용**.

## 2026-10-16 Phase 0 — 실제 로컬 Supabase Auth/JWT/REST 통합 검증 PASS
- **최종 CI:** [Actions #38852999398](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38852999398) `success`, 코드 SHA `5ee72bf460e8dd398ac769e1a523e6874ca0b7c3`. 공식 `supabase/setup-cli@v3`+Supabase CLI `2.84.2`의 **일회용 로컬 GoTrue/Auth·Kong·PostgREST·PostgreSQL** 환경에서 migrations 001~009 적용, 실제 비밀번호 로그인/JWT 발급 및 REST 정책 검사 수행. 운영 Supabase를 변경하지 않음.
- **검증된 역할:** owner/editor/viewer는 소속 프로젝트만 조회, pending은 자기 초대 행만 조회하고 문서 거부, 타 프로젝트 owner/editor·outsider·anon은 무권한 데이터 불가. viewer 문서 PATCH 차단 및 원본 내용 유지 확인.
- **수정 이력:** 최초 [#38852770669](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38852770669) 실패는 테스트가 `projects.user_id`의 owner를 `project_members` 행 수에 중복 포함한 기대값 오류. 정정 후 최종 통과.
- **최신 근거:** [Draft PR #13](https://github.com/happysuyeun-rgb/plan_os/pull/13)와 [QA 보고서 v1.2](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-rls-member-recursion-20261016/docs/qa/RLS_LIVE_READONLY_2026-10-16.md).
- **여전히 미완료:** 실제 웹 브라우저 초대/역할 변경/삭제·복원, 기타 RLS(댓글·반응·알림·버전), PR #9/#11 브라우저 회귀·메시지/문서 원자성, 명시적 운영 배포 승인. `009` 실제 운영 DB에 **미적용**.
- **일정:** Phase 0 잔여 **5~10 작업일**, 전체 **43~79 작업일** 추정 유지(미확인 회귀·기술 의존성). 

## 2026-10-16 Phase 0 후속 실행: RLS 009 임시 PostgreSQL 17 실증 및 잔여 일정
- **[GitHub Actions #38849011220](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38849011220) SUCCESS:** GitHub 격리 PostgreSQL 17 서비스 컨테이너에 **실제 migrations 001~008** 적용, `project_members` 조회 재귀 실패 재현, proposed `009` 적용, owner/editor/viewer/pending/타 프로젝트 owner·member/외부인/anon 행 조회 격리 검사 통과. 데이터는 CI 임시 합성 데이터만 사용.
- **중요 보완:** [Draft PR #13](https://github.com/happysuyeun-rgb/plan_os/pull/13)의 `009`가 `auth.uid() = user_id OR can_access_project(project_id)`로 **초대 대기자의 자기 초대 행 조회**를 보존함. [QA 보고서 v1.1](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-rls-member-recursion-20261016/docs/qa/RLS_LIVE_READONLY_2026-10-16.md).
- **잔여 기간 재산정:** [실행계획 v1.5](roadmap/IMPLEMENTATION_PLAN.md)에 Phase 0 **5~10 작업일**(겹치는 세부 합계 약 5.5~12일), Phase 1 **3~6**, Phase 2~5 **25~43**, Phase 6~7 **10~20** → 전체 잔여 **43~79 작업일**, 1인 전담+AI 보조 가정. 주말/외부 승인/미확인 결함에 따라 연장 가능, 확정 일정 아님.
- **여전히 미완료:** 실제 Supabase Auth/JWT·PostgREST 사용자 역할 검증, soft-delete/초대/권한 변경·팀 UI 회귀, PR #9/#11 브라우저/채팅 원자성, 댓글·반응·알림·버전 RLS 보완, 테스트 결과에 따른 승인·병합. 운영 DB 009 미적용, `main` 미병합.
- **실제 환경 구분:** GitHub Actions의 임시 PostgreSQL CI는 **유료 Supabase 개발 브랜치가 아님**. 운영 데이터·접속 자격증명 사용하지 않음.

## Phase 0 Supabase 재활성화 이후 실제 DB 실측 — 최신 상태 (2026-10-16)
- **Plan OS 활성화 확인:** Supabase 프로젝트 `ggviusdmxalsflyybamm` **ACTIVE_HEALTHY**. 적용 이력 `001`~`008` 실제 조회 성공, public 기존 테이블 12개 모두 RLS enabled. 이전 `INACTIVE`/migration 조회 timeout은 **재활성화 이전 과거 기록**.
- **격리 환경:** Supabase 개발 브랜치 **0개**. 활성 DB에 쓰기/마이그레이션/테스트 fixture를 생성하지 않음.
- **실제 RLS 실패 재현:** `BEGIN READ ONLY; SET LOCAL ROLE authenticated; SELECT count(*) FROM public.project_members; ROLLBACK;` → **ERROR 42P17: infinite recursion detected in policy for relation "project_members"**. 마이그레이션 `006`의 `"멤버 조회"` SELECT 정책이 같은 `project_members`를 재조회하는 원인 확인.
- **권한 함수 실측:** `get_project_role`, `can_access_project`, `can_edit_project_content`은 postgres 소유 SECURITY DEFINER(소유자 BYPASSRLS); 존재하지 않는 프로젝트는 false/null 결과. 그 자체가 모든 역할별 RLS 안전성을 증명하지는 않음.
- **보안 점검:** Supabase Security Advisor에서 `set_updated_at` search_path, SECURITY DEFINER 함수 4개의 anon/authenticated EXECUTE, 유출 비밀번호 보호 비활성화 경고 확인. 댓글 UPDATE·반응/참여상태·알림의 넓은 정책 정의도 읽기 전용으로 확인했으나 데이터 행위 재현 전.
- **GitHub:** [P0 Issue #12](https://github.com/happysuyeun-rgb/plan_os/issues/12) + [Draft PR #13](https://github.com/happysuyeun-rgb/plan_os/pull/13), 신규 `009_fix_project_members_select_recursion.sql`로 **멤버 SELECT 정책만 좁게 수정하는 제안**. [실측 및 QA 보고서](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-rls-member-recursion-20261016/docs/qa/RLS_LIVE_READONLY_2026-10-16.md).
- **차단/다음:** 격리 개발 DB 또는 로컬 환경에서 migration 009를 적용하고 owner/editor/viewer/pending/outsider·프로젝트 복원·초대·팀 UI 회귀를 확인하기 전까지 **운영 DB에 적용 금지**. `main` 병합·배포 미실행.

## Phase 0 코드·환경 추가 점검 (2026-10-16)
- **Supabase 프로젝트 발견:** Plan OS 프로젝트의 상태는 `INACTIVE`; 개발 브랜치는 **0개**로 조회됨. `list_migrations`는 DB 연결 시간 초과로 실패해 실제 적용 이력 미확인. 운영 DB 재활성화/마이그레이션/브랜치 생성은 하지 않음.
- **문서 자동저장 위험 보완 브랜치:** [Draft PR #9](https://github.com/happysuyeun-rgb/plan_os/pull/9) (`fix/planos-document-autosave-safety-20261016`, 기반 PR #8): 2초 전역 저장 타이머를 문서별 스냅샷/순차 쓰기로 교체, 문서 전환 중 편집 버퍼 보존, 저장 오류 상태 및 단위 테스트 4개 추가.
- **검증:** [GitHub Actions #38844552645](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38844552645) **SUCCESS**; `npm ci`·TypeScript/build·lint·`npm run test:unit` 전부 통과. 로컬 Node 22 단위 테스트도 4/4 통과.
- **계속 차단:** 브라우저에서 문서 전환/이전 버전 복원·재생성·프로젝트 전환 중 동시 저장 회귀 미실행, 개발 DB RLS 미실행. PR #9는 Draft이며 PR #8 기반으로, **main 병합이나 배포 금지**.

## Phase 0 자동저장·복원 경합 검증 보완 (2026-10-16)
- **별도 수정 Draft PR:** [PR #9](https://github.com/happysuyeun-rgb/plan_os/pull/9)에서 문서 자동저장뿐 아니라 **명시적 버전 복원·단일 AI 재생성·연쇄 재생성**을 문서별 쓰기 대기열로 통합. 기존 편집을 보존하고, 복원/재생성 중 새 입력이 들어오면 이후 편집을 먼저 잃지 않도록 쓰기 순서를 예약함.
- **CI 실측:** 코드 커밋 `abf15fcb9331b6d8675c9cd95edeb1a9644caa03`의 [Actions #38845602357](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38845602357)에서 의존성 설치·TS/빌드·lint·**유닛테스트 11개 PASS**. 중간 실패 CI는 테스트 동기화/기대값 수정 후 재검증함.
- **QA 명세:** [문서 저장 회귀 체크리스트 B-01~12](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-document-autosave-safety-20261016/docs/qa/DOCUMENT_SAVE_REGRESSION.md)를 코드 PR 브랜치에 추가. 브라우저·격리 DB 실증은 **미실행**.
- **새 P0 발견:** `src/lib/api/chat.ts`의 문서 직접 UPDATE가 큐를 우회함. [Issue #10](https://github.com/happysuyeun-rgb/plan_os/issues/10)으로 후속 격리. 버전 복원 중간 실패·동시 version_number 충돌·DocumentPage activeVersion 동기화도 테스트 대기.
- **결론:** PR #9는 **Draft/미병합**, UI·실 DB 검증 전까지 배포/승인 금지. 기존 Plan OS Supabase DB는 INACTIVE, 개발 브랜치 없음.

## Phase 0 채팅 편집 직접 쓰기 제거 (2026-10-16)
- **P0 Issue #10 코드 대응:** [Draft PR #11](https://github.com/happysuyeun-rgb/plan_os/pull/11) (`fix/planos-chat-document-write-20261016`, 기반 Draft PR #9)에서 `src/lib/api/chat.ts`의 `documents.content` 직접 SELECT/UPDATE를 제거하고 `documentStore.applyChatEdit` → 문서별 autosave queue로 연결.
- **화면·대화 격리:** ChatPanel의 중복 `onDocumentUpdate` 저장 제거, 다른 문서·프로젝트 및 과거 버전 상태 보호, 느린 채팅 응답의 다른 문서 메시지 목록 오염 방지, 전송 오류 토스트, 같은 요청의 중복 전송/낡은 로딩 상태 방지. 채팅·버전 목록 재조회는 문서 ID가 바뀔 때만 하도록 수정.
- **실제 CI 통과:** 새 `tests/chatDocumentEdit.test.mjs` 6개 + 기존 11개 = 총 **17개**. 코드 커밋 `108048f4acfb7244c019bb5a8d16c313a3cad4c0`의 [GitHub Actions #38847021222](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38847021222)에서 `npm ci`, TypeScript/빌드, ESLint, **17/17 단위 테스트 PASS(실패 0)** 확인.
- **QA:** [PR #11 브랜치의 회귀 시나리오 C-01~10](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-chat-document-write-20261016/docs/qa/DOCUMENT_SAVE_REGRESSION.md) 작성, 브라우저/격리 DB 미실행. **채팅은 여전히 placeholder**, 실제 LLM 호출 아님.
- **남은 차단:** 채팅 메시지 INSERT 성공 후 문서 쓰기 실패 시 멱등성/원자성, 이중 편집 브라우저 검증, 서버 RLS 실증. PR #11 Draft/미병합, Issue #10은 실제 QA 통과 전 열어 둠.

## 제품 정의 현황
- [데이터 모델 v0.2](engineering/DATA_MODEL.md): 실제 001~008 SQL 정적 확인 기반 CURRENT/ TARGET 구분, 신규 AI 엔터티와 기존 generation_runs 분리. DDL·운영 적용 없음.
- [API 계약 v0.2](engineering/API_CONTRACTS.md): TARGET 23개 API와 인증/권한/예산/멱등성/실패 규칙. 서버 구현·테스트 전.

- [권한·승인 정책 v0.2](product/PERMISSIONS_POLICY.md): owner/editor/viewer/outsider/AI 역할, R0~R3 도구 등급, 12개 권한 테스트 계획. **실제 RLS 검증 전**.
- [AI 실행 아키텍처 v0.2](engineering/ARCHITECTURE.md): 영속 워커·ModelGateway·승인·예산·증빙·복구 설계. **구현/공급자 선정 전**.
- [화면별 기능명세 v0.2](ux/SCREEN_SPEC.md): MVP 9개 핵심 화면의 입력/행동/검증/예외/수용 조건, 나머지 14개 화면 통합 전략 작성. 검토 전·미구현.
- [IA 및 화면 목록 v0.2](ux/IA.md): CURRENT 11개 라우트, TARGET 23개 화면 후보, TF 연결·기존 DocumentPage 딥링크 보존 전략. 실제 구현/화면 QA는 미완료.
- [사용자 업무 흐름 TF-01~30 v0.2](product/TASK_FLOWS.md) 작성(브랜치), 검토 전. 진입/행동/산출/실패/권한 정의 및 화면/API/DB 1차 매핑 작성, 1:1 테스트 매핑 미완료.
- [통합 서비스 기획서(PRD v0.2)](product/PRD.md) 작성 완료(브랜치), 검토/승인 전. 목표 제품 범위 정의이지 구현 완료가 아님.
- 기존 `docs/TECH_SPEC.md`는 V1 구현 참조로 보존.

## 작업별 증빙
| 구분 | 항목 | 상태 | 증빙 |
|---|---|---|---|
| 문서 | 기준선 감사 초안 | **부분 작성 / 감사 미완료** | [감사 문서](engineering/BASELINE_AUDIT.md) |
| 문서 | 개발 실행계획 | **브랜치 작성 완료 / 미병합** | [실행계획](roadmap/IMPLEMENTATION_PLAN.md) |
| 문서 | 진행 현황표 | **브랜치 작성 완료 / 미병합** | [이 문서](PROGRESS_STATUS.md) |
| CI | build/lint 워크플로 | **PR #5 미병합; CI 성공 근거는 PR #8 최신 브랜치** | [PR #5](https://github.com/happysuyeun-rgb/plan_os/pull/5) / [성공 실행](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38680673570) |
| 감사 | DB/RLS 정적 감사 | **SQL 8개 검토 완료 / 실제 권한 검증 미완료** | [Issue #2](https://github.com/happysuyeun-rgb/plan_os/issues/2) |
| 품질 | 빌드/테스트/배포 환경 검증 | **PR #9 단위 테스트+CI 통과 / 브라우저·DB 회귀 및 배포 환경 미완료** | [PR #9](https://github.com/happysuyeun-rgb/plan_os/pull/9) / [Actions #38844552645](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38844552645) / [Issue #3](https://github.com/happysuyeun-rgb/plan_os/issues/3) |
| 설계 | 서버 AI 실행/승인/비용 ADR | **아키텍처 v0.2 초안 작성 / 선정·승인 미완료** | [설계 초안](engineering/ARCHITECTURE.md) / [Issue #4](https://github.com/happysuyeun-rgb/plan_os/issues/4) |
| 코드 | 린트 수정 PR #8 | **CI 성공 / 회귀 미검증** | [PR #8](https://github.com/happysuyeun-rgb/plan_os/pull/8) |
| 보안 | RLS 위험 재현·수정 | **정적 위험 발견 / DB 재현 미완료** | [Issue #7](https://github.com/happysuyeun-rgb/plan_os/issues/7) |
| 모델 | FreeLLMAPI 검토 | **외부 문서 검토 완료 / 설치·성능 시험 미착수** | [실행계획](roadmap/IMPLEMENTATION_PLAN.md) |

## 상태 정의
- **완료:** 정의된 수용 기준과 검증을 통과했고 증빙 링크가 있음.
- **브랜치 작성 완료:** GitHub 브랜치에 반영되었으나 PR 미병합. 출시·운영 반영과 구분.
- **진행 중:** 일부 결과가 있으나 완료 조건 미충족.
- **미완료/미착수:** 아직 구현·검증되지 않음.
- **보류:** 의존성·결정·승인 대기. 사유와 해제 조건 명시.
- **차단:** 실제 진행 불가능한 장애. 원인·담당·해결 방법 명시.

## 업데이트 규칙 (모든 향후 작업에 적용)
1. 작업 시작 시 이 문서의 전체 로드맵과 대상 작업 상태를 확인한다.
2. 작업 후 **완료/진행 중/미완료/보류/차단**을 명확히 구분하고 근거를 남긴다.
3. 모든 문서에 최초 작성일·최종 수정일·버전·진행 상태를 기재한다.
4. 수정할 때 최초 작성일은 유지하고 **최종 수정일을 실제 수정 날짜**로 바꾼다. 중요한 수정은 변경 이력에 날짜·내용·근거를 추가하고 버전을 올린다.
5. 코드 작성·PR 생성·CI 통과·병합·운영 반영은 **서로 다른 상태**로 기록한다.
6. 추정 진행률을 임의의 백분율로 표현하지 않는다. 단계별 수용 기준 통과 수를 근거로 산정한다.
7. 작업 보고 시 항상 **전체 계획 / 이번에 완료 / 아직 미완료 / 다음 순서 / 검증·위험**을 포함한다.
8. GitHub 작업에 대한 완료 보고 전에 이 현황표와 문서 인덱스를 같은 브랜치에서 갱신한다.

## 최신 점검 결과 (2026-10-16 — 단일 최신 스냅샷)
- **코드 안전성 추가:** PR #9 자동저장·복원·재생성 직렬화 11개 단위 테스트 CI 통과. PR #11에서 채팅 직접 DB 쓰기를 별도 autosave 경로로 통합하고 테스트 6개를 추가. **둘 다 Draft/미병합**; 브라우저/RLS·메시지 원자성 미검증.
- **제품/설계:** PRD, TF-01~30, IA, SCREEN_SPEC, PERMISSIONS_POLICY, ARCHITECTURE, DATA_MODEL, API_CONTRACTS **8개 v0.2 보완 초안 작성**. 모두 검토/승인 전·미구현. [12개 문서 감사](quality/DOCUMENT_REVIEW_2026-10-16.md)에서 P0~P2 누락/모순 기록.
- **로드맵:** [개발 실행계획 v1.4](roadmap/IMPLEMENTATION_PLAN.md)에 실제 문서 상태·Phase 3 내부 최소 계약 선행·Phase 5 고객 UI 확장 관계 반영. Phase 0은 미완료이며 Phase 1은 선행 초안 작성 상태.
- **CI 검증 완료 범위:** [PR #8 Actions #38680673570](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38680673570), 커밋 `152e33968a90eea9e23dc58c63e4ba1beedc6dc4`에서 npm ci/build/lint **SUCCESS(ESLint 0 errors, 1 warning)**. 이 검증은 **PR #8 브랜치만**의 증빙이며 main/PR #5가 통과하거나 브라우저 E2E가 통과했다는 뜻이 아님.
- **미완료 P0 검증:** 댓글 deep-link, DocumentPage 버전 전환·저장, documentStore 전역 debounce 타이머·문서 전환 데이터 덮어쓰기 위험, ScreenListTable/WireframeSlideView 입력 경합, 프로젝트 복원/모달. 자동 테스트·브라우저 회귀를 아직 실행하지 않음.
- **RLS 보완 최신 참고:** `project_members` SELECT 42P17은 재활성화된 DB에서 **실제 재현**됨([Issue #12](https://github.com/happysuyeun-rgb/plan_os/issues/12)). 다음 줄의 다른 SQL 위험은 역할별 행위 재현 전의 정적 위험이다.
- **RLS 정적 위험:** `006` project_members 조회 자기참조, 댓글 작성자·반응 본인 행 변경 제약, 알림 recipient, 활동 위조, 과거 버전 수정·generation_runs 상태 조작. 운영 취약점 확정이 아닌 **개발 DB 재현 필요** 항목. SQL 001~008 정적 검토만 완료.
- **배포·데이터:** 실제 Supabase 적용 마이그레이션, 운영 환경 분리/설정, 모델 API 계약·원가, 서버 AI 워커 동작 확인 미완료. `main` 병합/운영 DB 수정/배포 없음.
- **문서 정합성 보완 완료:** 로드맵·CI 최신 상태, Phase 3 계약 순서, 데이터 유니크 키, 산출물 수락 화면 제안, TF 추적성, API 미완성 구간 표기. [12개 문서 감사 v1.1](quality/DOCUMENT_REVIEW_2026-10-16.md)에 증빙·잔여 항목 정리.
- **다음 순서:** (1) 문서 감사 DQ-04/07~10 실질 차단 사항과 제품 정책 확인 (2) 격리 DB RLS 검증·기존 기능 회귀 (3) 첫 PM+전문 AI 1명/도구 1종 수직 슬라이스의 서버 API/SQL 계약 확정.
- **과거 기록 보존:** 이전 CI 실패·중간 수정 내역은 아래 **변경 이력**과 [기술 감사](engineering/BASELINE_AUDIT.md)에만 기록한다. 이를 최신 상태로 해석하지 않는다.

## 변경 이력
| 날짜 | 버전 | 내용 | 근거 |
|---|---|---|---|
| 2026-10-14 | v1.0 | 전체 로드맵, 완료/미완료 상태, 증빙·보고 규칙 최초 작성 | PR #1, PR #5, Issues #2–4 |
| 2026-10-14 | v1.1 | 중복 준비도 문서를 실행계획에 통합·삭제, 문서 인덱스 간소화 | PR #1 |
| 2026-10-14 | v1.2 | 저장소 전체 목록 확인 및 CI 실패 원인 기록 | CI run 38517379376 |
| 2026-10-14 | v1.3 | 완료 후 후속 실행 규칙 및 린트 수정 Issue #6 추가 | Issue #6 |
| 2026-10-14 | v1.4 | SQL 8개 정적 검토 및 보안 재현 작업 Issue #7 등록 | Issue #7 |
| 2026-10-14 | v1.5 | 린트 1차 수정 PR #8 생성, 검증·잔여 오류 미완료 명시 | PR #8 |
| 2026-10-14 | v1.6 | 프로젝트 API 린트 오류 수정 및 복원 회귀 검증 필요 기록 | PR #8 |
| 2026-10-15 | v1.7 | 완료·미검증 상태 재정리, FreeLLMAPI 검토 반영, CI/RLS/ADR 우선순위 일치 | PR #8, Issues #6/#7 |
| 2026-10-15 | v1.8 | 모달 2종 effect 오류 수정 PR #8 추가, CI·회귀 검증 미완료 기록 | PR #8 |
| 2026-10-15 | v1.9 | 화면 목록·와이어프레임 effect 수정, PR #8 CI 파일 추가 및 실행 미확인 기록 | PR #8 |
| 2026-10-15 | v2.0 | 실제 CI 오류 3건 확인, DocumentPage 상태 갱신 수정, 남은 회귀 위험 기록 | PR #8, Actions #38679535956 |
| 2026-10-16 | v2.1 | 최신 CI 성공(0 errors, 1 warning) 확인, 회귀 테스트 미완료 구분 | Actions #38680673570 |
| 2026-10-16 | v2.2 | 통합 서비스 PRD v0.1 작성, Phase 1 초안 착수 | PR #1 |
| 2026-10-16 | v2.3 | TF-01~30 업무 흐름 초안 작성 및 인덱스 연결 | PR #1 |
| 2026-10-16 | v2.4 | CURRENT 라우트 대조 및 IA/화면 목록 v0.1 작성 | PR #1 |
| 2026-10-16 | v2.5 | 핵심 9개 화면 기능명세 v0.1 및 14개 화면 통합 전략 작성 | PR #1 |
| 2026-10-16 | v2.6 | 권한/승인 매트릭스 및 AI 실행 아키텍처 ADR v0.2 초안 작성 | PR #1 |
| 2026-10-16 | v2.7 | CURRENT SQL 대조 데이터 모델·TARGET API 23개 계약 초안 작성 | PR #1 |
| 2026-10-16 | v2.8 | 12개 문서 교차감사, CI 최신 스냅샷 통일, Phase 3 계약 선행과 P0 결정/검증 누락 반영 | [문서 품질 감사](quality/DOCUMENT_REVIEW_2026-10-16.md) |
| 2026-10-16 | v2.9 | PRD·TF·IA·SCREEN·PERMISSIONS·ARCH·DATA·API 문서 v0.2 정합성 보완 및 감사 해결/미해결 구분 | [문서 감사 v1.1](quality/DOCUMENT_REVIEW_2026-10-16.md) |
| 2026-10-16 | v3.0 | 문서 감사 재검산: CI·아키텍처·TF 매핑의 최신 상태 표현 정리 | [문서 감사 v1.1](quality/DOCUMENT_REVIEW_2026-10-16.md) |
| 2026-10-16 | v3.1 | Supabase Plan OS 비활성/개발 브랜치 없음·마이그레이션 조회 실패, PR #9 자동저장 코드 수정 및 CI/단위 테스트 성공 기록 | [PR #9](https://github.com/happysuyeun-rgb/plan_os/pull/9) / [Actions #38844552645](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38844552645) |
| 2026-10-16 | v3.2 | 버전 복원·AI 재생성 문서별 쓰기 직렬화, 11개 테스트 CI 성공, QA B-01~12/Issue #10 경합 위험 기록 | [Actions #38845602357](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38845602357) / [Issue #10](https://github.com/happysuyeun-rgb/plan_os/issues/10) |
| 2026-10-16 | v3.3 | PR #11 채팅 직접 DB 쓰기 제거, 문서별 저장 큐 연동 및 6개 신규 테스트, 브라우저 QA/C-01~10·원자성 미완료 기록 | [PR #11](https://github.com/happysuyeun-rgb/plan_os/pull/11) / [Issue #10](https://github.com/happysuyeun-rgb/plan_os/issues/10) |
| 2026-10-16 | v3.4 | PR #11 CI #38847021222 실측 build/lint·17개 단위 테스트 성공 기록 | [Actions #38847021222](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38847021222) |
| 2026-10-16 | v3.5 | Supabase ACTIVE/001~008 적용·12개 RLS 확인, 멤버 SELECT 무한 재귀 42P17 실증, Draft PR #13 및 Advisor 경고 기록 | [Issue #12](https://github.com/happysuyeun-rgb/plan_os/issues/12) / [PR #13](https://github.com/happysuyeun-rgb/plan_os/pull/13) |
| 2026-10-16 | v3.6 | RLS 009 격리 PostgreSQL17 CI PASS·초대 권한 회귀 보완, 남은 기간 43~79 작업일 재산정 | [Actions #38849011220](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38849011220) / [실행계획 v1.5](roadmap/IMPLEMENTATION_PLAN.md) |
| 2026-10-16 | v3.7 | 일회용 실제 Supabase Auth/JWT/PostgREST 통합 RLS 테스트 성공, 과거 DB 비활성·Issue #10 미수정 서술 최신화 | [Actions #38852999398](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38852999398) |
| 2026-10-16 | v3.8 | 댓글·반응·참여상태·알림·버전 010 별도 Draft PR #14, 일회용 Auth/JWT/REST CSEC-01~12 CI PASS·남은 UI/보안 차단 기록 | [Actions #38854258418](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38854258418) / [PR #14](https://github.com/happysuyeun-rgb/plan_os/pull/14) |
| 2026-10-16 | v3.9 | PR #15 통합 2-parent merge·앱/SQL/Auth CI 3종 PASS, 실제 Chromium 로그인·대시보드·PRD 스모크 PASS 및 전체 UI 회귀 미완료 기록 | [PR #15](https://github.com/happysuyeun-rgb/plan_os/pull/15) / [Browser #38856198235](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38856198235) |
| 2026-10-16 | v4.0 | B-01/B-02/C-01 브라우저·격리 DB PASS, 댓글 중복 GET 제거와 늦은 응답 보호, 19개 잔여 브라우저/원자성 이슈 누락 점검 | [Browser #38867796404](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867796404) / [QA v1.2](https://github.com/happysuyeun-rgb/plan_os/blob/test/planos-phase0-integrated-20261016/docs/qa/PHASE0_INTEGRATED_QA_2026-10-16.md) |
| 2026-10-16 | v4.1 | B-05 저장된 현재 버전→과거 미리보기→복원 v3 실제 Chromium/DB PASS, 원자성·미저장 초안 Issue #16 분리, B/C 4/22 정상 경로 확인 | [Actions #38869950232](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38869950232) / [Issue #16](https://github.com/happysuyeun-rgb/plan_os/issues/16) |

## 연속 실행 원칙
- 업무 종료 시 **완료 → 검증 → 미완료 → 다음 작업 → 바로 실행 가능 여부 → 사용자 승인 필요 사항**을 보고한다.
- 권한과 도구가 허용하고 운영 위험이 없는 후속 작업은 추가 지시를 기다리지 않고 이어서 수행한다. 실제 도구 호출 없이 백그라운드 진행을 주장하지 않는다.
- 운영 DB/배포/결제/PR 병합 등 영향 큰 변경은 별도 승인 이후에만 진행한다.
- **현재 다음 작업(최신):** 통합 PR #15 격리 Chromium B-01/B-02/C-01 + 댓글 GET 0건 PASS. 다음 **B-05 버전 복원·C-03 채팅/탭 이동·B-03 느린 저장/프로젝트 이동 E2E → 원자성/권한/초대·댓글·알림·휴지통 QA** 순서. 운영 변경은 별도 승인.

## 바로 다음 작업
1. [PR #9](https://github.com/happysuyeun-rgb/plan_os/pull/9) / [PR #11](https://github.com/happysuyeun-rgb/plan_os/pull/11): 각각 자동저장·복원·채팅 직접 DB 쓰기 코드 수정, **17개 유닛 테스트 CI 통과**. B-01~12/C-01~10 실제 브라우저 및 원자성 검증 전까지 둘 다 Draft 유지.
2. [Issue #7](https://github.com/happysuyeun-rgb/plan_os/issues/7) / [Issue #12](https://github.com/happysuyeun-rgb/plan_os/issues/12): Plan OS **ACTIVE_HEALTHY**, 운영 적용 001~008 유지. [Draft PR #13](https://github.com/happysuyeun-rgb/plan_os/pull/13)의 009와 [Draft PR #14](https://github.com/happysuyeun-rgb/plan_os/pull/14)의 010은 **격리 Auth/JWT/REST PASS / 운영 DB 미적용**. 브라우저 회귀 및 기타 권한 문제 미완료.
3. [Issue #2](https://github.com/happysuyeun-rgb/plan_os/issues/2): SQL 정적 감사 이후 실제 적용 상태 및 권한 검증 마무리.
4. [Issue #3](https://github.com/happysuyeun-rgb/plan_os/issues/3): CI 재검증 및 회귀 기준선.
5. [Issue #4](https://github.com/happysuyeun-rgb/plan_os/issues/4): AI 실행 아키텍처 ADR.
