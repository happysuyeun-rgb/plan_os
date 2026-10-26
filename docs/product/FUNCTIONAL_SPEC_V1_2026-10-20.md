# PlanOS 3.0 × AI 인력사무소 — 통합 기능정의서 v1.0
작성: 2026-10-20 · **최종 수정: 2026-10-25 (CURRENT/TARGET 정합화)** · 상태: **제품 기준선 / 실코드 대조 갱신 / 미승인** · 담당: 제품기획 및 개발 통합

> 본 문서는 기능의 단일 추적 기준선이다. 기능 구현·테스트·출시를 구분하며, 코드 검증 없이 완료라고 표시하지 않는다.  
> 상태·권한·화면 추적: [STATUS_VOCABULARY](../plans/STATUS_VOCABULARY_2026-10-25.md) · [PERMISSION_MATRIX](../plans/PERMISSION_MATRIX_2026-10-25.md) · [FEATURE_TRACEABILITY](../plans/FEATURE_TRACEABILITY_2026-10-25.md) · [결함·결정 로그](../plans/DESIGN_DEFECT_DECISION_LOG_2026-10-25.md).

## 1. 근거·범위·우선권
1. 제품 요구: [PRD v0.3](PRD.md), [통합 서비스 기획 v1.0](SERVICE_PLAN_V1_2026-10-20.md).
2. 정책: [서비스 운영정책 v1.0](SERVICE_OPERATIONS_POLICY_V1_2026-10-20.md), [권한정책](PERMISSIONS_POLICY.md).
3. 구현 계약: [MVP 구축 상세명세 v1.1](../engineering/MVP_BUILD_READY_SPEC_2026-10-20.md)와 상태/REST 계약.
4. 코드 근거: GitHub `main` 기존 PlanOS + 개발 전용 [S1 Draft PR #20](https://github.com/happysuyeun-rgb/plan_os/pull/20). 모든 PR은 **미병합**이며 운영 적용으로 간주하지 않는다.
5. 요구 충돌 우선순위: 사용자 확정 결정 > 운영·보안 강제 조건 > 이 문서 기능 계약 > 상세 구현 계획. 충돌 항목은 결정 로그에 보류로 등록한다.

## 2. 공통 기능 정책
- 역할 CURRENT: owner / editor / viewer. **outsider = 비멤버(역할 null)** — HTTP 404 마스킹은 TARGET.
- 프로젝트 안의 자료 및 업무는 `project_id`로 격리. 외부 사용자는 타 프로젝트 존재를 노출하지 않음(목표).
- 상태: 사람 업무 `todo/in_progress/in_review/blocked/done`. 사람 PM `draft/pending_owner_approval/approved/rejected/needs_revision`. Mock ReviewJob `queued/running/awaiting_human/accepted/rejected/failed`. **TARGET 서버 run** `validating/succeeded/…` 는 Mock과 분리.
- 쓰기 요청은 재요청 안전성(멱등성), optimistic version/409 충돌 처리, 이벤트 감사, 사용자 오류 복구가 필요.
- 고객 데이터 외부 전송/유료 AI/배포/운영 DB 변경은 별도 승인 및 법적·원가 조건 확보 전 금지.
- 완료 판정: 기능 시나리오 실제 E2E + 권한/RLS + 장애/회귀 테스트를 통과해야 **검증 완료**.

## 3. 통합 기능 카탈로그와 현재 개발 상태
표기: **기존구현-회귀미검증 / 코드작성-통합미검증 / 설계만 / 미구현 / 정책결정대기**. 설계 문서 완료는 기능 완료가 아니다.

| 기능 ID | 단계 | 기능·고객 행동 | 권한 | 입력/처리/출력 핵심 규칙 | 실패·예외 | 수용 기준 | 실제 상태 |
|---|---|---|---|---|---|---|---|
| F-001 | 기존 | 가입·로그인·온보딩 | 본인 | 인증 세션 유지/재접속, 계정 초기화 | 로그인 실패/세션 만료 | 인증 흐름 회귀 | 기존구현-회귀미검증 |
| F-002 | 기존 | 프로젝트 생성·조회·수정 | owner/editor 범위별 | 프로젝트 ID 기반 읽기/수정 | 403/404·삭제 상태 | 프로젝트 간 격리 | 기존구현-회귀미검증 |
| F-003 | 기존 | 문서 편집·자동 저장 | 프로젝트 편집권한 | PRD·IA 등 기존 문서 보존 | 중복탭 충돌·저장 실패 | 입력 유실 없음 | 기존구현-회귀미검증 |
| F-004 | 기존 | 문서 버전·복구·휴지통 | 소유/편집 정책 | 이전 버전 복구, 임시저장 보호 | 복구 충돌/삭제 | 복구 E2E | 기존구현-회귀미검증; B-04 별도 PR |
| F-005 | 기존 | 프로젝트 멤버·역할 관리 | owner, 멤버 읽기 | owner/editor/viewer, 활성 멤버만 담당 | 권한 박탈/초대 보류 | 실 JWT/RLS 검증 | 기존구현-회귀미검증 |
| F-101 | S1 | 사람 업무 생성·조회 | editor/owner 쓰기, 멤버 읽기 | 제목 1~120자, 목표, 생성자, 서버 ID, 목록 | 중복 생성·네트워크 오류 | 재접속 동일 작업 | 코드작성-통합미검증 (PR #20) |
| F-102 | S1 | 담당자 배정·업무 수정 | owner/editor | 활성 멤버 ID 및 접근권한 검증, version CAS | 권한 변경/409 | 경쟁 변경 덮어쓰기 없음 | 코드작성-통합미검증 |
| F-103 | S1 | 상태 전이·차단 사유 | owner/editor | todo→in_progress→in_review→done, blocked→in_progress | 무효 상태/사유 미입력 | 서버에서 불법 전이 차단 | 코드작성-통합미검증 |
| F-104 | S1 | 소프트 삭제·복원·감사 이력 | owner 삭제/복원, 멤버 이력 조회 | 삭제 시 원본 보존, 변경 주체/시간/버전 이벤트 | 이력 위조/무단 복원 | DB/브라우저 회귀 | 코드작성-통합미검증 |
| F-105 | S1 | 성공기준·AI 담당·작업 상세 | owner/editor 쓰기, 멤버 읽기 | criteria + **담당 유형 human\|agent Mock**(LS, user 스코프). 산출물 링크는 후속 | AI 지정≠실행·채용·과금. hire는 `/specialists*` | 상세 UI·Mock 저장·단위 테스트 | **CURRENT: 상세·criteria·F-105 Mock UI**; DB `assignee_kind`·실 E2E **미완** |
| F-201 | S2 | 감사 대상 프로젝트 문서 선택 | 프로젝트 접근자, 최종 확정 owner | 동일 프로젝트 문서 2종 이상, 목록·수정시각·버전 표시 | 다른 프로젝트/삭제/미저장 문서 | 잘못된 소스 선택 차단 | 코드작성-통합미검증 (`/audits/new`) |
| F-202 | S2 | 입력 자료 버전·해시 고정 | owner 승인 | document ID+digest+revision, 범위/제외 항목 | 변경 발생 시 stale 409 | 실행 전 소스 재검증 | 설계만/부분 |
| F-301 | S3 | AI 역할 카드·권한 안내 | 프로젝트 멤버 | `requirements_auditor_v1` 1종 카탈로그 Mock | 근거 없는 경력/성공률 금지 | 실제 능력만 노출 | **CURRENT Mock** `/specialists` (#54) · 실도구/모델 미연결 |
| F-302 | S3 | 계약 초안·동의·철회·만료 | owner | terms/manifest digest… | 무동의 실행 차단 | 동의 없는 외부 호출 0 | **TARGET** · CURRENT는 모의 검토 고지만(`/specialists/request`) |
| F-303 | S3 | 예산 한도·예상 비용 고지 | owner | 계획/실행 상한… | ₩0 날조 금지 | 자동 초과 호출 금지 | **TARGET** · Mock은 「산정 불가/미정」 |
| F-401 | S4 | 무과금 사람 PM 계획 초안 | owner/editor 작성 | 업무 분해, 성공기준, 버전 | 오래된 문서/범위 | 저장/재조회 | **CURRENT** `/plans` · AI PM 아님 |
| F-402 | S4 | PM 계획 승인·반려·재수정 | owner 결정 | version/CAS 고도화 잔여 | 구버전 승인 | 구버전 무효 | **CURRENT UI** · 서버 CAS 강화는 잔여 |
| F-501 | S5 | 실행 요청·서버 작업 큐 | owner | 활성 계약+승인+예산+자료검증 한 트랜잭션, outbox | 412/429/중복 요청 | 단일 job/예약 | 설계만 |
| F-502 | S5 | 제한된 AI 문서 검수 수행 | 시스템 worker | 문서 읽기만, 근거 있는 finding 보고서 작성 | 외부 전송 미동의/도구 거부 | 실제 로그·작업 증빙 | 미구현, provider 승인대기 |
| F-503 | S5 | 실행 상태·취소·재시도 | owner, 허용 열람자 | queued/running/validating 등 서버 상태, lease/attempt | 재시작/타임아웃/결과 불명확 | 중복 실행/과금 방지 | 설계만 |
| F-504 | S5 | 비용 예약·사용량 정산 | 서버+owner 조회 | reserved/observed/pending 별도 원장 | 공급자 응답 유실/0원 오표기 | 정산·취소 일관 | 설계만 |
| F-601 | S6 | 근거 있는 보고서·검증 | owner 전용 비공개 | finding·severity·source digest·locator, validator | 위조/삭제된 소스 | 인용 정합 검증 | 설계만 |
| F-602 | S6 | 사람의 수락·반려·수정요청 | owner | 정확한 artifact version/digest 사건 | 중복 수락·구버전 | 승인 이력 유지 | 설계만 |
| F-603 | S6 | 작업 결과·상태 브리핑 | 소유/권한별 | 실제 이벤트/도구 결과/실비, 미완료 사실 표시 | 허위 완료/성공률 | 사실 기반 요약 | 설계만 |
| F-701 | S7 | 프로젝트→선택→동의→승인→실행→검수 통합 | 권한별 | 동일 project/task/문서 ID 연속성 | 세션 종료/실패 복구 | 브라우저 실사용 E2E | 미구현 |
| F-702 | S7 | 보안·접근성·장애·성능 회귀 | QA | RLS, tenant, 409, 재진입, 키보드 | 외부 공급자 장애 | 출시 게이트 통과 | 미구현 |
| F-801 | 후속 | 역할 면담·추천·평판·다직군 | 정책 승인 후 | 검증 가능한 실적만 공개 | 허위 광고 | MVP 후 별도 기준 | 후속 범위 |

## 4. 화면별 기능명세 인덱스

### 4.1 CURRENT (구현·Mock)

| 화면 | 경로 | 연결 기능 | 필수 오류·빈 상태 |
|---|---|---|---|
| 업무 목록 | `/projects/:projectId/tasks` | F-101~104 | 빈 목록, 권한, 저장 실패 |
| 업무 상세 | `/projects/:projectId/tasks/:taskId` | F-102~105 | 409, 이력 로드 실패, F-105≠실행 |
| AI 카탈로그 Mock | `/projects/:projectId/specialists` | F-301 | 접근 불가, 결제 CTA 없음 |
| 채용 요청 Mock | `/projects/:projectId/specialists/request` | F-301 | owner-only, 모의검토만 |
| AI 기획 검수 Mock | `/projects/:projectId/ai-review` | (Mock 검수) | unpaid 배너, editor run/accept CURRENT |
| 사람 PM | `/projects/:projectId/plans` `…/new` `…/:planId` | F-401~402 | 버전 충돌, 반려 사유 |
| 감사 소스 | `/projects/:projectId/audits/new` | F-201~202 | 미저장·타 프로젝트 |

### 4.2 TARGET (미구현 라우트 — CURRENT로 오인 금지)

| 화면 | 경로(목표) | 연결 기능 |
|---|---|---|
| 역할·계약 | `/projects/:projectId/contracts/:contractId` | F-302~303 |
| 실행 | `/projects/:projectId/runs/:runId` | F-501~504 |
| 결과 보고서 | `/projects/:projectId/artifacts/:artifactId` | F-601~603 |

## 5. 검수/결함/정합성 레지스터
| ID | 중요도 | 불일치·누락 | 현재 조정 및 차단 기준 |
|---|---|---|---|
| FD-01 | P0 | PRD의 `draft/planned/queued/running` 혼합 '업무 상태' vs 구현 사람 업무 5상태 | 사람 업무·계획·실행·산출물 상태를 각각 별도 리소스로 정규화 |
| FD-02 | P0→완화 | (구) AI 담당/상세 미구현 | **2026-10-25:** 상세·criteria·F-105 Mock UI 반영. **잔여 P1:** DB `assignee_kind` 영속·브라우저 E2E·산출물 링크 |
| FD-03 | P0 | 구현 상세의 REST + 멱등성 계약과 Supabase PostgREST 직접 CRUD가 상이 | 서버 보증되는 생성 멱등성·오류/버전 계약 구축 전 REST 계약 완료 금지 |
| FD-04 | P0 | 마이그레이션 011은 정적 SQL 테스트만 통과; 별도 DB 실행·RLS 불명 | 운영 DB 적용 금지, 격리 DB 검증 필요 |
| FD-05 | P0 | UI는 flag 기본 off + localStorage, 서버 모드도 실 E2E 미검증 | 브라우저 실제 테스트 후 통합 완료로 승격 |
| FD-06 | P0 | owner 재오픈(reason 필수) 정책 vs S1 `done` 종결 구현 | owner 전용 감사 사건으로 추가 구현 전 미완료 |
| FD-07 | P0 | 원래 문서 'PlanOS 기능정의서'는 신규 S1~S7 마스터 기능 추적 문서와 혼재 | 본 문서를 신규 기능 단일 기준으로 지정, 기존 UX 기능명세·TF ID는 참조 유지 |
| FD-08 | P1 | 전면 서비스 AI 카탈로그와 초기 한 전문 역할 실증 범위 오인 위험 | 초기 `requirements_auditor_v1` 1종으로 제한, 확대 출시 전 금지 |
| FD-09 | P0 | 운영정책의 계약 상태와 UI 별칭 혼재 | DB draft/active/revoked/expired 유지, accepted 등은 별도 사건/표시 |
| FD-10 | P1 | PR #1·#20의 main 반영 상태가 문서에 누락되어 있었음 | **2026-10-21 코드·문서 모두 main 병합 확인**. 단, DB/RLS/E2E 미검증이며 병합은 기능 완료가 아님 |

## 6. 필수 테스트 식별자
- T-AUTH: owner/editor/viewer/outsider 역할별 API/JWT·RLS 통과/차단.
- T-S1: CRUD·상태 전이·차단 사유·삭제/복원·감사 이벤트·동시수정 CAS·새로고침.
- T-S2: 다른 프로젝트 문서/미저장·삭제 소스 금지·문서 변경 stale.
- T-S3/4: owner 계약·예산·계획 승인, 약관/버전 mismatch, 중복 POST.
- T-S5: 큐 작업 lease, provider timeout/결과 미확정/취소/재시도, 잔액 및 이중청구.
- T-S6: 구조화 보고서 schema/locator/digest 검사, 사람 수락 버전 귀속.
- T-S7: 실제 계정으로 처음부터 보고서 수락까지 재접속 E2E + 기존 문서 회귀.

## 7. 다음 작업 큐
1. **P0 문서 기준선:** 본 기능정의서·PRD·서비스 운영정책·MVP 상세명세 간 기능 ID/상태 모순 조정.
2. **P0 S1 완결:** 업무 acceptance criteria / 멱등성 / 삭제 권한 / owner done reopen / 감사 이력 UI 및 DB role 검증.
3. **P0 S2:** 선택 문서 manifest/version/digest의 순수 검증 로직·화면을 격리 개발, 운영 DB 변경 없음.
4. **P0 S3~S6:** 동의·계획·실행 mock·보고서 validator를 연결해 end-to-end mock 후 실제 서버·provider.
5. **QA 게이트:** 격리 RLS + 기존 문서 회귀 + 비용/외부 전송/승인 정책이 검증될 때만 통합 완료/출시.

## 8. 완료 체크 정책
- `[x] 문서 작성`: 이 파일 작성·GitHub 커밋 확인만.
- `[ ] 기능 구현 완료`: UI/API/DB/권한/상태·실제 산출물의 전체 연결 후.
- `[ ] 검증 완료`: 모든 지정 T-* 실제 테스트와 결함 조치 후.
- `[ ] 운영 반영`: main 병합 및 운영 적용 승인 후.

## 2026-10-21 상태 추적 보정
- PR #1(기획 문서) 및 PR #20(S1/S2 개발)은 main 병합 완료. 기능/출시 완료 판정과 구분한다.
- PR #15(기존 저장/RLS 회귀)는 Draft·충돌, PR #19(초안 보존)는 Draft·미검증으로 남음.
- 후속 실행과 누락의 처리 단계는 [통합 실행계획서](../plans/PLANOS_INTEGRATED_EXECUTION_PLAN_2026-10-21.md) G0~G7에 따른다.
