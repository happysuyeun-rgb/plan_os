# ADR-002 — PlanOS AI 실행 파이프라인·ModelGateway·예산 원장 (Phase 1 P1-4)

**2026-10-20 · 상태: 설계 대안 평가/권고안 작성 완료, 특정 공급자·상용 예산·구현 승인 미확정.**  
**근거:** [ADR-001](ARCHITECTURE.md), [P1-2 계약·비용 정책](../product/MVP_CONTRACT_APPROVAL_COST_POLICY_2026-10-19.md), [UX_FLOWS](../ux/UX_FLOWS.md), [P1-3 재감사](../quality/PHASE1_UX_ARCH_AUDIT_2026-10-20.md), [DATA_MODEL](DATA_MODEL.md), [API_CONTRACTS](API_CONTRACTS.md).

## 1. 결정과 제안 이유
**권고(미승인):** 현행 React/Vite+Supabase 문서·로그인 서비스는 그대로 두고, 신뢰 가능한 서버 BFF/Policy Gate + PostgreSQL에 영속된 run/원장/outbox + **단일 lease 기반 워커** + 공급자 독립 ModelGateway + 읽기 전용 도구 + 독립 validator/artifact service를 둔다. 모델 장시간 작업을 브라우저나 HTTP 요청 수명에 묶지 않는다. 외부 Redis/큐 전용 서비스는 초기 규모와 운영 비용 검증 후 선택적으로 추가한다.

| 대안 | 장점 | 차단/단점 | 권고 |
|---|---|---|---|
| A. 브라우저에서 모델 직접 호출 | 빠른 프로토타입 | API 키 유출, 브라우저 종료에 작업 손실, 권한·원가 강제 불가 | 기각 |
| B. 단일 HTTP 동기 호출 | 초기 간단 | timeout/중복요청·복구/취소·상태 영속 불확실 | 상용 영속 실행에는 기각 |
| C. Postgres run/outbox + DB lease worker | 기존 Supabase 인프라 재사용 가능, 원자적 예약·trace·재시작 복구 단순화 | 폴링/lease 경쟁·DB 부하·서비스 역할 보안·유휴 비용 | **첫 격리 검증 1순위** |
| D. 별도 메시지 큐/전용 워커 | 처리량/백오프·스케일 기능 | 추가 서비스·복합 트랜잭션, 메시지 유실/중복 통제 | 처리량 계측 후 후보 |

**주의:** C는 특정 Vercel 배포/서버리스 타임아웃/DB 상품의 적합성이 **검증되었다는 뜻이 아니다**. 워커 호스팅·리스 연장·Postgres pool/RLS·지역·원가는 Phase 1 후속 ADR/격리 PoC에서 비교 후 확정.

## 2. 책임·트러스트 경계
- **Browser:** 계약/계획/실행/검수 UI, Supabase 인증 세션. 모델 API 키·service_role·원장 조작·임의 비용 승인 불가.
- **BFF/Auth+Policy:** 서버가 user JWT 검증→project membership/role→고정된 계약·terms/데이터 처리 동의·문서 manifest→plan 승인/expiry→capability allowlist→예산 상한과 quota 검증. client actor_id/가격/권한은 신뢰하지 않는다.
- **Transaction service:** idempotency_key(테넌트/행위 범위 포함), 고유 요청 저장. 원자적으로 budget reservations + ai_runs + ai_outbox_events 기록 후 즉시 202/run ID 응답. 외부 모델 호출은 DB 트랜잭션 바깥에서.
- **Dispatcher/Worker:** SKIP LOCKED 등 원자 lease claim(제품 선택은 제안), lease TTL/heartbeat, state_version 비교, 권한·계약·예산/kill switch **각 시도와 도구 호출 전 재검증**. 크래시 후 재claim, run 결과/미확정 원가 보존.
- **ModelGateway:** provider adapter interface가 모델 선택·요청 포맷/timeout/사용량·비용 provenance/민감 자료 전송 규칙을 공통화. 제공자 약관·상업적 이용·데이터 이전/보존/학습, structured output/JSON/도구 호출 지원 실증 전 고객 데이터 전송 금지. FreeLLMAPI는 필수 의존이 아닌 실험 후보.
- **Tool registry:** MVP 첫 전문 AI의 실제 작업 도구는 read_project_documents **R0만**. 매 읽기 동일 project_id·document_id·digest·계약/계획 범위 확인. AI 출력은 결코 SQL·CLI·외부 API를 임의 실행하는 권한이 아님.
- **Artifact/Validator:** 모델 출력을 JSON Schema·필수 인용·출처 범위/버전 digest로 검증. 저장은 **신규 비공개 R1 artifact**로만, 기존 PlanOS 원문 덮어쓰기 금지. 기계 근거 검사 PASS와 의미적 정확도·owner 인간 수락은 별도 서버 이벤트.
- **Event/Budget ledger:** append-only audit·usage; 미확정 공급자 원가는 pending reconciliation. 예약/관측/정산/해제 및 실제 고객 청구 이벤트를 혼동하지 않는다.

## 3. 두 종류의 AI 작업/비용: PM 계획과 전문 AI 실행
1. **결정적(비모델) 프리뷰**: owner가 문서 ≥2개와 예산/공급자 고지를 본다. AI 모델/유료 API 실행 금지.
2. **계약 선행**: owner가 PM 계획 생성 비용(발생 시)과 감사 작업 실행 비용을 포함해 문서·전송/보존 목적·허용 도구/상한·만료를 동의한다.
3. **PM plan-generation job**: 실제 모델을 사용한다면 별도의 job category 또는 ai_runs 범용화 여부를 구현 ADR에서 명확히 선택. **계약·PM 예산 예약 이전 호출 금지**. 모델 미연결 시 인간 작성 초안과 생성 UI를 명시적으로 분리한다.
4. **계획 버전 승인**: owner가 source manifest·역할·예상 비용·검증 기준·승인 버전을 고정. 새 입력·가격·약관·도구/공급자 조건이 바뀌면 이전 계획 승인 재사용 금지.
5. **전문 AI 실행**: 서버 202/runId 반환→원자 예약+outbox→워커 재검사→R0 읽기→모델 결과→validator→R1 신규 보고서→awaiting_acceptance→owner 승인/반려/수정.
6. **정산과 브리핑**: 모델 공급자 실제 원가 기록/정산은 승인된 산출물 수락보다 먼저 또는 나중에 일어날 수 있다. 고객 결제/환불은 별도 서비스/약관 확정 전 작동 금지.

## 4. 영속 상태·실패 표
| 상황 | 서버/UX에서 해야 하는 일 | 금지 |
|---|---|---|
| 중복 POST/run 동일 key | 같은 runId·이전 결과 재조회 | 신규 원가 예약·중복 실행 |
| queued 직후 서버 중단 | outbox 아직 미전달이어도 dispatcher가 재발견 | DB 반영 없이 완료 성공 응답 |
| running 중 worker crash | lease 만료·재claim 전 외부 provider 청구 여부 확인, unknown/pending 비용 보존 | 다른 모델을 즉시 무조건 재호출 |
| HTTP 503/클라이언트 타임아웃 | 같은 key로 상태 조회 또는 재시도 안전성 판정 | 중복 요청으로 새 생성 |
| 외부 모델 호출 이후 응답 손실 | provider request id/cost/usage 추적, 불명확한 경우 hold·reconcile | 무료/호출 안 됨으로 가정 |
| 계약 만료/owner 권한 회수 | 추가 tool/model 호출 차단, 가능하면 취소/사용량 처리 | 캐시된 클라이언트 승인 신뢰 |
| 문서 새 버전·삭제/복원 | 고정 snapshot에만 읽기 허용 또는 보류/재승인, stale 명시 | 최신 문서로 조용히 바꿔 분석 |
| 검증 실패/인용 환각 | failed/needs_revision, finding 검증 증거와 실패 이유 보존 | awaiting_acceptance/accepted |
| owner 수정 요청 | 새 attempt/artifact revision, 별도 비용/승인 범위 확인 | 기존 확정 보고서 조용히 overwrite |
| 긴급 kill switch | 신규 claim/모델/도구 실행 중단, 진행 중 사용량 대사 | 로그/비용 증빙 삭제 |

**구조적 불확실성:** 시스템의 데이터베이스 멱등성은 외부 모델 **과금 무중복을 보장하지 않는다**. 공급자가 dedupe key를 지원하지 않는 경우 비용 대사·재시도 제한/추가 승인 필요.

## 5. 저장 데이터·원자적 불변식(구현 전)
- run: project/task/contract/approved plan/revision, actor, stable idempotency key, status/state_version, worker lease owner/until, retry attempt, cancel intent, created/finished, correlation.
- 계약/승인: owner/terms_version·purpose/allowed sources/permissions/provider data policy/budget cap/currency/expiry/plan revision·approval digest.
- 문서 source_manifest: projectId + documentId + document type + pinned document version/content hash + acquiredAt; 같은 프로젝트 복합 FK와 auth gate. 새로운 버전 입력을 기존 승인에 자동 추가 금지.
- 원장/예약: cap·reserved·observed/settled·pending external liabilities의 **중복 없는 집계**; provider_ref와 내부 action ID 별 유니크; append-only adjustment. 통화별 minor 정수. 실제 고객 청구·환불은 별도 불변 이벤트.
- outbox: DB 커밋과 일치하는 일회성 의미의 이벤트 ID, 전달은 **at-least-once**이므로 소비자는 멱등; status_version CAS로 중복 완료 막기.
- 검증/수락: artifactId/version/content digest, source IDs/locators/validation evidence, machine verdict, owner acceptance event. source_validated는 품질 보증이 아님.
- 삭제/보존: 문서/계약 삭제와 원가·감사 로그 보존 충돌은 정책·법무 검토 전 실제 DDL 금지.

## 6. 안전한 PoC·기술 선택 비교 계획
| 결정 | 비교할 항목 | 통과 기준(정량 값은 실측 후 결정) |
|---|---|---|
| Worker host | 상시/예약 실행 적합성, 타임아웃, DB 연결, region, 유휴 비용, 네트워크 | 브라우저 종료 후 1회 작업 완료, worker crash/재시작 복구 |
| Queue | Postgres outbox/lease vs 외부 queue, 중복 전달, TTL/claim 경합, 장애·비용 | 동시 claim 중복 실행 0, dead-letter/재처리 가시화 |
| ModelGateway/provider | 상업 약관/입력 보존·학습/국외 이전, structured output, usage/cost, 툴 호출 지원 | mock first, 승인된 비식별 fixture로 실모델 호출·출처 검사 |
| 비용 원장 | transaction scope, reserve/release/settle, provider callback 지연, 장애 | 동시 예산 초과 0, 공급자 원가 pending 오분류 0 |
| Policy/RLS | owner/editor/viewer/outsider, service_role 우회, 계약 만료/권한 철회 | 타 프로젝트 유출/무단 실행 0 |
| UX·증빙 | P1-3 UX-01~12, AC-01~12/POL-01~12 | 작성된 스펙을 실제 E2E/QA에 연결하고 실패 로그 수집 |

**PoC는 별도 격리 DB·mock provider/fixture에서만**, 실제 운영 project/문서/고객 데이터 사용이나 유료 공급자 키/과금 호출 전 사용자·약관·상한 승인 필수.

## 7. 최종 선택 이전 미결정 레지스터
- ADRD-01 워커 호스트/실행 주기·유휴 비용·비밀/지역; PostgreSQL lease와 전용 큐 실제 선택.
- ADRD-02 PM 모델 계획 job을 기존 ai_runs로 통합 vs 별도 plan_generation_runs 분리, 계획 비용 정책/승인 API.
- ADRD-03 provider/model·데이터 처리/보존/상업 이용·추정 원가/환율/상한.
- ADRD-04 원장 reserve/settle/retry/idempotency/외부 과금 재대사 SQL 경계.
- ADRD-05 tenant/역할/로그·키/Storage/TTL/백업·kill switch 및 운영 runbook.
- ADRD-06 프롬프트 인젝션·출처 검사 기계/사람 성공률, 사용성/법적 고지.
- ADRD-07 계약·계획·승인·실행·검증·수락 GET/POST/OpenAPI 상세와 DB RLS.

## 8. 완료 판정
- [x] 기술 구조·모듈 경계, 비용/승인/원가·멱등, 아웃박스/worker, ModelGateway·도구 책임, 실패/QA·선정 기준 **문서 작성 완료**.
- [ ] 실제 호스트/큐/모델/비용 서비스 선택·검증, 상세 SQL/OpenAPI, 공급자 약관·상용 비용/보존 승인.
- [ ] PoC, real browser, worker crash, actor/RLS, cost reconciliation 등의 실행 테스트(현재 **0건**).
- [ ] 사용자 최종 아키텍처 승인, Phase 0/1 종료, main/운영 DB/배포.

## 9. 서비스기획 v2.0 확장 — 직원 채용·복수 PM/경력 원장 경계 (후속 ADR, 구현 전)

본 ADR의 기존 수직 실행 경로는 첫 전문 AI `requirements_auditor_v1` 검증용이며 **전체 AI 직원 채용/경력/다중 PM 상품의 완성된 기술 구현이 아니다**.

- **직원 vs 모델:** `staff_identity`(역할·성격·검증 경력)과 `model_gateway` provider/model_id를 분리. 실제 직원 채용은 `agent_contracts`와 중복 source of truth가 없는 `staff_engagement + assignment`로 구현.
- **PM 권한:** 여러 프로젝트는 한 PM worker의 계정 전체 스캔 권한이 아니라 각 `project_id`별 계약/owner 명시 배정·멤버·자료 digest·툴 allowlist·예산의 합집합. 집계 쿼리와 실 도구 실행마다 재검증.
- **경력:** run/audit와 별도 event/consent/ledger를 사용해 고객 동의·검증 업무일수·수락 결과·고용주 평가만 적립, 중복일/철회 재계산. 모델 프롬프트에 타 고객의 실제 문서를 경력 메모리로 로딩 금지.
- **승급/요금:** 검증 경력등급과 모델/도구 상품 등급 분리. 현재 계약의 rate_snapshot 불변, 갱신 때만 재견적. 같은 조건 초급 낮은 단가 정책은 원가·고객 수요 실증 후 확정.
- **모델 변경:** GPT/Claude 제공사 간 무동의 자동 fallback/새 고객 원문 전송 금지. 현재 실행 원가/응답 유실 상태, 사용자 동의 및 계약/권한 차이를 재검증.
- **비동기 PM:** 스케줄러/worker가 실제 예약·읽기·쓰기/승인·동의/예산·실패/취소를 기록하지 않는 한 '상시 작업 중'으로 표시 금지.

추가 [DATA_MODEL](DATA_MODEL.md), [API 계약](API_CONTRACTS.md), [위협 모델](../quality/THREAT_MODEL_2026-10-20.md), [통합 서비스기획 v2.0](../product/SERVICE_PLAN_V1_2026-10-20.md), [검증 계획](../quality/TEST_PLAN_2026-10-20.md) 준수. 신규 DB/큐/실모델 연결/운영 DB 변경은 별도 검증과 승인 전 실행하지 않는다.
