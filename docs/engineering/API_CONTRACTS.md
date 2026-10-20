# PlanOS 3.0 — API 계약 명세 (TARGET)

**최초 작성일:** 2026-10-16  
**최종 수정일:** 2026-10-16  
**문서 버전:** v0.2  
**진행 상태:** 설계 초안 / 엔드포인트 구현·서버 테스트 전  
**상위 문서:** [PRD](../product/PRD.md) · [권한 정책](../product/PERMISSIONS_POLICY.md) · [아키텍처](ARCHITECTURE.md) · [데이터 모델](DATA_MODEL.md)  
**주의:** 모든 `/api/v1/...`는 **제안 URL**이다. 기존 React/Supabase API를 대체하거나 현재 서버에 존재한다는 의미가 아니다.

## 1. API 기본 규칙
- **인증:** Supabase 사용자 세션 검증 후 서버가 `actor_id` 산출. 요청 body의 user_id/owner_id를 신뢰하지 않음.
- **스코프:** 프로젝트 리소스는 항상 `projectId`와 자원 소속 검증. AI worker는 서비스 주체+특정 run/task/contract에 한정.
- **쓰기:** `Idempotency-Key` 필수(계약 동의·승인·run 생성·취소·정산). 중복 요청은 동일 결과 반환.
- **동시성:** `If-Match` 또는 `expectedVersion`으로 충돌 감지. 승인·계약 조건 변경 시 새 승인.
- **비용:** 통화코드 ISO 4217, 최소 단위 정수(`amountMinor`), estimate/reserved/actual 구분.
- **페이지네이션:** `limit`(기본 20, 최대 100), opaque `cursor`. 정렬 안정성 보장.
- **감사:** 서버 `requestId/traceId` 반환, 로그에서 민감정보 마스킹.
- **공통 응답:** `{data, meta:{requestId, version?}}`; 오류 `{error:{code,message,retryable,details?},meta:{requestId}}`.
- **오류 코드:** 400 VALIDATION_ERROR, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 CONFLICT/STALE_VERSION, 412 APPROVAL_REQUIRED, 422 INVALID_TRANSITION, 429 BUDGET_EXCEEDED/RATE_LIMITED(구분 코드), 503 PROVIDER_UNAVAILABLE.
- **권한:** HTTP/프런트 검증과 별도로 DB/RLS/워커에서 정책 재검사.

## 2. 프로젝트·업무·계획

| ID | 메서드·경로(제안) | 권한 | 요청 핵심 | 성공 응답/효과 | TF |
|---|---|---|---|---|---|
| API-01 | GET `/api/v1/projects/:projectId/workspace` | 멤버 | projectId | 브리프/업무/AI 팀/비용 요약 | 04~06 |
| API-02 | GET `/api/v1/projects/:projectId/tasks` | 멤버 | status,assignee,cursor | 사람·AI 공통 업무 목록 | 15~18 |
| API-03 | POST `/api/v1/projects/:projectId/tasks` | owner/editor | title,objective,assignee,criteria | taskId, draft | 15 |
| API-04 | PATCH `/api/v1/projects/:projectId/tasks/:taskId` | owner/editor | expectedVersion,변경 필드 | 업데이트/충돌 | 15 |
| API-05 | POST `/api/v1/projects/:projectId/plans` | owner/editor | objective,scope,modelPreference? | planId, planned(초안) | 13 |
| API-06 | POST `/api/v1/projects/:projectId/plans/:planId/approve` | owner(기본) | expectedVersion,decision,reason | 승인 이벤트·계획 버전 | 14 |

## 3. AI 인력사무소·계약

| ID | 메서드·경로 | 권한 | 요청 핵심 | 성공 응답/효과 | TF |
|---|---|---|---|---|---|
| API-07 | GET `/api/v1/agents` | 회원/공개 정책 | role,capability,availability | 검증된 역할 목록 | 07 |
| API-08 | GET `/api/v1/agents/:agentId` | 회원/공개 정책 | agentId | 도구·제약·검증 정보 | 08 |
| API-09 | POST `/api/v1/agents/:agentId/interviews` | 회원 | projectId,goal,answers | 적합성 설명/제약 | 09 |
| API-10 | POST `/api/v1/projects/:projectId/contracts` | owner | agentId,scope,allowedTools,budgetCapMinor,currency,expiresAt | draft 계약·조건 버전 | 10 |
| API-11 | POST `/api/v1/projects/:projectId/contracts/:contractId/accept` | owner | termsVersion,explicitConsent | active 계약·감사 이벤트 | 11 |
| API-12 | POST `/api/v1/projects/:projectId/assignments` | owner | contractId,agentId | 배치 ID·킥오프 | 12 |
| API-13 | POST `/api/v1/projects/:projectId/contracts/:contractId/terminate` | owner | reason,cancelPolicy | 새 실행 차단·정산 진행 | 28 |

## 4. 실행·승인·증빙·비용

| ID | 메서드·경로 | 권한 | 요청 핵심 | 성공 응답/효과 | TF |
|---|---|---|---|---|---|
| API-14 | POST `/api/v1/projects/:projectId/runs` | owner/명시 위임자 | taskId,contractId,approvedPlanId,idempotencyKey | 202 Accepted, runId, queued/awaiting_approval | 16~17 |
| API-15 | GET `/api/v1/projects/:projectId/runs` | 멤버(권한별 필터) | status,cursor | 실행 요약 목록 | 18 |
| API-16 | GET `/api/v1/projects/:projectId/runs/:runId` | 멤버(권한별) | runId | 상태·도구/검증·비용·증빙 | 18,20~22 |
| API-17 | POST `/api/v1/projects/:projectId/runs/:runId/cancel` | owner/허용자 | reason,expectedVersion | 202 취소 요청 상태 | 24 |
| API-18 | POST `/api/v1/projects/:projectId/runs/:runId/retry` | owner/허용자 | expectedVersion,reason | 신규 attempt 또는 run ID | 24 |
| API-19 | GET `/api/v1/projects/:projectId/approvals` | 멤버(권한별) | status,cursor | 승인 대기/완료 목록 | 19,23 |
| API-20 | POST `/api/v1/projects/:projectId/approvals/:approvalId/decide` | owner/명시 위임자 | decision,expectedVersion,approvalDigest | 승인/거부/만료 판정 | 19 |
| API-21 | GET `/api/v1/projects/:projectId/artifacts/:artifactId` | 멤버(권한별) | artifactId | 버전·검증 결과·보안 링크 | 21~23 |
| API-22 | POST `/api/v1/projects/:projectId/artifacts/:artifactId/accept` | owner/명시 위임자 | decision,note,expectedVersion | accepted/rejected/needs_revision | 23 |
| API-23 | GET `/api/v1/projects/:projectId/usage` | owner | period,cursor | estimate/reserved/actual/refund 원장 요약 | 27 |

## 5. 핵심 요청/응답 예시

### API-14 — 실행 요청
```http
POST /api/v1/projects/{projectId}/runs
Authorization: Bearer <session-token>
Idempotency-Key: run-create-unique-key
Content-Type: application/json
```
```json
{
  "taskId": "uuid",
  "contractId": "uuid",
  "approvedPlanId": "uuid",
  "expectedVersion": 3
}
```
```json
{
  "data": {
    "runId": "uuid",
    "status": "queued",
    "budget": {"currency": "KRW", "reservedMinor": 1200},
    "traceId": "trace-id"
  },
  "meta": {"requestId": "request-id"}
}
```
- 서버가 계약/작업/계획의 프로젝트 일치·승인·도구·예산·멱등성을 검사한다.
- 계약이 만료되었거나 필요한 행위별 승인이 없으면 queued로 만들지 않는다. `awaiting_approval` 상태와 필요한 승인 목록을 반환할 수 있다.
- **예시 금액 1,200원은 형식 설명용 임의 값**이며 서비스 가격/실제 원가가 아니다.

### API-20 — 고위험 실행 승인
```json
{
  "decision": "approved",
  "expectedVersion": 2,
  "approvalDigest": "sha256-of-target-and-payload"
}
```
- owner/위임 권한 검증, 만료/철회·payload digest/대상·예산 재검증.
- 이미 승인된 동일 멱등성 키는 동일 결과. 변경된 대상은 409/412로 새 승인 요구.

### API-22 — 산출물 수락
```json
{
  "decision": "accepted",
  "note": "검토 완료",
  "expectedVersion": 4
}
```
- 산출물의 프로젝트/버전/검증 상태를 확인. 검증 실패면 accepted 불가.
- 수락 이벤트는 변경 불가; 이후 수정 요청은 새 revision으로 추적.

## 6. 서버 내부 전용 계약(브라우저 호출 금지)
- `WorkerLease.acquire(runId, workerId, leaseTTL)`: lease·상태 버전 CAS.
- `PolicyGate.authorize(actor,project,contract,task,tool,target,digest)`: RLS와 별개로 도구 실행 전 최종 정책 평가.
- `ApprovalGate.check(approvalId,targetDigest,expiresAt)`: 만료/철회/대상 변경 차단.
- `Budget.reserve/settle/release(runId,amountMinor,currency)`: 원자적 원장 처리.
- `ModelGateway.invoke(provider,model,scopedContext,limits)`: 공급자 API, 비용·타임아웃·민감정보 최소화.
- `ToolExecutor.run(toolKey,scopedInput,approvalRef)`: allowlist/격리 실행/외부 멱등성.
- `ArtifactValidator.verify(artifactId,criteria)`: 자동 검증 결과 영속.
- `Outbox.dispatch(eventId)`: DB-큐 전달 재시도.

**내부 계약은 함수/인터페이스 개념명이며 코드가 존재한다는 뜻이 아니다.**

## 7. 오류·상태·복구 시나리오

| 상황 | API 응답/상태 | 사용자 처리 |
|---|---|---|
| 세션 만료 | 401 | 재로그인 후 동일 요청 안전 재시도 |
| 타 프로젝트 자원 | 404 또는 403 | 자원 존재 여부 비노출 |
| editor가 계약 승인 | 403 | owner 승인 요청 |
| 승인 미존재·만료 | 412 | 승인함으로 이동 |
| 계획/산출물 버전 충돌 | 409 | 최신 버전 비교·재검토 |
| 예산 초과 | 429 + BUDGET_EXCEEDED | 비용 상한 재설정 요청 |
| 중복 실행 요청 | 기존 run 결과 반환 | 중복 실행·중복 과금 없음 |
| 워커 중단 | queued/running→재획득 또는 failed | 로그·증빙 유지, 재시도 가능 여부 표시 |
| 외부 도구 부분 성공 | blocked/failed + sideEffect 기록 | 자동 중복 실행 금지·수동 확인 |
| 검증 실패 | awaiting_acceptance로 전이 금지 | 수정 요청·근거 확인 |

## 8. API 구현 순서·테스트 게이트
1. **Phase 0:** 기존 Supabase 직접 API/RLS 실 DB 상태 확인, 브라우저/문서 회귀 테스트.
2. **Phase 2:** API-01~06(사람 업무·계획), 기존 `/projects/:projectId` 딥링크 유지.
3. **Phase 3:** API-14~23(실행·승인·비용·증빙) 및 서버 내부 정책·워커. 계약 최소 기능 선행.
4. **Phase 4:** AI PM 계획/위임/검증 브리핑 E2E.
5. **Phase 5:** API-07~13 인력사무소 탐색·면담·계약 UI 공개.
6. **검증:** 권한 4종, 계약 해지, 예산 초과, 중복 요청, 워커 재시작, 외부 부작용, 승인 만료, 산출물 미검증, 기존 문서 회귀.

## 9. 2026-10-16 교차 감사에서 확인한 API 빈 구간 (DQ-03/04/08)
**기존 API-01~23은 목록 초안**이며 실제 UI를 모두 구현하기 위한 완결된 계약이 아니다. 다음 요청/조회 계약은 아직 ID·최종 경로/권한·응답 스키마가 확정되지 않았다.

| 필요 동작 | 관련 화면/TF | 미완성 지점 | 다음 설계 원칙 |
|---|---|---|---|
| 계획 상세 GET·버전 비교 | N08 / TF-13~14 | API-05는 생성 POST만 정의; 저장된 계획 읽기/재수정 없음 | 계획 버전·상태·작업·비용·승인 관계 명시 |
| AI PM 계획 생성 작업 상태 조회 | N08 / TF-13 | LLM 계획 생성은 비동기/비용 발생 가능하지만 API-05는 즉시 planned처럼 보임 | 서버 job으로 처리 여부 결정; draft 요청과 실제 모델 실행 구별 |
| 계약 상세 GET·조건 PATCH·조건 버전 | N19~N20 / TF-10~11 | 계약 검토 URL이 있어도 조회/수정 계약이 없음 | owner·terms 버전·조건 스냅샷과 동시성 검사 |
| 승인 요청 생성·상세 GET·철회 | N12~N13 / TF-19 | API-20은 결정만 있음; 누가 언제 승인 요청을 생성하는지 빠짐 | 서버 승인 서비스만 생성, 대상 payload digest 고정 |
| 실행 이벤트·로그 페이지 조회/실시간 갱신 | N10~N11 / TF-18 | API-16 상세만 있고 event cursor/poll/SSE 계약 없음 | 재접속·중복 이벤트·역할별 로그 필터 |
| 승인함/수락 패널의 사용자 결정 상태 조회 | N11~N12 / TF-23 | API-22 POST만 있음; 수락 버전/기록/충돌 표시 스키마 부족 | 검증 근거·수락자·버전·재검토 필요 표시 |
| 잔여 예산/비용 예약·해제·정산 | N14 / TF-27~28 | API-23 요약만 정의; 서버 내부 원장 동시성 상세 없음 | 워커 서버 전용 API/트랜잭션, 중복 청구 테스트 |
| 데이터 내보내기·계정 탈퇴·설정 | C08/N23 / TF-30 | 기존 앱 기능과 신규 계약/실행 데이터의 정리 절차 누락 | 기존 기능 KEEP, 신규 데이터 삭제/보존 정책 후 확장 |

**명세 완료 기준:** 상세 OpenAPI(요청·응답·오류), 정책/DB 표, 계약별 테스트, 잘못된 프로젝트 ID/만료·변경된 승인/중복 요청을 포함해 모든 MVP 화면 CTA에 서버 동작이 1개 이상 연결돼야 한다. **위 항목은 구현·검증 완료로 계산하지 않는다.**

### 핵심 순서 고정 전제
- Phase 3에 내부 최소 계약/역할/capability·예산·승인 엔터티가 필요하다. Phase 5는 고객이 탐색/면담/계약하는 UI 공개 범위다.
- `API-14`의 Idempotency-Key는 **HTTP 헤더가 기준**이며 본문에 중복 전달하지 않는 방향으로 설계한다(기존 표의 idempotencyKey는 정식 필드로 확정하지 않음).
- 계획 생성에 실제 LLM이 필요한 경우 API-05는 장시간 동기 응답으로 단정하지 않는다. 비용 예약/모델 호출/실패 복구 계약 확정 후 async job 패턴을 선정한다.

### 2026-10-19 계약 선행·비용 발생 PM 계획·R0/R1 API 보정 요구사항 (미구현)
- **API-05 모델 계획 생성:** 현재 제안의 동기 반환 'planned'는 고객 예산 예약·유료 계획 생성·서버 재시작을 표현하지 못한다. **비모델 수동 계획 draft**는 별도 구분하고, 유료 모델 계획은 계약 사전 동의+원자 예산 예약 후 **202 / plan generation job ID → GET 상태/비용/실패** 흐름을 정의해야 한다. 계획은 owner가 최종 approve하기 전 approved 불가.
- **API-10/11:** 계약 조건 고정·명시 consent·terms/version/digest+소속 프로젝트/문서 ID·공급자 데이터 처리/PM 비용 상한, 생성/수락 중복 방지. 세부 GET/PATCH 및 만료/중단 상태는 신규 계약으로 추가.
- **API-14~18:** run 생성·예산 예약·outbox는 원자적; 같은 key 재요청은 같은 run. 문서 snapshot mismatch/프로젝트 변경/멤버십 해지/승인 범위 초과는 재승인 또는 안전한 409/403. 외부 공급자 과금의 idempotency는 별도.
- **API-19/20:** 위험 행위 approval을 서버가 생성(GET 상세, 철회, 만료 포함). 모델이 approval 결정 레코드를 생성하지 못하게 서버 내부 이벤트·digest 검증. 초기 검사 AI는 R2/R3 도구 자체 금지.
- **API-21/22:** report 신규 artifact 저장은 서버만, 입력 문서 원본 변경 금지. machine verifier PASS/사용자 acceptance/출처 참조와 권한별 GET, artifact version/digest 고정. provider usage 관측·원가 원장 정산은 acceptance와 독립.
- **P1-5 미완:** 정확한 URL/schema/status/HTTP 오류/OpenAPI·SQL·RLS·테스트는 아직 없음. [P1-2 정책](../product/MVP_CONTRACT_APPROVAL_COST_POLICY_2026-10-19.md) / [감사](../quality/PHASE1_CROSS_AUDIT_2026-10-19.md).

### 2026-10-20 P1-5 구현 인계(설계안)
- [API·DB 상세 계약 P1-5](AI_API_DB_CONTRACT_P1_5_2026-10-20.md) P5-01~16에서 계약 GET/PATCH, 유료 비동기 PM 계획 job/조회, approval 요청 서버 발행/상세/철회, 실행 이벤트 cursor, artifact 검토·수락 상태 GET, 사용량 기록·원가 대사 내부 API를 구체화.
- 기존 API-05와 동기 planned 반환은 유료 plan-generation에 부적합하므로 실구현 전에 수정; API-20 decision과 승인 요청 생성, API-22 acceptance와 machine verdict는 별도 사건.
- 명세 초안 완료일 뿐 OpenAPI 실제 schema/런타임 API/SQL/RLS 구현은 미실행.

## 10. 미결정
- API 서버/호스팅·큐 공급자, 인증 세션 전달 방식, 상태 enum 최종 형태.
- editor 승인 위임 정책, 계약/결제 법적 표현, 통화/크레딧 정산 규칙.
- 기존 Supabase 직접 호출과 신규 BFF의 이행 순서, rate limit·쿼터.
- OpenAPI 스키마·실제 코드 생성·통합 테스트는 후속 작업.

## 변경 이력
| 날짜 | 버전 | 내용 | 상태 |
|---|---|---|---|
| 2026-10-16 | v0.1 | TARGET API 23개, 공통 규칙, 실행/승인/수락 요청·오류·내부 워커 계약 정의 | 검토 전 |
| 2026-10-16 | v0.2 | 계획·계약·승인·실행 상태·수락·비용 조회 누락과 비동기/멱등성 보완 요구사항 표기 | 검토 전 |
