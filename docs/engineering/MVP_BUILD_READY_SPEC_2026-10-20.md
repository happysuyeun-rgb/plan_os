# PlanOS 3.0 × AI 인력사무소 — 구현 인계 상세 명세 v1.1 — 교차 정합성 보완

**2026-10-20 · 교차검토 보완:** 실제 소스/기존 설계/감사 결과를 대조한 **MVP 개발 기준선**. 이 문서의 기본 선택은 개발을 위한 잠정 결정이며 상용 가격·외부 모델·운영 배포 승인을 뜻하지 않는다. 코드/테스트/운영 적용 전에는 완료가 아니다.

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

## 2. 화면 계약 (신규 목표 라우트 — 기존 C05/DocumentPage 경로 변경 금지)

- `/projects/:projectId/tasks`: 목록, 상태별 필터, 빈 화면, 권한별 CTA, 새로고침 후 동일 결과. 필수 열: 제목, 담당 역할, 상태, 마지막 변경일, 상세 이동.
- `/projects/:projectId/tasks/:taskId`: 목표/성공 기준/담당자, 선택 소스 2종, 활동 이력, 계약/계획/실행/보고서 단계별 상태. 데이터 fetch 중 skeleton; 403/404/409/503 별도 행동.
- `/projects/:projectId/audits/new`: 같은 프로젝트의 2개 이상 문서 선택, 수정 시각/버전/해시 미리보기, 제외할 문서·검사 범주. 원본 미저장 경고; 임의 프로젝트 전체 접근 금지.
- `/projects/:projectId/contracts/:contractId`: 사용 도구 `read_project_documents` 1종, 선택 문서 고정 범위, 제공사 전송 고지, 계획/실행 각각의 최대 비용, 만료일, 데이터 취급 약관 버전. owner 동의 전 시작 비활성화.
- `/projects/:projectId/plans/:planId`: 사람이 편집한 검사 계획 버전, expectedVersion, 비용/입력 변경 경고, 승인·반려. **무과금 사람 계획을 AI 생성으로 표시하지 않는다.**
- `/projects/:projectId/runs/:runId`: queued/running/blocked/succeeded/failed/cancelled, 이벤트 커서, 안전 재시도·취소; 사용자가 화면을 닫아도 서버 실행 상태 보존.
- `/projects/:projectId/artifacts/:artifactId`: finding별 분류·심각도·근거 위치/원본 해시/인용 검증 여부, 사람이 선택하는 확인·반려·수정 요청. 모델의 '완료'와 사람의 '수락' 명확히 분리.

**공통 UI 규칙:** 쓰기에는 처리중 중복 클릭 방지 + 요청키 재사용; 실패 재시도는 새 작업을 무조건 만들지 않음; 접근 금지는 오류 존재 여부를 누출하지 않는 404; 키보드로 모든 승인/수락 실행; 상태는 서버에서만 확정.

## 3. 상태 기계 — DB에서만 전이 확정

**task.status:** `todo -> in_progress -> in_review -> done`; `todo/in_progress/in_review -> blocked`; `blocked -> in_progress`; `done` 재개는 owner의 reopen 사건(이유 필수). 프로젝트 이동 금지; 삭제는 soft-delete + 로그.

**contract.status:** `draft -> active -> revoked/expired`. active 약관·문서 범위·상한은 불변. 변경은 새 버전 계약을 만들어 owner 재동의.

**plan.status:** `draft -> awaiting_approval -> approved/rejected/expired`; 승인 후 수정은 새 버전이며 기존 승인 재사용 불가.

**run.status (DB 표준):** `queued -> running -> validating -> succeeded`; UX의 `verifying`은 `validating`, `awaiting_acceptance`는 성공한 run과 수락 대기 artifact를 합성한 화면 상태로만 사용한다. `queued/running -> cancel_requested -> cancelled`; `queued/running/validating -> failed` 또는 `blocked_reconciliation`. 실패 재시도는 같은 idempotency 의도와 별도 attempt 이력 기록; provider 불명확시 재호출 금지.

**artifact.acceptance:** `pending -> accepted/rejected/changes_requested`는 정확한 artifact_version+digest의 사람 사건; 모델 또는 validator가 accepted로 변경 불가.

## 4. REST 계약 (최소 변경 가능한 범위)

공통: `Authorization: Bearer <JWT>`; `Idempotency-Key`는 모든 최초 생성/결정/재시도 POST에 필수; 자원 수정 PATCH에는 `If-Match: "<version>"` 필수. 최초 생성 POST에 가상의 If-Match 요구 금지.

- `POST /api/v1/projects/:p/tasks` 201: {title, objective, acceptanceCriteria[], assigneeKind:"human"|"agent", agentKey?}. 응답 {id,projectId,status:"todo",version:1}. owner/editor만; viewer 403.
- `GET /api/v1/projects/:p/tasks?cursor=&status=` 200: 커서 기반 목록. 타 프로젝트/없는 ID 404.
- `GET /api/v1/projects/:p/tasks/:id` 200: 멤버에게 권한별 redacted 작업 정보.
- `PATCH /api/v1/projects/:p/tasks/:id` 200: 수정 가능 필드 allowlist, expectedVersion CAS; stale 409.
- `POST /api/v1/projects/:p/audit-drafts` 201: 동일 project 2개 이상 document_id + version/digest; 서버가 실제 최신/읽기 권한 검사.
- `POST /api/v1/projects/:p/contracts` 201: owner 서명 전 draft만; 입력 검증.
- `POST /api/v1/projects/:p/contracts/:id/accept` 200: owner JWT, terms_digest, manifest_digest, two caps/통화/만료, consent digest; 서버 원자적 고정.
- `POST /api/v1/projects/:p/plans` 201: 사람 편집용 무과금 초안; 1개 audit task/입력 snapshot 참조.
- `POST /api/v1/projects/:p/plans/:id/submit` 200: 계획 버전 고정/서버 승인 요청 생성.
- `POST /api/v1/projects/:p/approvals/:id/decide` 200: owner decision/expectedVersion/digest CAS. **승인 요청 생성 API는 내부 서버 전용이며 공개 UI에 노출 금지**.
- `POST /api/v1/projects/:p/runs` 202: 승인된 plan/active contract/manifest, request key. run+reservation+outbox는 단일 DB 커밋.
- `GET /api/v1/projects/:p/runs/:id` 및 `.../events?cursor=` 200: 재진입 가능 지속 조회.
- `POST /api/v1/projects/:p/runs/:id/cancel` 202/200: CAS, 요청 이후 신규 도구 호출 중단; 실행 중 공급자 취소 불가하면 정산 pending.
- `GET /api/v1/projects/:p/artifacts/:id` 200: owner 전용 비공개 보고서 + 구조화 findings.
- `POST /api/v1/projects/:p/artifacts/:id/acceptance` 200: owner + artifact version/digest 바인딩 결정. 다른 버전의 이전 승인 재사용 금지.

**오류:** 401 unauthenticated, 403 명백한 역할 거부, 404 테넌트 리소스 부재 마스킹, 409 version/payload conflict, 412 동의/승인 누락, 422 상태 전이 금지, 429 예산 부족, 503 provider 장애. 같은 요청키+같은 payload는 동일 응답/리소스, 다른 payload는 409.

## 5. 데이터 모델의 구현 불변 조건

기존 프로젝트/문서/버전 테이블을 재사용하고 신규 `project_tasks`, `audit_drafts`, `agent_contracts`, `project_plans`, `ai_approvals`, `ai_runs`, `ai_outbox_events`, `ai_artifacts`, `ai_acceptances`, `ai_budget_reservations`, `ai_usage_ledger`, `ai_run_events`를 논리적으로 분리.

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


## 2026-10-21 제품 요구 보정 — AI 직원 경력·정식 PM·가격 구현 인계 게이트

**서비스 기준:** [통합 서비스기획서 v2](../product/SERVICE_PLAN_V1_2026-10-20.md), [직원 프로필/성격/모델](../product/AI_STAFF_PERSONA_MODEL_HIRING_SPEC_2026-10-21.md), [경력·동의·가격](../product/AI_STAFF_VERIFIED_EXPERIENCE_CONSENT_TIER_PRICING_2026-10-21.md).

**기존 구현 KEEP:** AI 인터뷰→PRD/기능명세/화면목록/정책/Cursor 프롬프트, AI 채팅/사용자 직접 수정/버전·내보내기. 기본 PlanOS가 'AI 없는 사람 수동 기획'으로 변경되면 P0 회귀 결함.

**추가 수직 슬라이스 (제품 경로, 아직 설계):**
1. 역할(프로젝트 PM/풀스택/QA)·F/T 성향·경력등급·모델을 독립 프로필로 미리보기; 미검증 경력/가격 구분.
2. 기본 제공 직원→기존 프로젝트에 단발 의뢰/직원 교체→정식 PM 다중 프로젝트 배정 Mock, 별도 채용 계약과 UX·권한 검증.
3. 고객 경력 적립 허용/거부·공개/익명/비공개·평점/마케팅 목적 동의를 **직원×프로젝트** 별 저장; 기본 거부·고객 권리 검증.
4. PM은 배정된 여러 프로젝트만 읽고 계획/업무/전문 직원 의뢰를 제안, 실제 서버 실행·도구·외부 호출은 동의/승인/예산/스냅샷/RLS 단일 게이트 통과 뒤.
5. 수락된 실제 수행 이벤트를 직원별 고유 활동일수로 집계·고객 후기/승급 평가·단가 갱신. 중복 일수·성공 미검증·허위 경력 방지 및 이미 시작된 계약 가격 동결.
6. 고객 경력/공개 철회→공개자료 제거·집계/등급 재평가; 고객 원문·코드/사적 채팅을 타 채용자 컨텍스트로 이전 금지.

**개발 의존성:** G1 기존 autosave/chat/version restore/RLS P0 통과 없이 실제 고객 문서 쓰기·운영 DB/모델 연결 금지. 기존 PR #25/#27은 AI 단발 Mock/사람 PM계획 Mock일 뿐 직원 실경력/다중 PM 개발 완료가 아님. `DATA_MODEL.md` 및 `API_CONTRACTS.md`의 추가 엔터티/엔드포인트는 TARGET, 마이그레이션·운영 가격은 미구현/미승인.

**수락 테스트:** STAFF-01~11, E-01~13, ST-01~15, EX-01~14 및 배정 외 프로젝트 접근 거부, 무단 공개/모델 전송 0, 초급 단가 상대 저가·계약 중 인상 없음, 경력 하루 복수 작업 dedupe, 원본/프로젝트 ID 불변. 모델 제공자 변경은 새 전송/비용 승인 필요.
