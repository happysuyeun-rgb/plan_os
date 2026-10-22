# PlanOS 3.0 — 데이터 모델 명세 (TARGET)

**최초 작성일:** 2026-10-16  
**최종 수정일:** 2026-10-21  
**문서 버전:** v0.3 (TARGET 직원 스키마 단일화 및 실제 main SQL 경계)  
**진행 상태:** 설계 정합성 1차 보완 / SQL 작성·적용·실 DB 검증 전  
**기준:** [PRD](../product/PRD.md) · [권한 정책](../product/PERMISSIONS_POLICY.md) · [AI 아키텍처](ARCHITECTURE.md)  
**증빙:** GitHub `main`의 `supabase/migrations/001~008` 정적 확인. 실제 운영 DB 적용 상태는 미확인.

## 1. 설계 결정
- **KEEP:** 기존 `users`, `projects`, `documents`, `document_versions`, `project_members`, `chat_messages`, `project_activities`, `generation_runs`, `project_comments`, `comment_reactions`, `comment_participant_status`, `user_notifications`.
- **NEW:** AI 역할, 계약, 배치, 계획, 사람/AI 공통 업무, 승인, 영속 실행, 도구 호출, 산출물, 검증, 수락, 예산/사용 원장, 아웃박스.
- **주의:** 기존 `generation_runs`는 `status IN ('running','completed','cancelled','failed')`의 문서 생성용 실행 이력. 신규 영속 실행 `ai_runs`와 **분리**한다. 검증 전 기존 테이블 이름 변경·데이터 마이그레이션 금지.
- **단일 프로젝트 키:** 신규 프로젝트 소속 엔터티는 `project_id`를 소유하며, 관련 FK가 다른 프로젝트를 가리키지 못하도록 **복합 FK/트리거 또는 서버 검증 + DB 제약**을 설계한다.
- **서버 권한:** RLS + 제한된 서비스 역할/API 정책 검사. service_role은 RLS 우회 가능하므로 사용자 입력을 그대로 신뢰하지 않는다.

## 2. CURRENT 스키마 사실표

| 테이블 | 실제 주요 컬럼(정적 확인) | 보존·주의 |
|---|---|---|
| `projects` | id, user_id, title, deleted_at, deleted_by | user_id는 소유자. 삭제/복원 권한 구분 |
| `project_members` | id, project_id, user_id(nullable), email, role, status | role owner/editor/viewer, status active/pending. 초대 pending은 접근 금지 |
| `documents` | id, project_id, type, content, updated_at | `unique(project_id,type)`, type은 기존 마이그레이션에서 확장됨 |
| `document_versions` | id, document_id, version_number, content | 과거 버전 변조 차단 검토 |
| `chat_messages` | id, project_id, document_id, role, content | 신규 AI 실행 로그와 구분 |
| `generation_runs` | id, project_id, status, completed_steps, interview_answers | 기존 문서 생성 흐름 유지 |
| `project_comments` | id, project_id, document_id, user_id, body, status | 작성자 수정 정책 점검 |
| `comment_reactions` | id, comment_id, user_id, emoji | 사용자 본인 변경만 허용 필요 |
| `comment_participant_status` | thread_root_id, user_id, status | 사용자 본인 변경만 허용 필요 |
| `user_notifications` | id, user_id, project_id, actor_id, read_at | 수신자/프로젝트 정합성 검증 필요 |

**RLS 정적 위험:** `006_member_project_access_rls.sql`의 project_members SELECT 자기참조, 댓글 UPDATE의 넓은 접근, reactions/participant_status `FOR ALL` 권한 범위, generation_runs 전체 CRUD. `007_user_notifications.sql`의 알림 수신자 멤버십 검증 누락 가능성. **실 DB 재현 전까지 취약점 확정 아님.**

## 3. TARGET 신규 엔터티

| 엔터티 | 핵심 컬럼(개념) | 무결성·권한 조건 |
|---|---|---|
| `agent_profiles` | id, slug, name, role_type, status, description, verification_level | 공개 프로필, 실제 capability만 게시 |
| `agent_capabilities` | id, agent_id, tool_key, risk_level, verified_at, constraints_json | 허용 도구 allowlist, 역할별 버전 |
| `agent_contracts` | id, project_id, agent_id, created_by, terms_version, scope_json, allowed_tools, budget_cap_minor, currency, status, expires_at, accepted_by, accepted_at | owner 동의 전 active 금지, 계약 조건 불변 스냅샷 |
| `agent_assignments` | id, project_id, contract_id, agent_id, status, assigned_at | 계약과 프로젝트 일치, 활성 계약만 실행 |
| `project_plans` | id, project_id, version, objective, status, created_by, approved_by, approved_at | 계획 버전 고정, 승인 후 수정은 새 버전 |
| `project_tasks` | id, project_id, plan_id(nullable), title, objective, assignee_kind, assignee_id, status, acceptance_criteria_json, created_by | 사람/AI 공통, 프로젝트 내 FK 검증 |
| `task_dependencies` | project_id, task_id, depends_on_task_id | 동일 프로젝트, 자기 의존/순환 금지 |
| `ai_runs` | id, project_id, task_id, contract_id, plan_id, status, idempotency_key, lease_owner, lease_expires_at, attempt, cancel_requested_at, created_at, finished_at | 브라우저와 무관한 영속 상태, 상태 버전/CAS |
| `ai_run_events` | id, project_id, run_id, event_type, actor_kind, actor_id, payload_redacted_json, trace_id, created_at | append-only, 로그 민감정보 마스킹 |
| `ai_tool_calls` | id, project_id, run_id, tool_key, risk_level, input_digest, approval_id, status, external_idempotency_key, result_ref, started_at, finished_at | R2/R3 승인, 외부 부작용 중복 방지 |
| `ai_approvals` | id, project_id, run_id(nullable), task_id, requested_by, action_type, target_digest, risk_level, estimated_cost_minor, status, expires_at, decided_by, decided_at | 만료/철회/대상 변경 시 실행 차단 |
| `ai_artifacts` | id, project_id, run_id, task_id, kind, storage_ref, content_digest, version, created_at | 저장 위치·버전·소유 프로젝트 명확 |
| `ai_artifact_verifications` | id, project_id, artifact_id, validator_key, status, evidence_ref, checked_at | 검증 통과와 사용자 수락 구분 |
| `ai_acceptances` | id, project_id, artifact_id, accepted_by, decision, note, created_at | 인간 승인만 수락 처리 |
| `ai_budget_reservations` | id, project_id, contract_id, run_id, currency, reserved_minor, settled_minor, status | 원자적 예약/해제/정산 |
| `ai_usage_ledger` | id, project_id, run_id, reservation_id, entry_type, amount_minor, currency, provider_ref, created_at | append-only 원장, 중복 provider_ref 방지 |
| `ai_outbox_events` | id, project_id, aggregate_type, aggregate_id, event_type, payload_ref, delivered_at, attempts | DB 커밋 후 큐 전달 복구 |

**금액:** `*_minor`는 통화 최소 단위의 정수. KRW는 1원, USD는 센트 등 통화별 정의를 서버에 둔다. 크레딧은 별도 단위/원장으로 설계해야 하며 섞지 않는다.

## 4. 주요 관계와 제약
- `projects.id` 1:N `agent_contracts`, `project_plans`, `project_tasks`, `ai_runs`.
- `agent_profiles.id` 1:N `agent_capabilities`, `agent_contracts`.
- `agent_contracts.id` 1:N `agent_assignments`, `ai_runs`; 계약·실행의 `project_id` 동일성 강제.
- `project_tasks.id` 1:N `ai_runs`, `task_dependencies`; 계획 버전·작업·계약의 프로젝트 일치 강제.
- `ai_runs.id` 1:N `ai_run_events`, `ai_tool_calls`, `ai_artifacts`, `ai_usage_ledger`.
- `ai_artifacts.id` 1:N `ai_artifact_verifications`; `ai_acceptances`는 승인 이벤트 불변 기록.
- **유니크 제안:** `ai_runs(project_id, idempotency_key)` (현재 명세의 컬럼으로 일치; 요청 종류별 범위가 필요한 경우 `action_scope`를 별도 정의한 뒤 복합키로 확장), `project_plans(project_id, version)`, `ai_tool_calls(run_id, external_idempotency_key)` (nullable·외부 제공자 별 멱등성 충돌 정책은 별도 검토). 실제 DDL 전 PK/FK/UNIQUE/부분 인덱스 검증 필요.
- **불변성:** 계약 수락 시 terms 스냅샷, 승인 대상 digest, 사용 원장/감사 이벤트, 완료된 검증 기록은 직접 UPDATE 금지. 변경은 새 버전/상쇄 이벤트.
- **동시성:** `state_version` 기반 compare-and-swap; 예산 예약과 run 생성은 원자적 트랜잭션/아웃박스.
- **삭제:** 외래키 cascade로 비용·감사 증빙을 실수로 삭제하지 않도록 프로젝트 삭제/보존/익명화 정책 확정 전 실제 DDL 금지.

## 5. 데이터 소유·접근 매트릭스

| 자원 | owner | editor | viewer | 서버 워커 |
|---|---|---|---|---|
| 프로젝트/문서 | 읽기·쓰기 | 읽기·허용 쓰기 | 읽기 | 계약/작업 범위 내 |
| 계약·배치 | 관리 | 조회 제한 | 조회 제한 | 검증용 읽기 |
| 계획·업무 | 승인·관리 | 초안/업무 편집 | 읽기 | 허용 작업 상태만 |
| AI 실행/도구 호출 | 읽기·승인/취소 | 허용 조회 | 요약 조회 | 특정 run 이벤트 기록 |
| 승인 | 결정 | 명시적 위임 없으면 결정 불가 | 읽기 제한 | 승인 상태 검증만 |
| 비용 원장 | 읽기·설정 | 최소 필요 요약 | 거부 | append-only 기록 |
| 검증/수락 | 수락·반려 | 문서/계획 초안만, 최종 수락 불가(초기 MVP) | 읽기 | 검증 이벤트만 |

**테넌트 차단:** API 조회와 RLS 모두 `project_id` 및 역할을 확인. 내부 service_role 요청은 별도 정책 계층에서 검증.

## 6. 단계별 데이터 변경 전략
1. **Phase 0:** 현재 마이그레이션 순서/정책/실 DB 적용 버전 확인, 개발 DB에서 owner/editor/viewer/outsider RLS 재현. **운영 DB 수정 금지**.
2. **Phase 1:** 테이블 이름·FK·RLS·상태 전이·보존 정책 확정, `EXPLAIN` 및 인덱스 검토, SQL 초안 작성.
3. **Phase 2:** 사람 업무/계획 최소 테이블 추가, 기존 문서 API 회귀 검증.
4. **Phase 3:** 계약·승인·영속 실행·아웃박스·원장 추가, 장애/동시성 테스트.
5. **Phase 4~5:** PM·인력사무소 연결. 기존 `generation_runs`의 자동 마이그레이션은 기본 제외.

## 7. 2026-10-16 교차 감사 보완사항
- **수정(DQ-06):** 존재하지 않는 `action_scope`를 바로 UNIQUE에 넣던 불일치를 현재 정의된 `(project_id,idempotency_key)` 후보로 정리. API 요청 단위에서 scope가 추가로 필요하면 컬럼부터 명세하고 테스트한다.
- **미해결(DQ-09):** 실행 비용은 프로젝트/계약/실행 단위 상한의 동시 예약 경쟁과 환불/보상 이벤트를 함께 설계해야 한다. `ai_usage_ledger` 직접 UPDATE 금지, 원장 중복 처리 테스트 필요.
- **미해결(DQ-04):** 승인 요청의 대상(payload digest), 계약 스냅샷의 변경 불가 원문·버전 보존, 변경 시 새 계약/재승인 정책을 구체적인 DDL로 옮겨야 한다.
- **미해결:** 계약·작업·실행·승인·산출물에 동일한 `project_id`가 유지되도록 복합 FK/서버 트랜잭션 중 어떤 조합으로 강제할지 선정한다.

### 2026-10-19 문서 스냅샷·비용 승인 계약 미구현 보완
- **보고서 입력 스냅샷:** document_id / project_id / 고정한 문서 버전 또는 digest / 서버 읽기 시각 / 선택한 소스 범위 / origin 문서 타입과 run·artifact ID 관계. 실제 원자적 snapshot capture, 변경 시 409, 감사 중 stale label 등은 상세 SQL/REST 설계가 필요하며 기존 documents.updated_at 하나로 충분하다고 단정하지 않음.
- **R0/R1 자원 분리:** 전문 역할의 문서 읽기는 read-only policy, artifact 서비스는 새로운 비공개 ai_artifacts로만 write. 기존 문서 직접 PATCH 허용하지 않음. 신규 artifact의 project/run/task 복합 FK·Storage RLS/서명 URL 검증 필요.
- **비용 원장:** AI PM 계획 생성 예산/공급자 원가와 전문 AI 실행 예약/원가를 모두 포함하고 고객 청구/환불은 별도. 공급자 응답 유실·실제 과금 지연 시 pending으로 보존, 동일 provider_ref 중복 집계 금지. 정확한 원가·상한 SQL 수식/국외 전송·retention은 미정.
- **인간 수락:** ai_artifact_verifications의 machine PASS != ai_acceptances의 owner accepted. 비위임 editor/viewer는 신규 최종 수락/검증 행 위조 불가. [P1-2 정책](../product/MVP_CONTRACT_APPROVAL_COST_POLICY_2026-10-19.md).

### 2026-10-20 P1-5 상세 DB 계약 참조
- [P1-5 API·DB 상세 계약](AI_API_DB_CONTRACT_P1_5_2026-10-20.md)에서 audit draft, 비동기 plan generation, run/outbox+예산예약 원자성, 복합 프로젝트 FK·상태 CAS·idempotency, providerRef 원가 대사/비공개 artifact 검증·사람 수락을 정의.
- 원본 모델의 ai_runs/plan generation 중복 선언은 통합/분리 **미결정**이며 실제 DDL 스키마·이력 보존·SQL/RLS 실증 전 새 migration 작성/실행 없음.

## 8. 미결정·검증 체크
- [x] CURRENT 실제 SQL 기반 테이블/컬럼 구분
- [x] TARGET 신규 엔터티·관계·불변성·원장 개념 정의
- [x] 기존 `generation_runs`와 신규 `ai_runs` 분리
- [ ] 실제 DB 스키마/마이그레이션 적용 상태 확인
- [ ] RLS 재현 및 개선안 검증
- [ ] 보존/삭제·통화·과금/정산·상태 전이 확정
- [ ] SQL DDL·마이그레이션·API 구현/테스트

## 변경 이력
| 날짜 | 버전 | 변경 | 상태 |
|---|---|---|---|
| 2026-10-16 | v0.1 | CURRENT 스키마 대비 TARGET 데이터 모델·무결성·권한·단계적 변경 전략 | 검토 전 |
| 2026-10-16 | v0.2 | DQ-06 유니크 키 불일치 정리, 승인·원장·FK 데이터 무결성 후속 검증 명시 | 검토 전 |



## 2026-10-21 직원 스키마 정합화 — 실제 SQL 확인 + 단일 TARGET 모델

> 데이터·권한·API **정본**: [AI 직원 데이터·인가 구현 계약 v1.0](AI_STAFF_DATA_AUTH_CONTRACT_V1_2026-10-21.md). 이전 staff_identity/staff_project_assignment/staff_experience_ledger 후보 표는 독립 DB CREATE 지시가 아니다.

### 실제 main DB migration의 확인 범위

- 2026-10-21 GitHub main 커밋 `3e3fc66018067e009e95fa9b7917bad87fb38499`의 supabase/migrations 파일은 001~008, 011, 012. 001/011/012의 CREATE TABLE을 직접 확인.
- **아직 SQL CREATE TABLE이 없는 목표 객체**: agent_profiles / agent_contracts / agent_assignments / staff_engagements / staff_work_contributions / staff_experience_daily / staff_tier_history / ai_runs. 앞의 TARGET 3절 표는 기구현/운영 반영 근거가 아니다.
- 011 project_tasks와 012 audit_source_manifests는 GitHub SQL 파일에 **운영 적용 전 검수 경고**. 실제 hosted DB 마이그레이션 적용 여부는 별도 증빙이 필요.

### TARGET 구현 이름·관계 정본 (SQL 미작성)

| 이전 중복 명칭 | 선택한 단일 개발 객체 | 불변식 |
|---|---|---|
| staff_identity | agent_profiles (id = staff_id) | 글로벌 직원 캐릭터/직무·가상 정보. 고객 문서/개인정보 기억 저장 금지 |
| staff_project_assignment | agent_assignments | engagement_id + project_id 각각 승인 배정, 미래 프로젝트 자동 포함 거부 |
| staff_engagement | staff_engagements | 고용주별 계약/기간·가격 snapshot을 소유하는 채용 묶음. 단일·다중 프로젝트 모두 허용 |
| 직원별 실제 프로젝트 실행 권한 | agent_contracts | staff_engagements에 속한 **프로젝트별** terms/scope/digest/예산 계약 |
| staff_work_event/verified_work_event | staff_work_contributions | 프로젝트·직원·run 별 실제 검증 이벤트, 서버 전용·중복 방지 |
| staff_experience_ledger / day counter | staff_experience_daily | unique staff_id + work_day_kst **projection**. 근거 contribution의 동의가 철회되면 다시 계산 |
| staff_experience_consent | staff_experience_consents | 프로젝트×직원×목적/버전, 기본 적립 거부·공개 비공개, 공개와 모델 데이터 전송 분리 |
| staff_tier_history / rate / reviews | staff_tier_history + staff_rate_catalog + staff_employer_reviews | 실제 일수/수락/역량 검증, 현재 계약 등급·가격 동결 |
| staff_public_reference | staff_public_references + staff_publication_jobs | 동의된 허용 공개 필드/익명화·철회·검색 캐시 정정 |

**직원 다중 프로젝트:** 고객이 A/B를 선택해 채용할 때 STAFF-API-04는 draft, owner의 STAFF-API-15 최종 수락과 연결된 하위 계약/배정만 active. A의 owner가 B에서는 editor뿐이면 다중 배정 전체 거부. 사용자 권한/직원 접근/프로젝트별 원문·예산/실행 승인/RLS 재검증.

**경력:** A/B에서 같은 날 실제 검증된 작업이라도 직원 고유 활동일은 1일; A 프로젝트 적립 철회해도 B 적격이라면 해당 일수 유지. 비공개 고객 자료/AI 직원 가상 인물 배경·실제 모델 품질/가격 등급은 서로 독립. 경력 적립 허용 자체가 다른 고객의 모델 학습/프롬프트 재사용 허가가 아니다.

**권한:** 초기 owner만 채용·계약/유료 실행·계획/결과 최종 승인·경력 등록/공개. editor는 문서·계획·업무 초안 작성만 가능. worker service_role의 RLS 우회 가능성을 무시하지 않고 서버에서 재검증.

**검증/운영:** G1 autosave·복원 CAS 및 project_members RLS 문제 해결, draft migrations 009~017과 011/012의 번호/의존/적용 상태 확인, SQL FK/유니크/RLS 설계→격리 DB·JWT·브라우저 검증 후 별도 승인 전 실운영 DB/모델/과금/배포 금지.
