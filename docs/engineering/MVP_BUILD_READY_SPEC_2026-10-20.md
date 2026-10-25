# PlanOS 3.0 × AI 인력사무소 — 구현 인계 상세 명세 v1.1 — 교차 정합성 보완

**2026-10-20 · 교차검토 보완 · 2026-10-25 CURRENT/TARGET 주석:** 실제 소스/기존 설계/감사 결과를 대조한 **MVP 개발 기준선**. 상용 가격·외부 모델·운영 배포 승인을 뜻하지 않는다. 문서 정합화 ≠ E2E/기능 완료.  
**정본 보조:** [STATUS_VOCABULARY](../plans/STATUS_VOCABULARY_2026-10-25.md) · [PERMISSION_MATRIX](../plans/PERMISSION_MATRIX_2026-10-25.md) · [FEATURE_TRACEABILITY](../plans/FEATURE_TRACEABILITY_2026-10-25.md).

## 0. 제품 정의와 완료 정의

**단일 사용자 가치:** 이미 작성된 PlanOS 프로젝트 PRD와 기능명세서(IA)를 선택하여 기획 검수 AI에게 검토를 맡기고, 근거가 달린 검수 보고서를 승인/반려하는 것.

**고객 여정 (일부만 만든 상태를 완성으로 표시 금지)**

프로젝트 생성/선택 → 두 문서 선택 → 무과금 검사 범위 미리보기 → owner의 계약/비용/데이터 처리 동의 → PM 검사 계획 생성/수정 → owner 계획 승인 → 서버에서 실행 예약/큐잉 → 전문 AI가 허용된 문서만 읽고 보고서 생성 → 기계적 근거/스키마 검사 → owner가 보고서 버전 수락/반려 → 프로젝트 이력에서 재조회.

**MVP 포함:** project/task CRUD, 전문 AI 역할 1종, owner 계약·승인, 비공개 보고서, 작업 상태·재시도·취소, 비용 예약/실비/미확인 구분, 이벤트·실패 안내. **MVP 제외:** 실제 인간 직원 채용, 외부 웹 조사, 코드 직접 수정/배포, 원본 문서 자동수정, 다중 전문 AI 마켓플레이스, 결제/환불 실거래, viewer 계약·실행.

**완료 판정:** ① 테스트용 계정에서 위 여정 E2E ② 일회용 DB에서 테넌트·역할/RLS 차단 ③ 동일 요청 재시도/프로세스 재시작에서 중복 산출물/원장 없음 ④ 기존 PlanOS 문서/버전/자동저장 회귀 ⑤ 고객 정보/모델 키 보안 검증 ⑥ 시범 사용자의 산출물 수락 여부 확인. 문서 완성 ≠ 제품 완성.

## 1. 구현 분할 — 실제 빌드 순서와 산출물

| 슬라이스 | UI/route | 서버/DB | 완료를 입증할 테스트 |
|---|---|---|---|
| S1 기반 | 프로젝트 안 업무 목록/생성·상태 편집 | tasks + membership RLS, CRUD | owner/editor 범위, viewer 쓰기 403, 타 프로젝트 404; reload 보존 |
| S2 소스 선택 | 프로젝트 문서 2종 선택, 검사 범위·제외 목록 | manifest 생성; 문서 소속/리비전·해시 고정 | 서로 다른 프로젝트 문서/삭제 문서 거부; 소스 수정 후 stale 처리 |
| S3 동의/계약 | 검수 역할·전송 범위·상한·만료 확인, owner 동의 | immutable accepted contract snapshot | 무동의·stale terms/비owner 실행 불가 |
| S4 PM 계획 | 사람이 편집 가능한 무과금 계획 초안, 승인 화면 | plan_version/approval CAS | 처음 POST 멱등성, stale 승인 409, 중복 클릭 동일 결과 |
| S5 실제 실행 | 실행/진행/실패/취소 UI | runs + reservation + outbox 단일 트랜잭션, worker lease | crash/restart, concurrent claim, 취소/timeout, provider 미확인 |
| S6 결과 검수 | findings, 원본 근거 링크, 수락/반려 | private artifacts + validator + acceptance event | 위조 소스 인용 차단, 기존 문서 원본 불변, 동일 버전 중복 수락 차단 |
| S7 합류 | 계획·위임·결과 이력 통합 | 위 S1~S6 권한/키 일관 | 실제 JWT/REST/브라우저 E2E; PR 병합 전 회귀 |

S1은 이전 Phase 0의 데이터 유실 결함과 **별도 브랜치에서 병행**하되, 운영 DB와 main으로의 병합은 검증·승인 후 수행한다. UI-only/mock-only를 서버 구현 완료로 표기 금지.

## 2. 화면 계약 (DocumentPage C09/C10 경로 변경 금지)

### 2.1 CURRENT (구현·Mock)
- `/projects/:projectId/tasks` · `/tasks/:taskId`: S1 목록/상세·이력·**F-105 AI 담당 Mock**(LS). 상태 필터·skeleton·HTTP별 UI는 부분.
- `/projects/:projectId/plans` · `/plans/new` · `/plans/:planId`: **사람 PM** (AI 생성으로 표시 금지).
- `/projects/:projectId/specialists` · `/specialists/request` · `/ai-review`: 채용·검수 **Mock** (유료 LLM/실계약 없음).
- `/projects/:projectId/audits/new`: 소스 선택 (S2 부분).

### 2.2 TARGET (미구현 — CURRENT로 오인 금지)
- `/projects/:projectId/contracts/:contractId`: 실계약·동의·철회.
- `/projects/:projectId/runs/:runId` · `/artifacts/:artifactId`: 서버 실행·산출물 수락.

**공통 UI 규칙:** 쓰기에는 처리중 중복 클릭 방지 + 요청키 재사용; 실패 재시도는 새 작업을 무조건 만들지 않음; 접근 금지는 오류 존재 여부를 누출하지 않는 404; 키보드로 모든 승인/수락 실행; 상태는 서버에서만 확정.

## 3. 상태 기계 — DB에서만 전이 확정

**task.status:** `todo -> in_progress -> in_review -> done`; `todo/in_progress/in_review -> blocked`; `blocked -> in_progress`; `done` 재개는 owner의 reopen 사건(이유 필수). 프로젝트 이동 금지; 삭제는 soft-delete + 로그.

**contract.status:** `draft -> active -> revoked/expired`. active 약관·문서 범위·상한은 불변. 변경은 새 버전 계약을 만들어 owner 재동의.

**plan.status (CURRENT canonical):** `draft -> pending_owner_approval -> approved|rejected|needs_revision`. (구 문서 `awaiting_approval` = `pending_owner_approval`.)

**run.status (TARGET DB):** `queued -> running -> validating -> succeeded` 등. **CURRENT Mock ReviewJob**은 `awaiting_human` 등을 쓰며 run과 혼용 금지. 상세: STATUS_VOCABULARY.

**artifact.acceptance (TARGET):** `pending -> accepted|rejected|needs_revision` (구 `changes_requested` 별칭 폐기 권고). 모델이 accepted로 변경 불가.

## 4. REST 계약 (최소 변경 가능한 범위)

공통 (**TARGET REST**): `Authorization: Bearer <JWT>`; `Idempotency-Key`는 모든 최초 생성/결정/재시도 POST에 필수; 자원 수정 PATCH에는 `If-Match: "<version>"` 필수. 최초 생성 POST에 가상의 If-Match 요구 금지.  
**CURRENT 정본:** [API_CONTRACTS §0](API_CONTRACTS.md) — PM=`create_pm_plan`/`transition_pm_plan`, 업무=`projectTasks` PostgREST(+CAS), 검수=ReviewJob Mock. 아래 `/api/v1/...` 경로는 **미구현 제안**이다.

- `POST /api/v1/projects/:p/tasks` 201: {title, objective, acceptanceCriteria[], assigneeKind:"human"|"agent", agentKey?}. **assigneeKind는 TARGET REST.** CURRENT는 `assignee_user_id` + 브라우저 F-105 Mock · **Idempotency-Key 없음** · status default `todo`. 응답 {id,projectId,status:"todo",version:1}. owner/editor만; viewer 403.
- `GET /api/v1/projects/:p/tasks?cursor=&status=` 200: 커서 기반 목록. 타 프로젝트/없는 ID 404. (**TARGET 페이징** · CURRENT는 단순 목록)
- `GET /api/v1/projects/:p/tasks/:id` 200: 멤버에게 권한별 redacted 작업 정보.
- `PATCH /api/v1/projects/:p/tasks/:id` 200: 수정 가능 필드 allowlist, expectedVersion CAS; stale 409. soft-delete/`deletedAt`·restore=owner. **reopen API 없음**(FD-06).
- `POST /api/v1/projects/:p/audit-drafts` 201: **명칭 TARGET 별칭.** CURRENT 정본 테이블=`audit_source_manifests` · RPC=`create_audit_source_manifest`.
- `POST /api/v1/projects/:p/contracts` 201: owner 서명 전 draft만; 입력 검증. (**TARGET** · Mock=`review_only`)
- `POST /api/v1/projects/:p/contracts/:id/accept` 200: owner JWT, terms_digest, manifest_digest, two caps/통화/만료, consent digest; 서버 원자적 고정. (**TARGET**)
- `POST /api/v1/projects/:p/plans` 201: 사람 편집용 무과금 초안. **CURRENT≈`create_pm_plan`**(REST 아님).
- `POST /api/v1/projects/:p/plans/:id/submit` 200: **TARGET.** CURRENT=`transition_pm_plan(request_approval)` → `pm_plan_approval_events`.
- `POST /api/v1/projects/:p/approvals/:id/decide` 200: **TARGET.** CURRENT PM=`transition_pm_plan(approve|reject|needs_revision)`. **MVP에 editor 위임(delegation) 기능·테이블 없음.**
- `POST /api/v1/projects/:p/runs` 202 · cancel · artifacts GET/acceptance: **전부 TARGET** (`ai_runs`/`ai_artifacts` DDL 없음). CURRENT Mock 수락=`acceptFindingAsTask`(version/digest 바인딩 없음).

**오류:** 401 unauthenticated, 403 명백한 역할 거부, 404 테넌트 리소스 부재 마스킹, 409 version/payload conflict, 412 동의/승인 누락, 422 상태 전이 금지, 429 예산 부족, 503 provider 장애. 같은 요청키+같은 payload는 동일 응답/리소스, 다른 payload는 409.

## 5. 데이터 모델의 구현 불변 조건

기존 프로젝트/문서/버전 테이블을 재사용하고, **CURRENT 실존** `project_tasks`·`audit_source_manifests`·`pm_plans`(+`pm_plan_approval_events`)와 **TARGET 논리** `agent_contracts`, `project_plans`(이름 충돌 주의), `ai_approvals`, `ai_runs`, `ai_outbox_events`, `ai_artifacts`, `ai_acceptances`, `ai_budget_reservations`, `ai_usage_ledger`, `ai_run_events`를 분리. 구칭 `audit_drafts`는 문서 별칭일 뿐 DDL명이 아니다.

공통: UUID PK, `project_id`, `created_at`, 필요한 `state_version`; 자식은 `(project_id,parent_id)` 복합 FK로 타 프로젝트 교차 연결 차단. `UNIQUE(project_id,id)` 부모 지원. 기존 `projects.id` 및 auth user FK는 실제 migration 확인 뒤 정확한 이름/타입 맞춤. `actor_id`는 클라이언트 값 신뢰 금지(JWT에서 서버 유도).

**핵심 UNIQUE:**
- `(project_id,actor_id,action_scope,idempotency_key)` + payload_hash 저장
- `(project_id,plan_id,plan_version)`의 중복 승인 결정 금지
- `(project_id,run_id,provider_ref,event_type)` ledger event dedupe
- `(project_id,artifact_id,artifact_version,decision_id)` 사람 수락 사건 추적.

**접근 제어:** owner는 동의·비용·계획 승인·실행·수락; editor는 작업/문서 초안 편집, viewer는 허용된 프로젝트 정보 읽기; outsider는 불가. 원가·계약·비공개 보고서는 프로젝트 멤버라도 별도 허가 없으면 노출 금지. 브라우저에서 service_role, provider key, internal usage API 금지.

**원자 트랜잭션:** 실행 시작 시 동일 트랜잭션에서 계약/승인/문서 해시/예산 row lock → reservation → run → outbox. provider 호출은 DB commit 이후. worker는 lease+state_version CAS로 소비하며 중복 도착 허용하되 중복 외부 호출을 최소화하고 중복 산출물/청구 기록 금지. 응답 불명확하면 자동으로 '무료' 처리하거나 재호출하지 않고 `blocked_reconciliation`.

## 6. 보고서 JSON 계약 — 검수 가능한 산출물

```json
{
  "schemaVersion":"1.0",
  "runId":"uuid",
  "taskId":"uuid",
  "sourceManifest":[{"documentId":"uuid","type":"prd","digest":"sha256:...","revision":"immutable-id-or-digest"}],
  "scope":{"checks":["missing","inconsistent","untestable","permissions","recovery"],"excluded":[]},
  "findings":[{
    "id":"f-001","kind":"inconsistent","severity":"high",
    "summary":"서로 다른 비밀번호 정책","evidence":[
      {"documentId":"uuid","digest":"sha256:...","locator":"section-2.3"}
    ],
    "reason":"두 문서의 규칙이 충돌함","suggestedFix":"정책 1개 확정","verification":"source_validated"
  }],
  "limitations":[],
  "validator":{"schema":"pass","sourceReferences":"pass"},
  "acceptance":{"state":"pending"}
}
```

보고서는 새 비공개 R1 자원에만 저장한다. 서버가 hash/locator/allowlist 검사하고 근거 없는 finding은 `needs_review` 또는 검증 실패. **이 검사 결과는 의미적 정확성/사용자 최종 수락을 보증하지 않는다.** 원본 PlanOS 문서에는 절대 자동 PATCH하지 않는다.

## 7. QA 실행 계약 — 자동화 우선

- **AUTH-01~04:** outsider 타 프로젝트 ID 404; viewer task POST/contract/run 403; editor 비용 동의 403; owner 승인 OK.
- **DATA-01~04:** 교차 project child FK INSERT 거부; document digest 변조 409; 삭제/권한 박탈 후 기존 run tool access 차단; 원본 문서 불변.
- **MUT-01~04:** 동일 key+payload 중복 POST 단일 결과; 동일 key 다른 payload 409; 동시 PATCH 중 하나만 성공; 새 plan revision은 이전 approval 무효.
- **RUN-01~05:** 두 worker 중 한 lease owner; worker crash 후 안전 복구; 취소 후 도구 호출 차단; provider 응답 유실 시 정산 보류; 중복 outbox에 보고서 단일 생성.
- **COST-01~03:** 예약 초과 실행 거부; reserve와 observed/pending 이중합산 방지; 미확정 provider 원가를 0으로 둔갑 금지.
- **UI-01~05:** 프로젝트→선택→동의→승인→실행→보고서→수락 E2E; reload 후 동일 run; 기본 기존 문서/버전/초안 복구 회귀; 키보드 접근성; API 409/503 장애 안내.
- **모델 품질 별도:** 실제 익명화된 평가 fixture에서 인용문 참조 일치율·오탐·미검증 수를 기록. 정확도 기준은 실측 이후 결정하고 추정치로 PASS 금지.

## 8. 선행 결정과 중단 게이트

**코드 개발을 막지 않는 기본 선택:** 첫 agent는 `requirements_auditor_v1`; 작업 상태 값은 위 계약; 초기 PM 계획은 *사람이 작성하는 무과금 초안*으로 시작; queue는 DB outbox/worker PoC 우선; 외부 호출 없는 mock부터 검증.

**실제 외부 모델/운영 출시를 막는 결정:** 공급자·모델/워커 호스트와 원가, 사용자의 상한 금액·고지/데이터 보존/약관·결제/환불, 실제 개인정보 처리/삭제, 운영 DB migration·main 병합·배포 승인. 이 결정 전에는 가격·원가 숫자를 임의로 고정하거나 실제 고객 데이터를 모델에 전송하지 않는다.

**다음 코드 인계 순서:** ① 현재 DB migration/권한 구조에 맞춘 S1 tasks migration+RLS+API/화면+테스트 ② S2 manifest 고정 ③ S3/S4 동의·사람 PM 계획 ④ S5 mock 워커/원장 ⑤ S6 기획 검수 보고서 ⑥ 실제 모델 승인·연결 ⑦ 파일럿. 각 슬라이스 종료 시 commit/PR·CI 링크·실제 사용 시나리오 PASS 증빙으로만 상태 변경.

**근거:** `FIRST_SPECIALIST_AI_MVP_2026-10-19.md`, `MVP_CONTRACT_APPROVAL_COST_POLICY_2026-10-19.md`, `UX_FLOWS.md`, `AI_EXECUTION_ADR_002_2026-10-20.md`, `AI_API_DB_CONTRACT_P1_5_2026-10-20.md`, `PHASE1_P5_REAUDIT_2026-10-20.md`. 기존 초안의 P5-08 서버 승인 생성 분리, 최초 POST와 If-Match 모순, 모델 계획 job/원가 범위의 불일치를 이 구현 기준에서 해소했다.

## 9. 2026-10-20 교차 감사 — 누락/불일치 수정 결정 및 개발 전 차단 게이트

**대조:** `DATA_MODEL.md`, `PERMISSIONS_POLICY.md`, `SCREEN_SPEC.md`, `UX_FLOWS.md`, `AI_API_DB_CONTRACT_P1_5_2026-10-20.md`, `PHASE1_P5_REAUDIT_2026-10-20.md`, `ARCHITECTURE.md`. 이 섹션은 **설계상 규칙을 확정하는 내용이지 SQL/운영 안전 검증 PASS가 아니다.**

| ID | 심각도 | 발견 | 정리한 구현 규칙 / 남은 검증 |
|---|---|---|---|
| C-01 | P0 | `SCREEN_SPEC`에는 `verifying/awaiting_acceptance/accepted` 단일 AI 화면 상태, 새 명세에는 `validating/succeeded` 실행 상태. 그대로 구현하면 상태 API가 갈라짐 | DB `run.status`는 `validating/succeeded`, `artifact.acceptance`는 별도. UI에서만 `validating→verifying`, `succeeded + pending→awaiting_acceptance`, `succeeded + accepted→accepted` 합성. 중복 상태 컬럼 생성 금지 |
| C-02 | P0 | task 명칭 `tasks`(기존 목표 DATA_MODEL)와 `project_tasks`(신규 구현 명세) 혼재 | 실제 신규 SQL 이름은 `project_tasks`로 기준화. 기존 CURRENT `generation_runs`와 신규 `ai_runs`는 변경/병합하지 않음. 다른 명세의 `tasks`는 논리 엔터티 별칭으로만 해석 |
| C-03 | P0 | 사전 승인 비용 상한 숫자가 미결정인데 `POST runs`와 비용 예약이 당장 가능한 듯 기술됨 | S1/S2/S4 무과금 모의 개발만 가능. S5 mock run의 cost는 외부 공급자 청구 0으로 간주하지 않고 `provider_mode=mock`, `billable=false`, ledger에 실청구 엔트리 없음. **유료 provider 연결과 고객 실제 문서 전송은 공급자/상한/약관·보존 승인 전 차단** |
| C-04 | P0 | owner/role 검사는 API에 있으나 서비스 권한이 우회하는 service_role과 RLS의 책임 중복 | 브라우저는 JWT/RLS; 서버 BFF는 JWT 검증, membership, contract/scope, request digest, cost gate를 **service_role 조회 전** 검사. Worker는 별도 scoped job/프로젝트 검사. RLS + 서비스 정책 모두 실제 JWT/DB 테스트 필수 |
| C-05 | P0 | 서버 문서 해시만 고정하면 문서가 편집·삭제된 뒤 AI에 읽힌 본문이 무엇인지 입증할 수 없음 | `audit_drafts.source_manifest`에는 문서 ID+type+digest+고정 revision(가능한 경우). 승인 시 고정 스냅샷 읽기 가능성 확인. 실행 직전 digest 재확인; 변경 시 `409 STALE_SOURCE`로 실행 중단·재선택/재승인. 불변 본문 스냅샷이 없으면 과거 본문을 임의 복원하지 않음 |
| C-06 | P0 | 승인 생성 경로 P5-08이 공개 API처럼 표기되어 악의적 요청 가능 | 승인 요청은 내부 정책 서비스가 생성, 브라우저에서 POST 직접 호출 금지. owner 결정 API는 서버에서 기존 요청의 `actor/project/targetDigest/version` 재검증. 관리자 키 브라우저 제공 금지 |
| C-07 | P0 | 첫 생성 POST에 `If-Match` 일괄 강제하면 기존 버전이 없어 API 불가능 | 최초 생성 POST는 idempotency key + payload digest, 기존 자원 PATCH/결정은 expectedVersion/CAS. 같은 키+상이한 payload는 409. 승인 버전 변경은 이전 승인 재사용 금지 |
| C-08 | P0 | provider 타임아웃에서 `failed` 재실행하면 과금/보고서 중복 위험 | 제공사 결과가 미확인된 run은 `blocked_reconciliation`. 동일 provider 요청의 실제 비용/결과 확인 전 자동 재호출 금지. 예약/관측/불명확 사용량을 합산하여 중복 부채 계상하지 않도록 reservation별 원장 식별 필요 |
| C-09 | P1 | 개인정보/로컬 미저장 원고를 통째로 브라우저 저장하는 기존 B-04 개발 PR #19는 접근 기기 유출·저장 용량·계정변경·다중탭 덮어쓰기 검증이 미흡 | 프로젝트 AI 데이터 처리 정책과 별개로 로컬 초안 저장 정책(사용자 고지, 만료/로그아웃 처리, quota 실패 경고, 다른 탭 충돌)을 확정하고 브라우저 QA 통과 전 Phase 0 DONE 금지 |
| C-10 | P1 | UX 목표 라우트는 기존 문서 `/projects/:projectId/:docType`와 별개지만 URL을 잘못 매칭할 여지가 있음 | React Router의 신규 `/projects/:projectId/tasks`, `/runs` 등을 고정 경로로 선언하고 기존 문서 `:docType`보다 먼저 경로/권한 분기. 특수 경로가 docType으로 해석되지 않는 실제 네비게이션 테스트 필수 |
| C-11 | P1 | S1 task 상태에는 `blocked`가 있지만 blocked 이유·해제 권한·타임스탬프 정의가 빠짐 | 필수 `blocked_reason`(비공개 위험정보 제외), `blocked_at`, `unblocked_by`; 차단 해제 시 사유/actor 이벤트 기록. 상태 변경은 서버 CAS 및 감사 로그; 삭제 후 숨김 처리 |
| C-12 | P1 | 입력 선택이 2개 이상이어도 두 문서가 동일 내용/유형일 때 '교차검수' 가치를 입증하기 어려움 | 기본 소스 규칙: **서로 다른 document_id 2개 이상**, PRD+IA 권장. 같은 유형 허용 여부는 UI 경고만; 문서 내용 텅 빔/읽기 불가/삭제/다른 프로젝트는 서버 거부. `findings 0`은 무결성 인증이 아님 |
| C-13 | P1 | `project_tasks.assigneeKind="agent"`가 실제 AI 계약을 생략한 자동 실행으로 오해될 수 있음 | agent 지정은 **업무 메타데이터**에 불과. `accepted_contract_id`, `approved_plan_id`, `run_id`는 별도 승인 후 연결; task 생성만으로 AI 실행/과금 불가 |
| C-14 | P1 | 보고서 acceptance와 task `done`이 중복 완료 신호일 수 있음 | 보고서 수락은 특정 artifact digest/version 사건만; task done은 별도 서버 전이. MVP에서는 accepted 이벤트 성공 후 같은 트랜잭션/후속 멱등 이벤트로 done 전이(실패 시 재처리), 반려는 in_review 유지. 자동 수행을 인간 승인으로 오표기 금지 |

### 남은 구현 차단 질문 — 코드 작성 전부를 멈추는 사안은 아님

1. **즉시 S1에 필요한 결정:** 프로젝트 role/viewer task 목록 열람 필드, 담당자 스키마, 기존 `projects`/member/문서 컬럼 정확한 타입은 실제 SQL 001~008 대조 후 DDL 확정. 특히 `project_tasks`의 차단 사유/정렬/soft-delete/버전 제약은 migration에서 코드/테스트로 확정해야 한다.
2. **S2/S3에 필요한 결정:** immutable 본문 스냅샷 별도 저장 방식과 용량/기밀 보존, 원본 삭제/승인 철회 시 이전 snapshot 접근 차단 기준.
3. **유료 호출 직전에만 필요한 승인:** 실제 모델/worker 호스트, 공급자 데이터 처리/학습/보존, 고객 동의 문구, 상한 금액, 환불/결제. 확정하지 않은 내용을 기본 정책으로 몰래 정하지 않는다.
4. **운영 승인:** main 병합·운영 DB migration·실제 외부 호출/배포는 명시 승인과 회귀 PASS 전 차단.

### 다음 작업을 위한 순서

- S1 `project_tasks` DDL/RLS를 **실제 CURRENT migrations에 맞춰** 작성하고, permission matrix 및 CAS/soft-delete 테스트를 동시에 추가한다.
- S1 task 페이지의 실제 API·route를 연결하여 브라우저에서 CRUD/reload/권한 차단까지 재현한다.
- S2 문서 source manifest + hash 고정 및 stale-source 409 회귀를 다음 단계로 개발한다.
- 별개 Phase 0 PR #19는 충돌/브라우저 리로드/다중탭/기기 저장 정책 테스트 전까지 Draft 유지한다.
