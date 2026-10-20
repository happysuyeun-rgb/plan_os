# PlanOS 3.0 — P1-5 API/DB 재감사 및 P1-6 선행 위험 대장

**2026-10-20 · 상태:** 문서 감사·불일치 발견/수정 요구 도출 완료. SQL/서버/CI 실증 없음.  
**비교:** [P1-5 상세 계약](../engineering/AI_API_DB_CONTRACT_P1_5_2026-10-20.md), [기존 API](../engineering/API_CONTRACTS.md), [데이터 모델](../engineering/DATA_MODEL.md), [ADR-002](../engineering/AI_EXECUTION_ADR_002_2026-10-20.md), [MVP 정책](../product/MVP_CONTRACT_APPROVAL_COST_POLICY_2026-10-19.md), [UX](../ux/UX_FLOWS.md).

| ID | 중요도 | 발견한 누락/불일치 | 문서 조치 / 실제 검증 필요 |
|---|---|---|---|
| P5A-01 | P0 | 원본 P1-5는 **모든 변경**에 If-Match 요구. 최초 생성 POST에는 existing version이 없을 수 있음 | 신규 생성은 Idempotency-Key+payload digest·계약/범위 버전, 상태 있는 자원 변경에 If-Match/expectedVersion 적용. 실제 409 분기 테스트 |
| P5A-02 | P0 | `P5-08 POST /api/v1/projects/.../approvals/requests`가 **서버 전용**인데 공개 API 네임스페이스 사용해 클라이언트 오호출 유도 | 내부 policy service 명명/경로 분리, JWT 사용자 경로에서 403/404. 브라우저는 생성된 승인 조회/결정만 |
| P5A-03 | P0 | PM 생성 job을 `ai_plan_generations / ai_runs`로 표기했는데 실제 타깃 스키마·참조·원가 키는 미확정 | 어느 한 모델을 고를 때까지 단일 DDL로 오인 금지. 공통 idempotency/reservation/planVersion 의존성 규정 |
| P5A-04 | P0 | 예약된 비용과 provider observed/pending을 합치면 동일 호출의 **중복 부채 계산** 우려 | reservation 당 obligation coverage·provider event dedupe·remaining available의 원자적 계산 인계; SQL 동시성 테스트 필요 |
| P5A-05 | P0 | 승인 요청 생성/결정/철회의 순서, stale digest, plan 승인 vs artifact 수락이 섞일 위험 | 서버만 요청 생성, owner만 결정, artifact acceptance는 API-22 유일한 기록; RLS/동시 CAS 증빙 필수 |
| P5A-06 | P0 | 복합 project FK에서 parent/child가 서로 다른 프로젝트로 연결될 수 있음 | 복합 FK+UNIQUE(project_id,id) 포함 모든 데이터 전이/RLS 검사. migration 전 실제 DDL·fixture 필요 |
| P5A-07 | P0 | `ai_runs` 행을 실행만 대상으로 쓰는지 PM 비용 job도 포함하는지 결정되지 않은 상태에서 상태 전이 혼동 | P1-6 테스트 계획에는 양쪽 모델 후보의 상태·kill switch·권한·비용 동일 불변식 포함 |
| P5A-08 | P0 | 외부 provider 응답 유실 후 내부 멱등성만으로 **이중 과금 0** 보장 불가 | provider request ID/usage 대사 전 새 호출 보류, 수동 검토/고객 고지·추가 승인 필요 |
| P5A-09 | P1 | 취소와 승인 철회가 워커 처리 직후 교차하는 경합 | 승인·예산·계약을 모델/도구 실행 직전 서버 재검증하고 cancel requested 및 추가 과금 정책 설계 |
| P5A-10 | P0 | R1 아티팩트 저장 전 검증 실패/일부 파일 저장 시 불일치 | 비공개 임시 보관→검증→불변 최종 artifact 상태와 실패 정리/참조 접근 정책; 외부 저장과 DB 원자성 한계 기록 |
| P5A-11 | P1 | 데이터 삭제·휴지통·원본 문서 최신 버전·임시 draft TTL이 보고서 manifest에 미치는 영향 | pinned hash/버전, stale 처리, 삭제·보존/백업 정책/사용자 고지 게이트 유지 |
| P5A-12 | P1 | 재접속 이벤트 cursor/SSE 누락과 로그 redaction, 비정상 로그인 전환 | cursor 안정순서/중복 eventId/permission recheck, URL 공유·직접 API 호출 보안 테스트 |
| P5A-13 | P0 | 위협 모델·권한 회귀·롤백·운영 중단 조건이 P1-5 인계에서 테스트 ID와 연결되지 않음 | P1-6 Threat Model/QA/Runbook 생성, 감사 이슈↔P5T/보안 시나리오 연결 |

**판정:** 13개 감사지적 **문서화**. 스키마/정책/권한/비용 정산 위험은 테스트 PASS로 간주하지 않는다. P1-5A 초안 존재는 완료 유지하되 P1-5B 정확한 OpenAPI/SQL·RLS·인증·상태머신·격리 PoC와 전체 Phase 1 승인은 미완료.

**후속:** [P1-6 Threat Model](../quality/THREAT_MODEL_2026-10-20.md), [QA 계획](../quality/TEST_PLAN_2026-10-20.md), [출시/롤백 런북](../operations/RELEASE_RUNBOOK_2026-10-20.md)로 연결.
