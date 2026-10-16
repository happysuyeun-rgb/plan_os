# PlanOS 3.0 — API 계약 명세 (TARGET)

**최초 작성일:** 2026-10-16  
**최종 수정일:** 2026-10-16  
**문서 버전:** v0.1  
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

## 9. 미결정
- API 서버/호스팅·큐 공급자, 인증 세션 전달 방식, 상태 enum 최종 형태.
- editor 승인 위임 정책, 계약/결제 법적 표현, 통화/크레딧 정산 규칙.
- 기존 Supabase 직접 호출과 신규 BFF의 이행 순서, rate limit·쿼터.
- OpenAPI 스키마·실제 코드 생성·통합 테스트는 후속 작업.

## 변경 이력
| 날짜 | 버전 | 내용 | 상태 |
|---|---|---|---|
| 2026-10-16 | v0.1 | TARGET API 23개, 공통 규칙, 실행/승인/수락 요청·오류·내부 워커 계약 정의 | 검토 전 |
