# PlanOS 3.0 — Phase 1 P1-5 API·DB 상세 계약 v0.1

**작성:** 2026-10-20 · **상태:** 구현 인계를 위한 설계 초안/교차 검수, 사용자·보안·기술 승인 및 실제 SQL/API 테스트 미완료.  
**대상:** PM+기획 검수 AI 1종, 프로젝트 문서 읽기 R0, 별도 비공개 보고서 R1. 기존 문서/운영 DB/기존 API와 호환 유지. 모든 신규 경로/테이블은 **TARGET, 현재 미구현**.
**선행:** [API_CONTRACTS](API_CONTRACTS.md) / [DATA_MODEL](DATA_MODEL.md) / [ADR-002](AI_EXECUTION_ADR_002_2026-10-20.md) / [MVP 정책](../product/MVP_CONTRACT_APPROVAL_COST_POLICY_2026-10-19.md) / [UX 흐름](../ux/UX_FLOWS.md).

## 1. 설계 불변식 — P0
1. 유료 모델 계획 생성 전에 **owner의 고정된 데이터 처리·계약·PM 계획 비용 동의** 필요. 실행과 원가 기록은 별도.
2. 모든 API에서 JWT 주체, 실제 프로젝트 소속, owner/editor/viewer, 계약 scope/버전, 대상 resource의 projectId를 서버 검증. service_role 키만으로 허가하지 않음.
3. 모든 변이 POST/PATCH/승인은 사용자·프로젝트·작업 종류·요청키 범위의 멱등성/expectedVersion 사용. **같은 키+다른 payload는 409**, 같은 키+같은 payload는 같은 결과 반환.
4. 계획 승인과 위험한 도구 승인/최종 산출물 수락은 서로 다른 이벤트 및 actor/버전/타깃 digest를 보관한다.
5. run+예산 예약+outbox를 단일 DB 트랜잭션으로 저장하고 커밋 이후 외부 모델 호출. outbox는 at-least-once, 워커는 lease/CAS/중복 방지.
6. R0 도구는 승인된 documentId/고정 버전 또는 해시만 읽고, R1 artifact writer는 기존 PlanOS documents를 덮어쓰지 않는다.
7. 공급자 **원가**와 사용자 승인 **예산**과 고객 **청구/환불**을 별도 상태/원장으로 보존. 원가 응답 유실은 pending이며 무조건 0원 아님.
8. 서버의 schema/출처 검증 성공은 인간 의미 검수나 accepted가 아니다. 로그/URL/보고서 본문도 project·role·source 권한 강제.

## 2. 표준 응답/오류/버전
- 성공: `{data, meta:{requestId,version?,serverTime}}`; 오류: `{error:{code,message,retryable,details?},meta:{requestId}}`. 외부 로그에는 secrets·본문·타 프로젝트 ID/정확한 존재 여부 노출 금지.
- 인증: 401 UNAUTHENTICATED. 타 프로젝트/없는 리소스: 404 NOT_FOUND (정보 노출 방지). 역할 금지: 403 FORBIDDEN.
- 범위/해시/동시성: 409 STALE_VERSION/CONFLICT. 계획·계약 조건 재승인 필요: 412 APPROVAL_REQUIRED. 잘못된 상태: 422 INVALID_TRANSITION. 한도 부족 429 BUDGET_EXCEEDED(속도 제한 RATE_LIMITED와 구분). 외부 공급자 오류 503 PROVIDER_UNAVAILABLE.
- 모든 변경 요청: `Idempotency-Key` 및 `If-Match` 또는 `expectedVersion` 요구; 서버 고유 UNIQUE(scope,key)와 요청 payload digest 유지. 읽기 목록 `limit`/opaque cursor·안정 정렬·로그 내용 권한별 redaction.
- 서버 이벤트: `requestId,traceId,eventId,projectId,runId?,actorType,actorId?,resourceVersion,createdAt`; 사건 종류와 생성 주체는 위조 불가.

## 3. P1-5 보강 API 계약 (모두 제안 URL)

| ID | 메서드·제안 경로 | 권한·핵심 입력 | 성공/실패 계약 | UX/TF |
|---|---|---|---|---|
| P5-01 | POST /api/v1/projects/:p/audits/drafts | owner, selectedDocumentIds+expectedDigest, scope | **모델 호출 없이** draftId/manifestDigest/expiry; 빈/중복/타 프로젝트 문서 422/404/409 | N05/TF-04,25 |
| P5-02 | GET /api/v1/projects/:p/audits/drafts/:id | owner, draftId | TTL 만료/권한 회수 거부, 같은 문서 고정 스냅샷 | N05 |
| P5-03 | GET /api/v1/projects/:p/contracts/:id | owner; 계약 버전 | termsDigest, status, expiry, budget caps·처리 조건. 조건 변경=새 버전·재동의 | N19/20/TF-10~12 |
| P5-04 | PATCH /api/v1/projects/:p/contracts/:id | owner, expectedVersion, terms candidate | **active 조건 무단 변경 금지**: draft에만 변경 또는 새 draft revision | N19 |
| P5-05 | POST /api/v1/projects/:p/plan-generations | owner, acceptedContractId, manifestDigest, pmCapMinor, Idempotency-Key | **202 generationRunId** + reserved cost; 계약/동의 없는 호출 412/403, 예산 부족 429 | N08/TF-13 |
| P5-06 | GET /api/v1/projects/:p/plan-generations/:id | owner, generationRunId | queued/running/failed/planned, planId/version, usage estimate/reserved/actual/pending | N08 |
| P5-07 | GET /api/v1/projects/:p/plans/:id | 프로젝트 멤버(초안·비용은 owner 등 역할별 필터) | immutable planVersion/selectedManifest/revision/criteria, approval state | N08/N09 |
| P5-08 | POST /api/v1/projects/:p/approvals/requests | **서버 전용** policy/approval service | 승인 대상 actor/source/payloadDigest/expiry/limit 고정, approvalId; 브라우저·AI 직접 생성 거부 | N09/N12/TF-14,19 |
| P5-09 | GET /api/v1/projects/:p/approvals/:id | owner/허용 범위 멤버 | request state, target digest, expiry, requestedAction, version/decision | N09/N12/13 |
| P5-10 | POST /api/v1/projects/:p/approvals/:id/revoke | owner, expectedVersion | revocation event, stale worker authorization 차단 | N12 |
| P5-11 | GET /api/v1/projects/:p/runs/:id/events | 멤버 역할별 redaction, cursor | append-only event timeline; cursor reconnect / duplicate eventId dedupe | N11/TF-18 |
| P5-12 | GET /api/v1/projects/:p/artifacts/:id/review | owner | artifactVersion+digest, sourceManifest/locators, machine verdict, acceptance state, reconciliation state | N11/TF-21~23 |
| P5-13 | GET /api/v1/projects/:p/budget | owner | currency/limit/reserved/observed/pending/available & ledger cursor, unit 명시 | N14/TF-27 |
| P5-14 | POST /internal/v1/runs/:id/usage-observed | trusted worker, scoped identity, providerRef, costMinor?, usage, evidence | provider event dedupe, unknown amount→pending, ledger append only; 브라우저 거부 | worker |
| P5-15 | POST /internal/v1/runs/:id/usage-reconcile | trusted worker/finance reconciler, evidence/providerRef | reserve release/settle/adjust atomic; no extra customer charge | worker |
| P5-16 | GET /api/v1/projects/:p/artifacts/:id/acceptance | owner(필요 최소 멤버 조회 정책 별도) | current artifactVersion/decision/history, GET read-only; **API-22 POST가 유일한 결정 경로** | N11/TF-23 |

**기존 API 재정의 필요:** API-05를 무조건 동기 planned로 간주 금지(무과금 사람 작성과 유료 생성 job 분기). API-10/11 owner 계약 terms 동의·버전/문서 scope 고정. API-14 run 요청 시 승인·예산·idempotency/원자적 outbox. API-20 owner decide는 **P5-08 서버 승인 요청 생성**과 별개. API-22 owner artifact version 수락/수정/반려는 일회성 결정·새 revision과 연결. API-23 비용 원가·고객 청구를 분리.
**중요:** 위 endpoint 명칭/ID는 계획안. OpenAPI 스키마, SDK 타입 생성, SQL 함수 및 인증은 P1-5B에서 검증 전이다. 가격 숫자·보존기간·실제 모델/호스트 선택 안 함.

## 4. 서버 DB 엔터티/제약·전이 구현 계획 (DDL 초안 요구조건)
| TARGET 엔터티 | 필수 필드/불변 조건·복합 FK | 주요 인덱스/제약 |
|---|---|---|
| project_audit_drafts | id,project_id,created_by,selected_sources_json/source_manifest_digest,status,expires_at,version | project+owner+id; 문서 소속/버전 서버 검증, 만료 후 model send 차단 |
| agent_contracts | project_id,agent_id,created_by,terms_version,scope_json,allowed_tools,data_terms_digest,budget_cap_minor,currency,status,expires_at,accepted_by/at | accepted immutable snapshot; project-id FK, 계약/범위 밖 실행 금지 |
| project_plans | project_id,version,objective,manifest_digest,status,approved_by/at | UNIQUE(project_id,version); 수정→새 버전 |
| ai_plan_generations / ai_runs (결정 필요) | project_id,contract_id,run_type,plan_id?,idempotency_key,payload_digest,state_version,lease_owner/until,attempt,status | UNIQUE(project_id,actor_id,action_scope,idempotency_key) proposed. 실제 run_type/actor_id/action_scope 컬럼 없으면 먼저 DDL 명시 |
| ai_runs | project_id,task_id,contract_id,approved_plan_id,status,state_version,lease_owner/until,cancel_requested_at,provider_request_ref | composite project FK to task/contract/plan; CAS |
| ai_outbox_events | project_id,aggregate_id,event_type,event_id,delivered_at,attempts | UNIQUE(event_id), at-least-once consumer |
| ai_approvals | project_id,run_id?,plan_id?,target_digest,contract_terms_digest,status,expires_at,requested_by/decided_by,version | server-issued only, payload binding, owner decision |
| ai_artifacts / ai_artifact_verifications / ai_acceptances | project_id,run_id,artifact_version,content_digest,source_manifest_digest,validator_status,decision,actor_id | unique per artifact version/acceptance event; verify != accept; no doc overwrite |
| ai_budget_reservations | project_id,contract_id,run_id,cap_minor,currency,reserved_minor,status | per contract+run reservation scope, row lock & sufficient cap |
| ai_usage_ledger | project_id,run_id,reservation_id,provider_ref,entry_type,amount_minor,currency,created_at | immutable append-only; providerRef+event type dedupe, compensating entries |
| ai_tool_calls / run_events | project_id,run_id,tool_key,document_id,document_digest,approval_id?,status,trace_id,redacted_json | signed worker/policy scope, R0 only for first role, secrets never stored |

**주의:** 기존 DATA_MODEL 엔터티와 중복 이름은 같은 목표 개념으로 취급. 위 사항은 신규 테이블/컬럼 추가 제안이지 migration이 아니다. 문서 스냅샷 원본이 읽는 도중 바뀌지 않도록 copy/version-bound digest를 원자적으로 고정하거나 재검사. 실제 Postgres 타입/키 구성·ON DELETE/보존 전략 미결정.

## 5. 트랜잭션 경계와 상태 불변식
- **T1 계약 승인:** owner+project+terms_digest/데이터 처리/비용 상한 버전 검사 → accepted immutable 기록 + audit event. 별도 과금 모델 호출 없음.
- **T2 계획 생성:** 계약 active·최신 동의·PM 예산/원가 상한·idempotency 검증 → generation run + reservation + outbox 원자적 삽입. 서버 worker/provider 호출은 커밋 이후.
- **T3 계획 승인:** 계획 version+manifest/비용·terms 바인딩 확인 → server generated approval request + owner decision CAS → approved version immutable. 중복 승인 동일 결과.
- **T4 실행 시작:** task/plan/contract/role/source_scope/owner authorization 동시 재검증 → ai_run + budget reserve + outbox 원자적 커밋; 다른 테넌트 ID 삽입 차단.
- **T5 lease/도구:** SKIP LOCKED claim/heartbeat/lease expiry + state_version CAS. 외부 provider 호출 전 권한·원가 한도/계약·도구 범위 재검사; provider response unknown이면 HOLD/reconcile.
- **T6 검증/산출물:** JSON Schema/출처/digest/프로젝트 범위 판정 → R1 새 artifact 저장 + verification evidence; 실패는 awaiting_acceptance 금지.
- **T7 사람 수락:** owner/allowed approver, artifactVersion+digest/stateVersion 확인 → append-only acceptance + run/work status 원자적 전이. 다른 이벤트/원가 정산과 독립.
- **T8 원가:** 공급자 event dedupe + ledger append + reserved→observed→settled/pending; 별도 재조정 이벤트. 고객 청구/환불은 결제 정책 승인까지 비활성.
- **위험:** 외부 도구/provider API는 DB 트랜잭션과 2PC 불가. 장애 사이 중복 외부 과금 위험은 내부 멱등성만으로 0을 보장하지 않으므로 providerRef+request ID·수동 대사/재시도 제한.

## 6. 역할별 허용 매트릭스 (초기 MVP 보수적 기본)
| 행위 | owner | editor | viewer | outsider | 서버 워커 |
|---|---|---|---|---|---|
| 계약 조건/승인·예산 변경 | allow | deny | deny | deny | verify only |
| 비유료 계획 초안 제안 | allow | allow(기존 프로젝트 편집권 내) | deny | deny | no |
| 유료 AI PM 생성·전문 AI run 생성 | allow | deny | deny | deny | authorized queue |
| plan 버전 최종 승인·artifact 최종 수락 | allow | deny | deny | deny | deny |
| 감사 비공개 보고서/예산 세부 조회 | allow | deny by default | deny | deny | scoped run only |
| 입력 문서 R0 읽기 | allow | existing document permission | existing read permission | deny | scope+digest+contract+approved plan |
| 신규 R1 artifact 쓰기/사용량 기록 | deny direct | deny | deny | deny | server validated only |

**실행 gate:** service_role RLS 우회가 인가 증거는 아니다. 모든 SELECT/INSERT/UPDATE/DELETE/Storage URL에서 service actor를 실행 건별 project+contract+capability+user 권한으로 재검사, outsider·다른 프로젝트 FK 연결 차단. 직접 사용자 INSERT로 assistant/검증/원가 이벤트 위조를 막는다.

## 7. 상태·오류·실제 테스트 설계 (미실행)
| ID | 검증할 시나리오 | 완료 기준 |
|---|---|---|
| P5T-01 | 계약 미동의 유료 AI PM 생성 | 403/412, provider 호출/원가 예약 0 |
| P5T-02 | 중복 POST 같은 키 같은/다른 payload | 같은 run 또는 409; 이중 예약 0 |
| P5T-03 | 다른 프로젝트 문서 ID·계약/plan/승인 연계 | API/DB/RLS/worker 교차 테넌트 접근 0 |
| P5T-04 | owner/editor/viewer/outsider 권한 | 무권한 계약/실행/수락/원가 읽기 0 |
| P5T-05 | 계획 생성 503/워커 crash/동시 claim | 상태 재개, 모호한 외부 원가는 pending, 중복 청구 단정 금지 |
| P5T-06 | plan/terms/document digest 변경 | stale/version 409 및 재승인, 기존 사용자 문서 무수정 |
| P5T-07 | approval 만료/철회·브라우저 직접 승인 요청 생성 | 만료 실행 차단/서버 발행만 허용 |
| P5T-08 | 예산 동시 예약·공급자 이벤트 늦음/중복 | 계약 상한 초과 0, 원가 pending·대사/중복 원장 0 |
| P5T-09 | machine evidence FAIL·잘못된 locator/해시 | artifact human acceptance 불가 |
| P5T-10 | 동시 수락/수정/반려 요청 | artifact 버전별 단일 결정·멱등, 승인자 기록 |
| P5T-11 | 계약 취소/삭제/회원 권한 회수·진행 중 run | 신규 호출 중단, 원가/보존·증빙 분리 |
| P5T-12 | 사용자 브라우저 종료/복구·이벤트 cursor | 서버 run/비용/검증 재조회, 위조 이벤트/로그 노출 0 |

**완료 분리:** `P5T-01~12`는 **테스트 명세 정의만 완료, 실제 서버·DB·CI·브라우저 실행은 0건**.

### 2026-10-20 재감사로 정정한 구현 계약
- **신규 생성 POST:** `Idempotency-Key` + canonical payload digest와 owner/contract/manifest 조건 버전 필수. **아직 생성되지 않은 리소스에는 If-Match 의무가 없음**. PATCH·기존 리소스 승인/취소·상태 변경은 expectedVersion/If-Match와 idempotency를 결합한다. 동일 요청 키+다른 payload → 409.
- **P5-08 승인 요청 생성 경로 정정:** `/api/v1/projects/:p/approvals/requests`를 브라우저 호출 가능한 API처럼 구현하지 않는다. **서버 내부 Policy/Approval service 명령** `createApprovalRequest(projectId,actionDigest,actorContext,...)`으로만 호출, 사용자는 P5-09 조회와 API-20 decide·P5-10 revoke만 권한에 따라 사용. 내부 HTTP 노출 여부/주소는 P1-5B 결정; 외부 권한 우회 불가.
- **T4 예산 계산:** 예약과 이미 관측된 provider cost가 같은 obligation이면 이중 차감하지 않게 obligation/coverage relationship를 별도 모델링하고, `unknown provider cost`는 보수적 pending liability로 보유. 실제 SQL 수식/동시 테스트 전 출시 불가.
- **미확정:** 유료 PM plan generation의 ai_runs 통합 vs 별도 테이블, provider 중복 과금 대응, R1 Storage/DB 원자성, CAS/tenant composite FK, 데이터 삭제·보존. [재감사 P5A-01~13](../quality/PHASE1_P5_REAUDIT_2026-10-20.md), [Threat Model](../quality/THREAT_MODEL_2026-10-20.md), [QA 계획](../quality/TEST_PLAN_2026-10-20.md), [런북](../operations/RELEASE_RUNBOOK_2026-10-20.md) 인계.

## 8. 열린 설계 차단 및 다음 순서
- [x] 신규 API 보완 16건, DB 관계/제약·역할·상태·트랜잭션/테스트 12건 작성.
- [ ] 정확한 JSON Schema/OpenAPI 기계 검증 및 generated types, 실제 SQL DDL/함수/FK/RLS/lock 구현, provider/webhook/비동기 사용량·보존·삭제 스펙 확정.
- [ ] 초기 AI 계획 job을 기존 ai_runs에 통합할지 별도 테이블 분리할지 ADR 확정; ledger 사용액/미확정 채무 중복 없는 수식·provider 비용 대사 실증.
- [ ] 공급자 모델/워커/큐/원가·약관, 결제/환불·예산·데이터 보존 최종 정책 승인, Phase 0 RLS·문서 경합·보안 회귀.
- **다음 P1-6:** Threat Model, QA/Test Plan, Release/rollback runbook. P1-7 추적/누락 최종 감사 이후에만 Phase 1 종료 판단.
