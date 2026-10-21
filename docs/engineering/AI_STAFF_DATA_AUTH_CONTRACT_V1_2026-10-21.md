# PlanOS 3.0 — AI 인력사무소 데이터 모델·권한·API 단일 구현 계약 v1.0

- **기록:** 2026-10-21 / **상태:** Draft PR #28 **설계 기준안**. 설계 내에서 중복안 대신 하나의 방향을 선택했지만 실제 Supabase 스키마/코드, 법적 동의 문안, 요금/배포·상용 승인을 완료했다는 뜻은 아니다.
- **상위:** [서비스기획 v2.0](../product/SERVICE_PLAN_V1_2026-10-20.md), [경력·공개 동의 정책](../product/AI_STAFF_VERIFIED_EXPERIENCE_CONSENT_TIER_PRICING_2026-10-21.md), [화면별 스토리보드](../ux/AI_STAFF_SCREEN_STORYBOARD_V1_2026-10-21.md), [교차 재감사](../quality/PLANOS_FULL_DOC_REAUDIT_V3_2026-10-21.md).
- **기존의 진실 원천:** `projects`, `documents`, `chat_messages`, `document_versions`, `generation_runs` 보존. 현재 DB에 실존하는지/마이그레이션은 기존 `DATA_MODEL.md`의 **정적 확인**이며 운영 적용 증명이 아니다.
- **API 기존 경로:** API-01~23와 P1-5/기획 검수 수직 슬라이스는 보존. 아래 **STAFF-API-01~14**가 새 직원 기능의 정본; 기존 `/v1/hirings`·`/v1/staff` 목록은 **이전 제안 alias, 신규 구현 금지**(기존 실제 endpoint 존재 시 별도 호환 감사). canonical prefix `/api/v1`.
- **정책 기준:** owner 최종 계약·예산·실행·산출물 수락·공개 승인; editor는 허용된 문서/업무/계획 **초안 작업만**. 계약·경력 적립·외부 모델 전송과 포트폴리오 공개를 하나의 동의로 묶지 않는다.

## 1. 설계 선택 로그 — 기존 중복안 중 하나를 정본으로

| ID | 기존 충돌 | **이번 설계 선택** | 실제 확인·승인 대기 |
|---|---|---|---|
| DC-01 | `agent_profiles` vs `staff_identity` 별도 정체성 | **직원 식별자는 기존 `agent_profiles.id`를 우선 단일 `staff_id`로 사용**하고 역할/성향/검증 이력 확장 뷰/필드를 둔다. 성격 프리셋/직무와 고객별 채용 설정은 별도 | 기존 `agent_profiles` 실제 migration 적용 여부, PR25 mock 타입/참조 |
| DC-02 | 프로젝트 단위 `agent_contracts` vs 다중 PM `staff_engagement` | `staff_engagements`는 고객의 **고용 묶음/기간/당시 가격 스냅샷** (청구 주체). `agent_contracts`는 **각 프로젝트별 독립 실행 권한/범위/예산 동의**의 단일 진실 원천. PM 계약 1건에 A/B 두 child 계약이 생김. 동일 실행의 계약 상태 이중 결정 금지 | 정확한 FK/상태/RLS와 기존 SQL 호환 |
| DC-03 | `staff_project_assignment` vs `agent_assignments` | 기존 `agent_assignments`를 **프로젝트 배정의 단일 기준 테이블**로 확장/연결; `(engagement_id,project_id)` unique, project-scoped contract FK 필수. 새 중복 assignment 테이블 금지 | 기존 migration/권한/인덱스 매핑 검수 |
| DC-04 | 직원 일수 1건/project vs 직원 하루 1건 | 작업/동의 근거는 `staff_work_contributions` 프로젝트별 N개로 보존. **공식 경력일수는 직원×KST날짜 별 deduplicated materialized projection**. 철회 후 남은 다른 프로젝트 근거로 재계산; raw 감사와 공개 이력 별개 | KST 서비스 기준일의 상용/글로벌 정책 검증 |
| DC-05 | AI 실력 패키지 vs 경력 등급 혼동 | `experience_tier`(초/중/고: 검증 업무 경력) vs `model_package`/capability evaluation 분리, 직원 모델 이동 시 직무 평가 다시 | 정확한 임계/원가 미확정 |
| DC-06 | PM이 계정 전체 프로젝트에 자동 접근 | **개별 프로젝트 owner의 명시적 opt-in A/B만**; future projects/프로젝트 C 기본 거부 | 조직 위임권 다층 정책 후속 |
| DC-07 | 계약 채용 vs 모델 실행 vs 경력 공개 하나의 승인 | **서로 다른 actor/version/digest 사건**으로 저장; 경력 적립·공개는 기본 미허용 | 법적 동의/개인정보 전송 고지 문안 검토 |
| DC-08 | /v1/hirings vs /api/v1/staff/engagements | `/api/v1/staff/engagements` 정본, `STAFF-API-01~14` 표를 따름 | 기구현된 URL/모의 코드 있으면 호환 adapter 필요 |
| DC-09 | editor가 계획 최종 승인 가능? | 초기 서버 기반 **owner-only** 최종 계약/계획·실행·산출물 수락, 경력 공개. editor는 제안/수정 초안만 | owner 위임 기능 별도 프로젝트 승인 전 |
| DC-10 | F/T 대화 방식이 실제 직원 전문성을 결정 | `persona_version`은 **표현/리딩 정책**, `capability_evaluation`은 실제 능력, `provider/model_id`는 실행 엔진. 경력일은 모델 학습/역량 향상의 대용 지표 아님 | 실모델 출력 동일 과제 QA |

## 2. 관계 모델·자원 분리

```text
auth user/organization ─ projects ─ documents/versions/interview/chat (기존 KEEP)
         │                    │
         └── staff_engagements (채용 묶음/가격 snapshot, one-off/project/pm-multi)
                    ├ staff_id → agent_profiles / persona_configs + capability_evaluations
                    ├ (프로젝트 A) agent_contracts A ← agent_assignments A → project A
                    ├ (프로젝트 B) agent_contracts B ← agent_assignments B → project B
                    └ lifecycle / budget policy / historical price snapshot
               project A/B 별 project_tasks / plans / approvals / ai_runs
                                      └ verified artifacts + acceptance
                                              ↓
                             staff_work_contributions (프로젝트별)
                               + staff_experience_consents (프로젝트별/직원별)
                                              ↓
                             staff_experience_daily (직원×KST날짜 projection)
                               + staff_tier_history / customer reviews
                                              ↓
                          allowlisted public_staff_reference (공개/익명/비공개)
```

**데이터 보안의 핵심:** `staff_id`만 공유된다. 고용주 A 문서/프롬프트/코드/채팅이 새로운 고용주 B의 모델 컨텍스트로 재사용되지 않는다. '동일 AI 직원'이라는 서비스 정체성과 고객 간 공동 지식저장소는 완전히 다른 개념.

## 3. 개체·스키마 불변 계약(논리 모델; DDL 미작성)

| 엔터티 | 필수키·인덱스·불변식 | 접근 |
|---|---|---|
| `agent_profiles` 확장 | UUID `staff_id` (=id), role, display_name, synthetic_character_flag=true, persona_config_version, public_capability_state | 서버 curated 공개 필드만 읽기 |
| `staff_capability_evaluations` | staff_id+provider/model_id+job_type+eval_revision; capability_limits/result/evaluated_at | 서버 검증 결과만 공개; UI 직무/연차 위조 금지 |
| `staff_engagements` | hire_id UUID, purchaser_user_id(또는 org_id), staff_id, hire_type(one_off/project/pm_multi), rate_quote_version, tier_at_hire, price_snapshot_minor/currency, term, status/version | owner 계약 제안/수락; **이용 청구용 source of truth** |
| `agent_contracts` 확장 | id, engagement_id FK, project_id, staff_id, terms_version/digest, model_provider/id/version, tools/digest, doc scope/digest, project_budget_cap, status/version | 프로젝트별 실행 권한/예산·모델 전송 동의의 **source of truth** |
| `agent_assignments` 확장 | project_id, contract_id, engagement_id, staff_id, scope, assigned_at, revoked_at, state_version; `UNIQUE(active engagement_id,project_id)` | 지정한 A/B만 접근, 대기/철회/미래 프로젝트 기본 거부 |
| `staff_experience_consents` | id, hire_id, staff_id, project_id, consent_version; accrual_allowed=false, visibility=private, public_aggregate=false, review_public=false, marketing=false, portfolio=false, effective_at, revoked_at, decided_by, terms_digest | 채용/작업 동의와 **독립**, 고객의 실제 프로젝트 공개 권리 확인. 모델 학습 권한과 절대 묶지 않음 |
| `staff_work_contributions` | id, hire_id, staff_id, project_id, run_id, task_id, source_digest, model_id, event_id, work_time_utc, work_day_kst, validator_ref, outcome_state; `UNIQUE(event_id,staff_id)` | worker server-signed, 프로젝트별 내부 감사. UI 삽입 불가 |
| `staff_experience_daily` | `(staff_id,work_day_kst)` unique, aggregate_eligible_refs_digest, derived_at, ruleset_version; **원본 사실 대신 재계산되는 투영** | 원장 입력 작업 아님, 서버 조건부 view/materialize; 철회 시 재생성 |
| `staff_employer_reviews` | id, hire_id, project_id, staff_id, acceptance_id, reviewer_id, rating?, body?, public_scope, moderation/version; `UNIQUE(hire_id,project_id,reviewer_id,review_context)` | 검증된 계약·사람 수락, 고객 공개 별도. 미응답은 별점 0 아님 |
| `staff_tier_history` | staff_id, tier, ruleset_version, evidence_digest, effective_at, superseded_at, reason | append-only 승급/재평가, 변경은 이전 이벤트 무효화/새 이벤트 |
| `staff_rate_catalog` | role, experience_tier, model_package_id, hire_type, rate_version, effective_from, amount_minor/currency | 가격/공급자 비용/요청 범위 분리, 실제 요금 숫자 미확정 |
| `staff_public_references` | ref_id, staff_id, project_id, consent_id/version, approved_field_projection, visibility, moderation, published_at, withdrawn_at, projection_version | 외부 직렬화에 자유 JSON 금지; 서버 공개 필드 allowlist |
| `staff_publication_jobs` | job_id, consent_version, affected_refs, projection_status, index/cache_status, attempts, last_error | 철회 후 검색/캐시 갱신의 성공·보류·실패 상태. 신속히 공개 접근 차단 |
| `ai_approvals`·`ai_runs`·`ai_acceptances` | 기존 자원 유지; run에 exact project contract/plan/doc digest/model, user acceptance에 artifact revision/digest | 서명/권한/예산·실행 전후 상태 분리 |

**FK·RLS:** `agent_contracts`, `agent_assignments`, `ai_runs`, `ai_artifacts`는 `(project_id, parent_id)` 복합 관계로 **다른 프로젝트의 resource reference 조작을 DB나 서버에서 차단**. 실제 SQL 작성 시 복합 UNIQUE/FK/인덱스 순서를 검증한다. 직원 경력 공개 projection은 프로젝트 문서에 대한 service_role 직접 접근권을 공개 API에 주지 않는다.

## 4. 경력·가격 확정 가능한 설계 계산 규칙

- **활동일 정의:** 채용 기간이 아니라, 검증 상태가 `eligible`인 실제 서버 업무 이벤트가 발생한 **Asia/Seoul 날짜**. 고객의 해당 직원/프로젝트 경력 적립 동의가 유효한 시점·목적에 포함돼야 한다. 적립 동의 전에 수행한 작업을 자동 소급 계산하지 않는다(별도 사후 범위 동의 필요).
- **실행 성공 vs 수락:** 실제 수행/검증 업무 이벤트와 성공적으로 수락된 **완료 프로젝트 수**는 다른 지표. 반려·실패한 결과를 성공 수락 프로젝트로 적립하지 않는다. 유효 실제 활동일을 누가/어떤 기준으로 인정할지는 성과 평가 ruleset으로 기록한다.
- **한 직원 세 프로젝트 A/B/C 같은 날짜:** eligible contributions가 3개면 프로젝트별 3건 유지, 직원 daily projection은 1일. A 적립 동의 철회 시 A를 제외하고 B가 적격이면 여전히 1일. B도 철회하고 C 부적격이면 0일. raw 감사 이벤트는 적법 보존 별도.
- **승급:** 같은 직원 `unique_active_days >= threshold` **AND** 수락한 프로젝트/과업 최소 성과 **AND** 평가 모델/도구별 실제 역량 적합성 시험 통과 **AND** 이상 거래/평가 조작 방지. 초급/중급/고급의 일수 예시는 서비스기획의 **미확정 가설**; 자동 승급/강등 구현 전에 ruleset_version 확정·테스트.
- **등급과 원가:** `experience_tier`는 경력 신뢰 지표, `model_package`는 GPT/Claude 등 성능/도구/요금. 같은 조건에서 초급 직원의 채용 단가는 낮다는 상품 정책 제안. **진행 계약 가격은 price_snapshot으로 고정**, 직원 승급 시 기존 계약 자동 요금 인상 금지.
- **평점:** 검증된 계약 종료/수락 담당 owner만; 리뷰 검수/수정·허위 평가 반증; 공개 여부 별도 동의. 단순 평점 하나로 자동 승급 불가.

## 5. 권한/인가 매트릭스 — 첫 실행 MVP의 단일 정본

| 행위 | owner(해당 프로젝트) | editor | viewer | 내부 worker/AI 직원 | 공개 방문자 |
|---|---|---|---|---|---|
| 기존 AI 인터뷰·문서 생성 | 허용 | 허용 범위 | 열람만 | 새 외부 모델 전송은 계약/범위 승인이 필요 | 비공개 거부 |
| 문서 편집/PM 계획·업무 초안 | 허용 | 허용 | 거부 | 특정 project+scope 초안만(실행승인 대체 불가) | 거부 |
| 직원 검색·공개 이력서 | 공개된 필드 | 공개된 필드 | 공개된 필드 | 업무 목적 내 공개 필드 | 공개 정책상 allowlist만 |
| 고용 묶음 생성/조건·가격 동의 | 해당 owner 허용 | 거부 | 거부 | 거부 | 거부 |
| A/B 프로젝트 PM 명시 배정/해임 | **A·B 모두 owner 확인** | 거부 | 거부 | 스스로 추가·해임 불가 | 거부 |
| AI 모델 공급자/자료 전송 범위 승인 | 해당 owner, 프로젝트별 | 거부 | 거부 | 읽기 제한·새 공급자 자동 우회 금지 | 거부 |
| 작업 계획/유료 AI 실행/외부 변경 최종 승인 | 해당 owner | 초안 작성만 | 거부 | owner 승인·툴권한 내 실행만 | 거부 |
| 사람이 결과 수락/반려 | 해당 owner | 거부 | 거부 | 수락 이벤트 작성 금지 | 거부 |
| 경력 적립 허용·경력/후기/원본·마케팅 공개 | **고객 프로젝트 공개 권리자 owner** | 기본 거부 | 거부 | 직원 스스로 동의 불가 | 거부 |
| 직원별 실제 이벤트/승급/원장 기록 | 직접 임의 입력 불가 | 불가 | 불가 | 서버 서명/검증 워커 전용 | 불가 |
| 고객별 동의 철회·공개 정정 | 원래 권리자 owner | 거부 | 거부 | 권한 차단·정정 실행만 | 거부 |
| 업체/타 프로젝트 데이터 조회 | 스스로 접근 권한 갖는 프로젝트만 | 자기 범위만 | 자기 범위만 | **assignments A/B의 허가된 자료만**, C deny | 공개 필드만 |

**다수 owner 불일치:** 동일 고객 계정이 아닌 조직/공동 소유 프로젝트를 A/B에 함께 PM 배정할 때, 한 프로젝트라도 실제 owner·공개 권리 미확인이면 **전체 일괄 커밋은 원자적으로 실패**하고 누락 프로젝트를 빼서 다시 검토하게 한다. 임의 부분 성공/기본 허용 금지. 팀/조직 위임은 추후 별도 권한 확정 전 차단.

**AI PM의 업무 주도:** 계획/업무 초안·검증된 상태 브리핑은 허용된 read/내부 draft 범위에서 가능하나, PM에게 정식 채용 계약이 있다는 이유만으로 배포/모델 과금/직원 신규 채용/전체 프로젝트 자동승인/미배정 자료 읽기는 허용되지 않는다.

## 6. 계약·승인·자료·공개 상태 머신 (각각 분리)

```text
hire: proposed → pending_owner_review → active → revoking → revoked
                                          └→ expired
contract-per-project: draft → active → revoked/expired (변경 시 새 버전)
assignment: pending → active → revoked/expired (미배정 project 없음)
consent: not_given(default) → granted(versioned) → restricted/revoked (재확장 시 신규 grant)
contract price: quoted(versioned) → accepted_snapshot(frozen) → renewal_quote → newly_accepted
plan: draft → awaiting_approval → approved/rejected/expired (source changed = stale)
run: queued → running → validating → succeeded/failed/cancel_requested/cancelled/blocked_reconciliation
artifact acceptance: pending → accepted/rejected/changes_requested (버전+digest 묶음)
experience contribution: recorded → validated/invalidated → eligible/ineligible
experience/day tier projection: derived → recalculating → current/error (raw 감사 변경 없음)
public ref: withheld(default) → approved → published → withdrawal_pending → withdrawn/error
```

**원자/보안 경계**
1. 고용 활성화와 프로젝트별 배정은 적어도 요청의 모든 프로젝트 권한·계약 조건을 한 번의 일관성 검사로 확정. 실 DB 트랜잭션/유니크/부분 인덱스 검증 필요.
2. owner 계약·모델 전송·예산·승인·source version/digest·provider/model/tool allowlist와 배정 상태를 **run 예약/외부 호출 직전 모두 재검증**. 변경되면 전 계약/승인 재사용 금지.
3. `run` 성공은 `artifact acceptance`와 `experience success`를 자동 승급시키지 않는다.
4. 직원 교체/해임/배정 해제 즉시 신규 작업·외부 tool claim 차단; 실행 중 불명확한 공급자 원가는 `pending reconciliation`.
5. 직원 공개·경력 적립 동의 철회 시 빠르게 공개 읽기 차단, 비동기 materialized/cache/index 처리 상태 추적. 전 고용주 비밀 자료가 후속 고용주 prompt에 재노출되면 안 된다.

## 7. API 단일 정본 — STAFF-API-01~14

**공통:** `/api/v1` prefix, Supabase JWT/owner 서버 검사, `POST`는 `Idempotency-Key`, 변경 `PATCH`는 `If-Match: "<version>"`, 응답 `{data,meta:{requestId,version?}}`와 `{error:{code,message,retryable}}`. 타 프로젝트는 404 masked, 역할 위반 403, 최신성 409, consent/approval 부족 412, 원가 부족 429, provider 503. 실제 API URL 존재 주장이 아니다.

| ID | canonical TARGET 메서드·경로 | 권한/핵심 요청/효과 |
|---|---|---|
| STAFF-API-01 | GET `/api/v1/staff` | 공개 role/persona/experience_tier/provider/model/price filter, 공개 필드만 |
| STAFF-API-02 | GET `/api/v1/staff/:staffId` | 직원 성격·역량·공개 이력서/표본, 기밀 원문 접근 불가 |
| STAFF-API-03 | POST `/api/v1/staff/:staffId/preview` | 샘플 동작; 실모델·원가 발생이면 별도 사전 승인, mock 고지 |
| STAFF-API-04 | POST `/api/v1/staff/engagements` | owner: one_off/project/pm_multi, staffId/projectIds, contract/model package/quote version. 최초 반환은 **draft**(실채용 active 아님) |
| STAFF-API-05 | GET/PATCH `/api/v1/staff/engagements/:hireId/assignments` | owner: 새 projectIds·scope/version, 모든 project owner 권한 검사·원자 성공/거부. worker는 권한 위조 불가 |
| STAFF-API-06 | POST `/api/v1/staff/engagements/:hireId/revoke-or-replace` | owner: 기존 계약/진행 작업 영향 미리 확인→안전 해임·교체/철회, 청구 별도 |
| STAFF-API-07 | POST `/api/v1/staff/engagements/:hireId/consents` | owner: **projectId×staffId×purpose** 기본 거부·signed version; 계약 실행 동의와 분리 |
| STAFF-API-08 | GET/PATCH `/api/v1/staff/experience-consents/:consentId` | owner: 공개/적립/후기 등 목적별 축소·철회, `If-Match`, 비동기 재계산·검색 정정 status |
| STAFF-API-09 | GET `/api/v1/staff/engagements/:hireId/experience-preview` | 해당 고객에게만 실제 verified contribution·공개 후보 미리보기 |
| STAFF-API-10 | POST `/api/v1/staff/engagements/:hireId/reviews` | 실제 고용주+accepted result 검증, review·공개 scope 분리, idempotency |
| STAFF-API-11 | GET `/api/v1/staff/:staffId/tier-history` | 동의된 공개 성과·등급·규칙버전만; 내부 원장 전체 원문 안 보임 |
| STAFF-API-12 | GET `/api/v1/staff/:staffId/price-quote` | role+model package+type+duration 조건의 견적/단가; 미승인 상용 가격 비표시, snapshot |
| STAFF-API-13 | GET `/api/v1/pm/engagements/:hireId/projects` | 개별 project 접근 필터를 통과한 **A/B만** 서버 집계, last-success/blocked/approval facts |
| STAFF-API-14 | POST `/api/v1/pm/engagements/:hireId/plans` | owner/PM 계약 범위: project-scoped plan draft/approval request, 실제 실행은 기존 `API-14~22` 경로/별도 승인 |

**API-04 성공 예시 (목표 DTO, Mock 전용):**
```json
{
  "data": {
    "hireId": "uuid",
    "status": "draft",
    "staffId": "uuid",
    "hireType": "pm_multi",
    "selectedProjectIds": ["project-a", "project-b"],
    "projectContractStates": [
      {"projectId": "project-a", "status": "draft"},
      {"projectId": "project-b", "status": "draft"}
    ],
    "termsDigest": "sha256:...",
    "quoteVersion": "unconfirmed",
    "experienceConsentStatus": "not_given",
    "activeModelCalls": 0
  },
  "meta": {"requestId": "uuid", "version": 1}
}
```

**API-07 consent 예시 (별도 선택, default 미허용):**
```json
{
  "projectId": "project-a",
  "staffId": "uuid",
  "accrualAllowed": false,
  "visibility": "private",
  "publicAggregateAllowed": false,
  "reviewPublicAllowed": false,
  "portfolioAllowed": false,
  "marketingAllowed": false,
  "termsDigest": "sha256:...",
  "expectedConsentVersion": 0
}
```

**API 상세 추가 확인:** 실제 서비스 계약 **accept**·실계약 활성화는 기존 API-11의 프로젝트별 계약 동의와 연계해야 한다. multi project의 경우 기존 단일 프로젝트 API를 BFF 서버가 각 child 계약으로 일관성 있게 수행하게 한다; user API-04 호출만으로 active/실모델 run 실행을 시작하지 않는다. `STAFF-API-06`의 전후 미리보기/확정은 구현할 때 별도 GET/POST 계약으로 분리 검토. 직원 모델 변경은 범위/원가/데이터 전송 재확인, 기존 active contract mutate가 아니라 버전 갱신·재승인.

## 8. DB/JWT/RLS/보안 검증 매트릭스 (실행 전 반드시 테스트)

| 테스트 ID | 준비 | 기대 |
|---|---|---|
| DATAUTH-01 | owner A/B, outsider C 선택/변조 | A/B 배정만 허용, C 동시 제출 전체 실패·C existence leak 0 |
| DATAUTH-02 | editor가 hire/contract/consent/acceptance 요청 | 서버 403/404. 계획 초안 작성은 허용 |
| DATAUTH-03 | PM A/B 배정 후 `project C` 자료 fetch/worker query | C 404·AI 모델 컨텍스트 포함 0 |
| DATAUTH-04 | 동시 배정 제거/프로젝트 삭제/계약 만료·worker 작업 | 새 claim/외부 모델 호출 0, 기존 실행 비용 pending |
| DATAUTH-05 | 동의 미허용/비공개·익명+로고/후기 미승인 | 개별 고객·프로젝트 레퍼런스/배지·평가 공개 0 |
| DATAUTH-06 | same staff A/B on same KST date verified work | 직원 고유 활동 1일·contribution 2건; A 철회 후 B 유지 |
| DATAUTH-07 | 계약 30일 활동 2일 + mock forged event | 경력 ≤2, fixture/위조/대기·구독 일수 0 |
| DATAUTH-08 | 업적 조건·역량 시험 미달 vs 충족·동시 갱신 | 조건 미달 승급 0, 합격 1회·ruleset/proof 남김 |
| DATAUTH-09 | 직원 승급/새 직원 교체/모델 공급자 변경 | 현재 rate_snapshot 불변, 새 공급자 자료 자동 전송 0, 모델별 역량 재시험 |
| DATAUTH-10 | 계약·공개·적립 동의·owner 결과 수락을 한 버튼으로 제출 | 잘못 결합된 동의/승인 거부; 각 목적별 감사 |
| DATAUTH-11 | 문서 autosave+version restore+AI run 계획 승인 경합 | stale 409, 원본/회복초안 보존, 과거 승인 재사용 금지 |
| DATAUTH-12 | 공개 철회/후기 수정·검색색인 오류 | 즉시 공개 API 차단, 캐시/색인 완료/보류/오류 추적, 적립 철회시 등급 재평가 |
| DATAUTH-13 | 이전 고용주의 원문/코드/개인정보를 새 고용주의 같은 직원에서 요청 | 누출 0, staff_id 공유만 허용 |
| DATAUTH-14 | run succeeded + artifact rejected/needs_revision | 성공 프로젝트 건수/고객 수락/승급 서로 독립 |
| DATAUTH-15 | 동일 POST/동의/경력 이벤트 재전송·동시 호출 | 단일 기록/계약·비용, 원장 멱등성 및 감사 연결 |

**실제 검증 미완료:** 현재 SQL/프로젝트별 사용 DB/개발 서버 contract OpenAPI는 아직 구현·연결된 증거 없음. Phase 0 문서/CAS 및 RLS Issue #10/#12/#16이 P0 선행. 운영 DB, 실제 고객 자료 전송, 모델 공급자 연결, 가격·결제, `main` 병합/배포는 **사용자 별도 승인 전 금지**.

## 9. 기술상 남겨야 할 실제 미결정 (설계 가정과 구분)

- 현재 main migrations에 `agent_profiles`/`agent_contracts`/`agent_assignments`가 존재하는가와 PR별 mock/DB 차이, 명칭 `id` 타입·기존 FK/owner 범위 — SQL 정적/격리 재현 이후 확정.
- 가격/경력 임계값·능력 검증 기준·KST 일수 정책/글로벌 경력 표시의 고객 수용도는 사실/법령이 아닌 제품 실험이 필요.
- 조직 공동 권리의 데이터 공개 승인·개인정보 약관·익명 재식별·철회 후 보존/색인 SLA는 법적 검토를 거쳐야 한다.
- 실제 GPT·Claude 공급자의 모델/도구·가격·데이터 이전/보존 계약과 실패시 재시도/모델 route·계약 갱신 정책 확인 필요.
- 사용자 알림/PM 지속 진행·worker 비용 원가와 여러 프로젝트의 우선순위 계산/체크인 빈도는 서버 실증 후 결정.

**설계 내 확정(제안 기준):** ① 기존 프로젝트/문서·AI 기획 KEEP, ② 기존 `agent_` 테이블과 신규 직원 설계를 중복 구현하지 않고 확장, ③ owner-only 실제 채용/최종 승인, ④ 프로젝트별 명시 배정, ⑤ 적립/공개 동의 분리·기본 거부, ⑥ 검증 업무일만 직원별 일수 집계, ⑦ 경력등급과 모델/역량 분리, ⑧ 초급 저가 및 진행 계약 가격 고정, ⑨ 무동의 공급자 fallback 금지. 실제 서비스 상용 정책·법률/가격·DB 변경 확정은 아니다.
