# PlanOS 3.0 × AI 인력사무소 — 구현 인계 상세 명세 v1.0

**2026-10-20 · 성격:** 실제 소스/기존 설계/감사 결과를 대조한 **MVP 개발 기준선**. 이 문서의 기본 선택은 개발을 위한 잠정 결정이며 상용 가격·외부 모델·운영 배포 승인을 뜻하지 않는다. 코드/테스트/운영 적용 전에는 완료가 아니다.

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

**run.status:** `queued -> running -> validating -> succeeded`; `queued/running -> cancel_requested -> cancelled`; `queued/running/validating -> failed` 또는 `blocked_reconciliation`. 실패 재시도는 같은 idempotency 의도와 별도 attempt 이력 기록; provider 불명확시 재호출 금지.

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
