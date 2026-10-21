# PlanOS 3.0 × AI 인력사무소 — docs/ 전수 재검수·교차 정합성 감사 v3 (2026-10-21)

- **스캔 범위:** GitHub `docs/planos-ai-staff-pm-hiring-20261021` 브랜치의 `docs/` 하위 **53개 Markdown 파일 전수 목록(재귀 tree) + 각 파일 내용/제목·핵심 요구/상태 확인**. 사용자의 요청대로 Task Flow부터 제품/UX, DB·API/인가, QA·운영/과거 기술 문서를 재대조.
- **방법:** 첫 53개 파일에 대해 제목/주요 섹션/기존 상태·핵심 키워드/역사적 주장 확인. 핵심 계약 문서는 관련 표/ID/권한/실행·예외까지 재조회. 이것은 **문서 감사**이며 현재 모든 코드 행위·실제 DB, 외부 공급자, 프런트 브라우저를 다시 테스트했다는 뜻이 아님.
- **상위 기준:** [통합 서비스기획 v2.0](../product/SERVICE_PLAN_V1_2026-10-20.md), [Task Flow](../product/TASK_FLOWS.md), [상세 스토리보드](../ux/AI_STAFF_SCREEN_STORYBOARD_V1_2026-10-21.md), [데이터·권한·API 기준](../engineering/AI_STAFF_DATA_AUTH_CONTRACT_V1_2026-10-21.md), [기능 정의](../product/FUNCTIONAL_SPEC_V1_2026-10-20.md).
- **수정 위치:** Draft PR #28 브랜치만. `main`·실제 운영 DB·실모델/과금/배포 수정 없음.
- **중요한 결론:** 누락 '기능'뿐 아니라 **동일 개념을 서로 다른 이름/ID/URL/FK/권한으로 중복 설계한 것**이 P0 위험. 새 문서를 하나 더 만들고 그대로 두기보다는 정본·대응표·역사적 참고를 구분해야 한다.

## 1. 53개 문서 전수 분류

| 분류 | 문서 | 검수 판정/후속 |
|---|---|---|
| 제품 기준·구체화 | `product/PRD.md`, `SERVICE_PLAN_V1_2026-10-20.md`, `FUNCTIONAL_SPEC...`, `SERVICE_OPERATIONS_POLICY...`, `PERMISSIONS_POLICY.md`, `TASK_FLOWS.md`, `DUAL_ENTRY...`, `AI_STAFF_PERSONA...`, `AI_STAFF_VERIFIED_EXPERIENCE...` | 최신 사용자 방향/기술 E2E/계약·가격 상충 검사. 구버전 메타데이터/중복 식별자/승인권 개선 |
| 초기 AI 검수 서비스 | `product/FIRST_SPECIALIST_AI_MVP...`, `MVP_CONTRACT_APPROVAL_COST_POLICY...` | **첫 수직 실증 전용**. 전체 직원 채용/경력·PM 복수 프로젝트 기능 완료 의미 아님 |
| UX | `ux/IA.md`, `SCREEN_SPEC.md`, `UX_FLOWS.md` | ST-UI/N/P 화면군 중복, Solo/AI Team 전환 UI 잔존, 상세 스토리보드 미완료 → 신규 정본 작성 |
| 기술·개발 인계 | `engineering/AI_API_DB_CONTRACT_P1_5...`, `AI_EXECUTION_ADR_002...`, `API_CONTRACTS.md`, `ARCHITECTURE.md`, `BASELINE_AUDIT.md`, `DATA_MODEL.md`, `MVP_BUILD_READY_SPEC...` | 계약·배정·직원 정체성·경력 원장 표 중복과 신규 API namespace 충돌 → 새 단일 데이터·인가 계약 |
| QA·보안·운영 | `quality/DOCUMENT_REVIEW...`, `PHASE1_CROSS_AUDIT...`, `PHASE1_P5_REAUDIT...`, `PHASE1_UX_ARCH_AUDIT...`, `PLANOS_DESIGN_CROSS_AUDIT...`, `PLANOS_LEGACY_PLANNING_FLOW_GAP...`, `PLANOS_V2_DESIGN_CROSS_AUDIT...`, `S1_TASK_CROSS_AUDIT...`, `TEST_PLAN...`, `THREAT_MODEL...`, `operations/RELEASE_RUNBOOK...` | 누락 검사 근거/다중 프로젝트 보안·동의 철회·승급 조작 테스트 확대. 과거 QA PASS 추정 금지 |
| 계획·가이드 | `plans/PLANOS_INTEGRATED_EXECUTION_PLAN...`, `PLANOS_WORK_EXECUTION_PROTOCOL...`, `roadmap/IMPLEMENTATION_PLAN.md`, `PROGRESS_STATUS.md`, `README.md`, `REPOSITORY_GUIDE.md`, `DOCUMENT_INVENTORY...` | 실행 순서 충돌을 G0~G7 최신 계획 기준으로 통일. 과거 계획/진행표는 참고 이력 |
| 기존 PlanOS 기능 설계 | `DASHBOARD_NOTIFICATIONS_DESIGN.md`, `DEV_GUIDE.md`, `DOC_LAYOUT_DESIGN.md`, `EXPORT_FORMATS_DESIGN.md`, `HISTORY_AND_EXPORT_DESIGN.md`, `MEMBER_COMMENTS_DESIGN.md`, `MEMBER_PERMISSIONS_DESIGN.md`, `MOCK_GAP_REVIEW.md`, `PROJECT_RENAME_DESIGN.md`, `PROJECT_TRASH_DESIGN.md`, `USER_TASKS.md` | **기존 기능 보존/회귀 참고**. 2026.06 완성도·권한·마이그레이션 메모를 현재 3.0 검증 완료로 자동 계승 금지 |
| V1 보존 | `TECH_SPEC.md`(안내), `archive/README.md`, `archive/legacy-v1/TECH_SPEC.md` | 구 설계/5종 문서/인터뷰·내보내기 회귀 참조. **현행 AI staff architecture 대체 금지** |

## 2. 새로 발견한 중복·상충 결함 대장 (기존 V2-01~18에 추가)

| ID | 우선 | 발견한 불일치 | **결정·보정 방향** | 현재 상태 |
|---|---|---|---|---|
| V3-01 | P0 | `TASK_FLOWS` TF-31~46 vs TF-S01~12의 기능 중복과 TF-06 'Solo/AI Team 모드 전환' | 개발 정본 **TF-01~46**; TF-S는 교차참조 alias. TF-06은 기존 AI 기획과 직원 배치의 '공통 프로젝트' 방식으로 의미 수정. 중복 별도 기능/이벤트 구현 금지 | 설계 ID 정본 결정, 기존 참조 수정 필요 |
| V3-02 | P0 | `IA` N01~23, ST-UI01~10, N24~32, 서비스기획 P-01~12가 각각 새 페이지처럼 보임 | **N01~32 개발 참조 ID 하나**, 기존 N16/17/19/20 컴포넌트 재활용, N24~32는 확장 서브화면/패널. ST-UI/P는 alias만 | 스토리보드로 상세 정의, 실제 라우트 설계·검증 별도 |
| V3-03 | P0 | `API_CONTRACTS`의 `/v1/hirings` vs `/api/v1/staff/engagements`, `PUT assignments` vs PATCH, 다른 결제/동의 API | **STAFF-API-01~14 /api/v1** 정본, 기존 `/v1`은 과거 후보 alias/신규 구현 금지, API-01~23는 기존 첫 수직 실증 유지. 실제 legacy URL 존재 시 adapter 검토 | 단일 설계 계약 작성, 실제 OpenAPI/코드 미구현 |
| V3-04 | P0 | `DATA_MODEL`에 `agent_profiles` vs `staff_identity`, `agent_contracts` vs `staff_engagement`, `agent_assignments` vs `staff_project_assignment` 중복 | 기존 `agent_profiles`를 직원 identity, `staff_engagements`를 고객 채용 묶음/가격, **프로젝트별 agent_contracts**를 실제 실행 계약, **agent_assignments**를 프로젝트별 배정 정본으로 우선. 기존 DB 구조에 맞게 확장 | 설계 방향 선택, 실제 테이블/마이그레이션 적합성 P0 미검증 |
| V3-05 | P0 | 경력 원장 `(staff_id,project_id,work_day)` vs `(staff_id,work_day)` UNIQUE 충돌; A 철회·B 유지일 때 보전 불명확 | `staff_work_contributions`는 프로젝트별 검증 이벤트; `staff_experience_daily`는 직원별 **KST 고유일 1개 투영**. A 철회 시 remaining B로 재계산 | 설계 선택, 트랜잭션·시간대/성능 테스트 필요 |
| V3-06 | P0 | 기존 `DATA_MODEL` 표에는 editor 결과 최종 수락 '명시 위임 시'가 존재하고, `API_CONTRACTS`는 owner/위임자 | 초기 MVP **owner-only** 최종 계약/유료 실행/PM 계획 승인·결과 수락. 향후 위임 지원은 별도 승인·권한 정의 | 보안정본 마련, 다른 구문서 후속 보정 필요 |
| V3-07 | P0 | 같은 공유 직원의 공개 경력과 고용주 간 프로젝트 컨텍스트를 구분하지 않으면 cross-tenant 유출 | 직원 공통 ID·동의된 공개 검증 실적만 공유; **고용주/프로젝트 입력·프롬프트·산출물은 계약별 격리** | 신규 데이터·인가 계약 + 위협모델 연결, 실증 없음 |
| V3-08 | P0 | `FIRST_SPECIALIST_AI_MVP` 및 `MVP_BUILD_READY_SPEC`가 '사람 AI PM 계획'과 **실제 자율 PM**을 동등하게 보이게 함 | F401의 무과금 사람 계획 Mock vs AI PM 모델 계획/worker·예산/동의/스케줄러 구분; 채용=실행 승인 아님 | 설계·스토리보드 보정, 실제 PM 구현 없음 |
| V3-09 | P0 | 과거 2026.06 '기존 문서 레이아웃/버전/댓글/휴지통 완료' 기록을 새 직원 기능·G1 안전성과 혼동 | V1 참조 유지하되 현재 문서 autosave CAS, 버전복원·RLS P0를 검증할 때까지 새 직원 쓰기 금지 | 실제 G1 P0 미완 |
| V3-10 | P1 | 비용 견적/계약 스냅샷이 PM 다중 프로젝트/등급 승급·모델 변경과 일치하지 않을 수 있음 | 채용 묶음의 frozen rate_snapshot + 프로젝트별 실행 예산; 승급/공개 거부 기존 단가 불변, 새 모델/기간은 owner 재동의 | 구체 요금/원가·DB 계약 미승인 |
| V3-11 | P1 | 데이터 공개 권리자 '사용자'와 공동 소유/팀 프로젝트 owner 권한 혼동 | 프로젝트마다 **실제 공개 권리 보유 owner** 확인; 부분 owner라면 계약 일괄 배정 거부. 팀 조직 위임 정책 이후 확장 | 법무·조직 권한/테스트 필요 |
| V3-12 | P1 | 모델 라우팅 기본 자동 fallback vs 재동의/프롬프트 내 타 고객 맥락 재사용 위험 | 공급자 간 무동의 데이터 전송 0. 실제 제공자/모델+도구 capability 평가, 사전 계약·예산/RLS 검증 | API/워커/실사업자 계약 미검증 |
| V3-13 | P1 | `PROGRESS_STATUS`/2026.06 DEV_GUIDE 및 새 계획서 간 진행 상태·완료 라벨 충돌 | **PLANOS_INTEGRATED_EXECUTION_PLAN G0~G7 + CI/DB/E2E 실제 로그**를 현행 진행의 기준. 과거 문서는 스냅샷/과거 참고로 표시 | 구문서 직접 대체·삭제 금지 |
| V3-14 | P1 | `DOCUMENT_INVENTORY`가 파일 전수 미확인이라 기록한 기존 경고 | 본 브랜치 Git tree로 **53개 docs Markdown 목록 확인**. 신규 생성하는 명세/감사는 이후 인벤토리에 증분 등록, 전수 검토 범위 명시 | 이번 목록 검수 완료; CI 링크 검사 미실행 |
| V3-15 | P1 | IA의 `/agents`, `/staff`, `/workspace` 라우트 충돌 가능 | 신규 모든 URL은 제안. 기존 `/projects/:projectId`와 `/projects/:projectId/:docType` 유지. 프런트 App.tsx 변경 전 단일 라우트 테이블 정리 | UI 라우팅/프로토타입 검증 필요 |
| V3-16 | P1 | 경력 적립 자체에 사후 동의/이미 작업된 기간 소급적용 여부 미정 | 기본 허용 안 함; **동의 효력 개시 후 verified work**만 자동 적립. 소급은 고객이 구체 기간/범위를 새로 허용한 경우에만 제안 | 제품 정책/법적 동의 검토 필요 |
| V3-17 | P1 | 사용자/직원 교체 중 진행 job/초안·비용/승인 만료와 경력 일수 재평가의 순서 | revoke→새 worker claim·공개 접근 차단→진행 job 취소/정산 보류→계약/일수 projection·등급 재계산; UI 상태/재시도 분리 | DB 원자 경계/worker 재시도 QA 필요 |
| V3-18 | P1 | 무료 기본 PM과 유료 PM 차별이 '성격'만으로 보일 위험 | 기본 AI 인터뷰/기획은 계속 제공, '기본 PM 도움'은 **프로젝트 내부 제안/코칭**, 정식 PM은 명시적 지속 책임·한/복수 프로젝트 진행/직원 조율/상태 기반 브리핑. 실제 무료량·백그라운드 실행은 실증 전 미표시 | 서비스 원가/유료 가치 인터뷰 대기 |

## 3. 문서 충돌 우선순위 — 개발 시 강제

1. 사용자 명확한 제품 의도·보안/권리·계약/실행 제약
2. [서비스기획 v2.0](../product/SERVICE_PLAN_V1_2026-10-20.md) (고객 가치/여정/제품 모델)
3. [기능정의서](../product/FUNCTIONAL_SPEC_V1_2026-10-20.md) (F-ID/STAFF-ID)
4. [본 Task Flow의 canonical TF-01~46](../product/TASK_FLOWS.md) (행위 이벤트)
5. [스토리보드](../ux/AI_STAFF_SCREEN_STORYBOARD_V1_2026-10-21.md) (개발 화면/CTA/권한·상태)
6. [권한·데이터·API 단일 계약](../engineering/AI_STAFF_DATA_AUTH_CONTRACT_V1_2026-10-21.md) (구현 불변식) + 기존 수직 실증 `MVP_BUILD_READY_SPEC` S1~S7
7. [테스트 계획](TEST_PLAN_2026-10-20.md) 및 실제 실행 증거, [통합 실행계획](../plans/PLANOS_INTEGRATED_EXECUTION_PLAN_2026-10-21.md)
8. 2026.06 기본 문서·구 V1 기술 명세/이전 v0.x·과거 감사/로드맵은 회귀·역사 참고; 최신 내용과 충돌할 때 출시/DB 승인 기준으로 사용하지 않음.

**주의:** 제품 문서 기준에서 역할·사람 동의와 보안 법률 등 유효 규정이 충돌하면, 제품 기획서가 규정을 무효화할 수 없다. 실테이블 정의/현재 코드 기반 확인이 우선이며 새 계약은 TARGET이지 이미 DB에 있는 객체가 아님.

## 4. 이번 실행의 산출물 및 검증 범위

- [x] GitHub docs tree 53개 파일 목록/내용 검토, 최신/과거 구분
- [x] TF/IA/SCREEN/API/DATA/PERMISSIONS 신규 확장 표에 여러 겹 중복이 있는 문제 확인
- [x] [화면별 상세 스토리보드 v1](../ux/AI_STAFF_SCREEN_STORYBOARD_V1_2026-10-21.md) 작성: 기존 AI 기획 KEEP, 직원 탐색→상세→계약/PM 다중 배정→경력 동의→실행/검수→평가→이력/승급→철회/교체/해임
- [x] [데이터·권한·API 단일 계약 v1](../engineering/AI_STAFF_DATA_AUTH_CONTRACT_V1_2026-10-21.md) 작성: 직원 ID/고용 묶음/프로젝트별 계약·배정 정본, 동의/경력 원장/등급/요금, owner/editor/viewer/worker, STAFF-API-01~14, DATAUTH-01~15
- [ ] 실제 App.tsx/SQL migration/워크플로/브라우저/실제 공급자 API/원가를 새 명세에 맞춰 증명: **이번은 docs only**. 브라우저/DB RLS/P0 수정 미완.
- [ ] 실제 회사/팀 고객의 공개 권한·개인정보 보존/국외 모델 전송·요금 법무/상용 승인.
- [ ] 코드/모의 화면 개발, F401 browser E2E, G1 P0 writer/복원/RLS 결함 안전성 검증.

## 5. 우선순위와 후속 이행

**P0 기존 저장·권한 안정화 G1 유지**. 병렬로 스토리보드·모의 직원 탐색/동의/배정 (실제 공급자 0호출) 제작, 현재 DB `agent_profiles/agent_contracts/agent_assignments`가 실존하는지 PR별 비교와 migration 번호 충돌 검토, 서버 소유권/worker 적용 범위 정규화 → 격리 SQL/RLS/브라우저 테스트.

**문서 변경 승인 단계:** 이 문서의 `설계 선택`은 개발 인계용 권고안. 제품 운영상의 가격/등급 숫자·법적 공개 동의·외부 모델 공급자·실제 DB 스키마/배포·`main` 병합은 **승인/테스트 전 미확정**.
