# PlanOS 3.0 × AI 인력사무소 — 서비스기획 v2.0 설계서 누락·불일치 교차검수 (2026-10-21)

- **기준 브랜치:** `docs/planos-ai-staff-pm-hiring-20261021`, Draft PR #28 (현재 `main` 기준선의 제품/운영 변경 아님)
- **검수 목표:** 기존 AI 기획 유지, AI 직원 직무·F/T 성격·GPT/Claude 등 모델/역량 독립, 기본 직원 교체·단발/정식 채용, PM 1개/복수 프로젝트 진행, 채용/종료 시 고객 공개 동의, 검증 실경력일수·평가·승급·등급별 가격까지 **서비스→UX/TF→권한/데이터/API/ADR→QA** 일관성 확인
- **상태 표기:** `DOC_UPDATED` 문서 계약 추가/충돌 수정; `DESIGN_PENDING` 미결정 상세; `CODE_PENDING` 구현 없음; `QA_PENDING` 실제 테스트 안 함. 하나라도 `DOC_UPDATED`라고 제품 동작 완료 아님.
- **검수 자료:** [서비스기획 v2.0](../product/SERVICE_PLAN_V1_2026-10-20.md), [PRD](../product/PRD.md), [기능정의서](../product/FUNCTIONAL_SPEC_V1_2026-10-20.md), [운영정책](../product/SERVICE_OPERATIONS_POLICY_V1_2026-10-20.md), [직원 명세](../product/AI_STAFF_PERSONA_MODEL_HIRING_SPEC_2026-10-21.md), [경력 동의 명세](../product/AI_STAFF_VERIFIED_EXPERIENCE_CONSENT_TIER_PRICING_2026-10-21.md), [IA](../ux/IA.md), [화면명세](../ux/SCREEN_SPEC.md), [업무흐름](../product/TASK_FLOWS.md), [UX_FLOWS](../ux/UX_FLOWS.md), [데이터 모델](../engineering/DATA_MODEL.md), [API 계약](../engineering/API_CONTRACTS.md), [구현명세](../engineering/MVP_BUILD_READY_SPEC_2026-10-20.md), [권한정책](../product/PERMISSIONS_POLICY.md), [ADR-001](../engineering/ARCHITECTURE.md), [ADR-002](../engineering/AI_EXECUTION_ADR_002_2026-10-20.md), [위협모델](THREAT_MODEL_2026-10-20.md), [QA 계획](TEST_PLAN_2026-10-20.md), [통합실행계획](../plans/PLANOS_INTEGRATED_EXECUTION_PLAN_2026-10-21.md).

## 1. 총괄 판정

**서비스기획서 v2.0 본문은 18개 장으로 전면 재작성됨.** 고객/가치·기존 AI 기획·직원 유형/선택·다중 PM·경력 공개 동의·실경력일·초급 저가/승급·시나리오·실행/보안·검증/지표·미결정 대장까지 존재. **이전 v1.0의 부분 수정 상태와 구별.**

**설계 정합화는 누락된 주요 목표 계약을 추가했지만 최종 구현 준비는 아님.** ID/DTO/DB 제약/법률·원가·모델 실제 지원·RLS/CAS/브라우저 검증/기존 기획 E2E가 남아 있다. 이전 독립 문서 v0.x 내용은 역사적 설계이므로 '이후 v2.0 보정'이 우선하지만, 이를 모두 실제 구현 코드로 적용했다는 뜻은 아니다.

## 2. 누락/불일치 결함 대장 (상위 P0→P1)

| ID | 우선 | 기존 불일치/누락 | 수정 문서·조치 | 현 상태/실행 차단 |
|---|---|---|---|---|
| V2-01 | P0 | '직접 기획'을 사람 혼자 수작업하는 Solo로 해석한 부분 | 서비스기획 v2, PRD, IA/화면·TF 보정. 기존 AI 인터뷰·5종 산출물/채팅 KEEP | DOC_UPDATED, 기존 src/ 전체 E2E QA_PENDING |
| V2-02 | P0 | 직원의 성격/직무/검증 경력등급/모델/도구/채용형태를 하나의 AI '역할'로 혼합 | 직원 상세 명세 + 화면 N24/25 + 기술 DATA/API 추가, 각각 독립 필드/검증 | DOC_UPDATED, 모델/툴 capability 증빙 DESIGN_PENDING |
| V2-03 | P0 | 단발 기획서 검수 1건이 전체 직원 채용·정식 PM 제품으로 혼동됨 | PRD/구현명세/최초 역할 문서에 '첫 실증 수직 슬라이스' 명시 | DOC_UPDATED, 실제 직원 채용 CODE_PENDING |
| V2-04 | P0 | 정식 PM 1개/복수 프로젝트 배정·변경/철회/통합 리딩 화면/권한 부족 | IA N27/29·화면·TF-S04/07/12·DATA assignment·API STAFF-05/13/14·ADR 보정 | DOC_UPDATED, 다중 PM 서버/스케줄러/RLS CODE+QA_PENDING |
| V2-05 | P0 | 직원별 프로젝트 참여 경력 **적립**과 개별 프로젝트 **공개** 동의 혼동 | 직원×프로젝트별 동의 N28/TF-S05, 기본 미허용·공개/익명/비공개·추가 목적 분리 | DOC_UPDATED, 고객 권리·법률·철회/보존 승인 DESIGN_PENDING |
| V2-06 | P0 | 계약기간 경력일수 부풀리기, 동일날 복수 프로젝트 중복·고객 적립 철회 시 재계산 누락 | 검증 작업 이벤트+직원 고유 활동일수 ledger/consent/수락·tier 규칙, TF-S09/10·DATA 제약 초안 | DOC_UPDATED, 시간대·부분일·요건 확정/DB/QA_PENDING |
| V2-07 | P0 | 등급=사용 GPT/Claude 모델 능력/가격이라고 오해할 위험, 초급 저가·승급 계약 가격 정책 미연결 | 경력등급 vs 모델/툴 패키지 독립, 상대 가격·rate_snapshot·갱신 동의/재평가 UI/API | DOC_UPDATED, 실제 품질 시험/원가·요금 DESIGN_PENDING |
| V2-08 | P0 | PRD의 '동등 조건 외부 공급자 자동 대체'와 사용자 모델/데이터 동의 충돌 | PRD에서 **미동의 다른 제공사 자동 fallback 금지**로 변경, ADR/권한 보정 | DOC_UPDATED, 공급자별 consent/provider gateway QA_PENDING |
| V2-09 | P0 | 기존 권한표 editor=조건부 최종 승인(C) vs 운영정책 owner-only | PERMISSIONS_POLICY 3개 행 editor D, 초기 owner-only로 수정. 계획 초안 편집과 최종 승인 구분 | DOC_UPDATED, 실제 API/RLS 승인 거부 QA_PENDING |
| V2-10 | P0 | 동일 AI 직원이 여러 고객을 수행할 때 직원 경력/평가 공유와 고객 기밀문서 컨텍스트 공유 혼동 | DATA·API·ADR·위협모델에서 global staff_id와 tenant-scoped run/컨텍스트/공개 프로필 분리 | DOC_UPDATED, 서비스 role/RLS/퍼블릭 projection 보안 QA_PENDING |
| V2-11 | P0 | 직원 교체·PM 해임·동의 철회시 진행중 실행/비용·인수인계·승인 stale 범위 누락 | 화면 N26/N32, TF-S11/12, API 계약·MVP H2/H7·TM-16,19로 안전 중단/정정 경로 추가 | DOC_UPDATED, worker/DB 경쟁·취소/정산 QA_PENDING |
| V2-12 | P0 | 원래 S1~S7 저장/CAS·문서 revision 불안정 상태에서 새 직원이 기존 문서를 변경할 위험 | 통합계획 G1 데이터 유실/복원/RLS 문제 차단 유지, staff 작업 전 명시적 snapshot/digest/승인 | 기존 P0 CODE+QA_PENDING, 새 기능과 독립 병행 Mock만 허용 |
| V2-13 | P1 | 직원 상세/채용/PM 운영/경력/공개·철회 화면이 IA/화면/TF 2026-10-16 설계에 전혀 추적되지 않음 | IA N24~32, 화면별 수용, TF-S01~12, 초기 UX_FLOWS 확장 참조 | DOC_UPDATED, URL·실 UI/모바일 접근성 DESIGN+CODE_PENDING |
| V2-14 | P1 | 데이터/API 기술 문서에 직원 ID·engagement·assignment·career ledger·review·price version이 없음 | DATA_MODEL 9절 + API_CONTRACTS 11절 + MVP H1~H7 추가 | DOC_UPDATED, 실 DB 컬럼/RPC/OpenAPI·기존 계약 중복 해결 DESIGN_PENDING |
| V2-15 | P1 | 기존 AI 사람/직무 가상의 경력 설정과 검증된 프로젝트 경력 혼동 위험 | 공개 이력서·동의된 레퍼런스·가상 직원 배경/모델 역량 배지 분리 | DOC_UPDATED, 실측·마케팅 문구 검증·평가 표본 DESIGN_PENDING |
| V2-16 | P1 | 실제 기본 제공 AI PM 무료/유료 범위, 처음 선택 UX vs 정식 PM 고용 범위 미정 | 서비스기획 DEC-02/09·직원 계약 비교 화면에서 '모의/실제'·가격 불명확 표시 | **DESIGN_PENDING**: 지원 모델/원가/무료 제공 한도 승인 필요 |
| V2-17 | P1 | 코드/서비스 공통 상태 혼동: PM 계획 생성/AI 실행/사람 수락/직원 채용·경력 적립을 단일 status로 다룰 위험 | 기능/화면/기술 명세에서 각 리소스 별 상태·독립 승인 이벤트 유지 | DOC_UPDATED, 실제 DTO/enum/OpenAPI 일치 검증 QA_PENDING |
| V2-18 | P1 | 문서 자체 버전/파일명, 구문서 상태·옛 PR 기준 혼재 | `SERVICE_PLAN_V1_2026-10-20.md` 경로를 링크 호환 위해 유지하면서 제목은 v2.0; 최초 역할 문서의 PR #1 main 상태 바로잡음 | DOC_UPDATED 일부, 구문서 stale 메타데이터 및 링크 전수 재검수 DESIGN_PENDING |

## 3. 화면/기능/API/데이터 추적 매트릭스

| 고객 행동 | 서비스/기능 | 화면·업무 흐름 | 데이터·API | QA 증빙 상태 |
|---|---|---|---|---|
| 기존 AI로 기획 시작·수정 | STAFF-01 E-01/02 | C06/C09/C10, TF-S01 | 기존 project/doc/chat, 저장 CAS | 코드 회귀 미확인 |
| 직원 타입/성격/등급/모델 비교 | STAFF-02 E-03/04 | N24/N25, TF-S02 | staff_identity/model capabilities, STAFF-API-01~03/11/12 | E2E 미실행 |
| 기본 직원 교체·일회 의뢰·정식 채용 | STAFF-03 | N26, TF-S03 | engagement + assignment, STAFF-API-04/06 | 미실행 |
| PM에게 A/B 배정, C 미배정 | STAFF-04/05 | N27/N29, TF-S04/07 | staff_project_assignment, STAFF-API-05/13/14 | JWT/RLS/QA 미실행 |
| 채용시 직원별 경력 적립/공개 동의 | STAFF-08/11 | N28, TF-S05 | consent version, STAFF-API-07/08 | EX-01/02 미실행 |
| 직무별 실행·문서 결과 수락 | F-501~603 | N11/12, TF-S06/08 | ai_runs, snapshot/approval, ledger 원장과 별개 | 기존 G1/G2 P0 |
| 평가·고유 활동일수/승급·후기 | STAFF-09/10 | N30/N31, TF-S09/10 | verified_work_event, experience_ledger, reviews, tier history, STAFF-API-09~12 | EX-05~14 미실행 |
| 공개 철회/직원 해임 | STAFF-03/11 | N32/N26, TF-S11/12 | staff_public_reference/consent/assignment revocation, STAFF-API-06/08 | 캐시·API/DB QA 미실행 |

## 4. 디자인/구현 전에 추가 결정해야 할 사항(임의 확정 금지)

1. **기본 직원과 유료 정식 PM의 구분**: 기본 AI 기획에 어디까지 PM형 행동이 포함되나? 기본 제공 무료/유료 제공량, 한 프로젝트 vs 다중 운영 한도를 실제 원가와 비교해 확정.
2. **경력과 실무 역량 표시**: 동의된 활동 일수는 인간 실무 연차나 모델 파라미터 학습을 뜻하지 않는다. 검증 경력 등급과 공급자 모델/도구 수준/지원 범위는 독립.
3. **일수 계산**: 기준 시간대/작업량 최소 기준/동시 다중 고객/취소·지연·반려·철회 결과/입증·분쟁 처리.
4. **프로젝트 데이터 공개 권한**: 개인/법인/팀 멤버 저작권·브랜드/비식별 재식별 위험과 철회 후 색인·백업 보존 정책/고객 고지.
5. **가격**: 초급 < 중급 < 고급 상대 원칙만 확정 방향. 원가·동일 모델/툴·기간·계약 종류·활동량/모델 호출을 분리해 실제 금액/환불/세금/청구 시점 검증.
6. **실제 GPT/Claude 구성**: 공급자 API/툴 호환·모델 가격/약관/고객 데이터 처리 계약 확인 전 모델 변경/실모델 호출 금지.
7. **직원 평판/추천/조작 방지**: 실제 계약/수락 인증을 전제로 평가 표본/중복 리뷰·직원 랭킹 부정 행위/이의제기 처리.
8. **현재 DB와 상세 설계 일치**: `agent_contracts`↔`staff_engagement` 관계, project_members RLS/G1 CAS writer 및 migration 번호 충돌, `run`/PM job/experience ledger 분리.
9. **운영 알림/프로액티브 PM**: 실제 scheduler/worker가 요청/프로젝트 상태를 갱신하는 빈도, idle/no-op 정책, 비용/정보 전송·계약 철회 시 즉시 중지.

## 5. 권고 실행·검수 순서

1. **G1 P0**: 문서/채팅·복원 CAS writer와 프로젝트 RLS/PR 충돌 먼저 실제 격리 DB/브라우저 재현·해소. 신규 UI Mock은 격리 병행 가능.
2. **S3/H1~H3 UX Mock**: 기존 AI 기획→AI 직원 찾기(성격×역할×경력×모델)→정식 PM/단발→N28 경력 동의→배정 A/B, 직원 변경/해임 시나리오 시연·UX 테스트.
3. **기술 계약 확정**: IA URL/화면 CTA→API JSON schema/OpenAPI→현재 DB migration과 employee/consent/experience mapping→권한/승인·용량/예산 계약.
4. **G2~G6 격리 E2E**: 1개 검수 AI 유료 실행 경로를 먼저 실제 검증한 다음 다직무·다중 PM·경력 원장/공개/가격으로 확장.
5. **상용 전**: 개인정보·프로젝트 IP/고용 비유·공개/철회, 공급자 계약·원가·환불/가격, 가짜 경력·등급 오인 금지, 실사용자 파일럿 승인.

**릴리스 판정:** 모든 P0의 코드/실DB·JWT/RLS/브라우저 증빙과 별도 운영 승인 없이는 서비스 완성/출시 불가. 이 감사 문서의 `DOC_UPDATED`는 **문서끼리의 목표 일관성 개선**만 의미한다.
