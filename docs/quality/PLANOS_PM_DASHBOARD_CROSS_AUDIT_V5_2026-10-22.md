# PlanOS 3.0 — PM 실제 루프 × 프로젝트 통합 대시보드 교차감사 V5

**2026-10-22 / 독립 코드 리뷰(정적 코드·커밋/Actions) / 검수 정본 보완 제안 / 미승인**

**코드 근거:** `main` 3e3fc660, G1 [PR #30](https://github.com/happysuyeun-rgb/plan_os/pull/30) HEAD `f74481e16dededed88ab4e22403211ce2de80510`, PM [PR #36](https://github.com/happysuyeun-rgb/plan_os/pull/36) HEAD `dd64d72e906160f99e064d9babbd9dac7805947d`, [PM 코드 리뷰 코멘트](https://github.com/happysuyeun-rgb/plan_os/pull/36#issuecomment-6332797665), [통합 진행대시보드 #39](https://github.com/happysuyeun-rgb/plan_os/issues/39). 이 보고서 작성은 PR의 기능 테스트를 다시 실행했다는 뜻이 아니다.

## 1. 현재 제품 ↔ 실제 개발 ↔ 목표 화면 구분

| 영역 | `main` 실제 | 별도 Draft PR 개발 | 목표/사용자 수용 |
|---|---|---|---|
| C04 `/dashboard` | 프로젝트 카드/문서 종류/댓글·채팅 알림. task 상태 집계 **없음** | PR #36에서도 C04 변경 **없음** | 서버 집계 기반 프로젝트별 완료 업무/차단/승인/다음 행동 |
| N03 `/projects/:projectId/tasks` | S1 일부. `VITE_S1_SERVER_TASKS` OFF면 localStorage prototype | PR #36에 계획 연결 링크 표시 | 실제 서버의 상태 분리·진척/차단 집계와 동일 원천 |
| N08/N09 | `main` 실제 PM 화면 없음. PR #27은 메모리 Mock | PR #36: 실제 plan/step DB + UI + 계획/승인/업무 RPC, 마이그레이션 022 | 코드·서버 상태 일치 및 P0 우회 경로 차단 |
| N12/N22 | 완결된 통합 승인함 없음 | PR #36에 계획 상세 승인 버튼, **통합 승인함은 아님** | C04에는 실조회 가능한 계획 승인만 집계, 다른 실행승인 0이라고 위장 금지 |
| N29 | 정식 PM 운영실 미구현 | PR #36 구현 아님 | 지정 배정 프로젝트만 진척·업무·계약/직원 브리핑(후속) |

**GitHub 증거:** PR #30 Actions 8개 성공, PR #36 같은 HEAD에서 확인된 pull_request-trigger 워크플로 1개(S1 task checks) 성공. PM 전용 격리 JWT/Chromium PASS는 Cursor 보고와 소스의 테스트 시나리오를 확인했으나 이 검수자가 다시 실행한 것이 아님. SonarCloud 성공 판정·운영 Supabase 적용/배포 미확인. PR #36 base는 PR #30의 G1 브랜치, `main` 아님.

## 2. 코드 계약 미흡·불일치 — PR #36 병합 게이트

| ID | 심각도·범위 | 실제 결함 또는 검증 필요 근거 | 조치·증거 |
|---|---|---|---|
| V5-01 | **P0 가능성 / 승인 신뢰성** | `022` `validate_pm_plan_change()`는 *approved* objective 변경만 차단. `pending_owner_approval`에서도 RLS editor가 직접 `pm_plans.update` + version 증가로 목표 교체 가능한지 **미차단 코드** 확인 | 진행 중 승인 문서 불변성/수정→draft 재개+재승인, editor direct JWT PATCH negative test |
| V5-02 | **P0 가능성 / 업무 출처 진실성** | `project_tasks`의 `source_plan_id/source_plan_step_id` 직접 INSERT/PATCH를 검증하는 plan status·동일 project·plan/step 결속 guard 부재. 승인되지 않은 단계가 승인된 것처럼 링크·감사 로그에 표시될 우려 | RPC 전용 source 설정/트리거 강제·다른 프로젝트/미승인/불일치 id negative JWT test. 일반 수동 업무 생성 보존 |
| V5-03 | **P1 확정 / 최초 저장 복구** | `createPmPlan`이 plan insert→step 순차 insert→dependency N회 update: 저장 도중 장애 시 반쪽짜리 plan. 오직 **기존 plan 수정** RPC만 원자적 | 신규 생성도 단일 transaction + 재시도 멱등성/원본 입력 보존. 네트워크 끊김/2단계 실패 주입 |
| V5-04 | **P1 확정 / 상태 불일치** | `transition_pm_plan`의 rejected/needs_revision→pending 직접 허용 vs BEFORE trigger는 rejected/needs_revision→draft만 허용. N09 실제 재요청 버튼과 계약 불일치 | 서버/트리거/UI 동일 그래프, 거절→무편집 재요청/편집 후 재요청 테스트 |
| V5-05 | **P1 확정 / 스텝 이력 누락** | step 직접 CRUD는 plan version·audit 안 바꿈. `save_pm_plan_draft`의 *step-only 편집* 시 objective 동일하면 감사 트리거가 event 미기록 | 스텝 변경 전체를 같은 CAS·감사 리비전에 포함, 직접 수정 경로 제한/트리거 검증 |
| V5-06 | **P1 / 동시 멱등성** | `link_pm_plan_step_to_task`: 기존 조회→새 insert 구조. 2개 병렬 요청 시 unique constraint 1개로 지켜지더라도 다른 요청이 23505 실패 가능 | 2 JWT 병렬 호출 모두 **같은 task ID 성공**. ON CONFLICT 안전 회복/RPC 잠금 검토 |
| V5-07 | **P1 / 연결 정합** | `pm_plan_steps.depends_on_step_id` 단일 FK만 있어 *동일 계획* 선행단계 강제하지 않음. 직접 step UPDATE로 다른 계획 step 참조 가능성 | 서버에서 같은 plan 및 선행 위치·순환 방지, 악의적 JWT 직접 쓰기 테스트 |
| V5-08 | **P2 / 사용자 오류** | `src/lib/humanPmPlanDraft.ts` 문자열에 깨진 한국어가 실제로 존재 | 정상 한국어 오류 메시지+유효성 실패 UI 테스트 |
| V5-09 | **P1 릴리스 게이트** | PR #36 base=G1 브랜치, 서버 `022` 사용; S1 서버 feature flag 기본 OFF; CI 전체 수집/운영 DB 사전 상태 미검증 | PR #30 스키마 순차/백업/Vercel 점검 승인 뒤, PM 쪽 모든 CI 검증 및 base 재지정. 프로덕션 실 적용·자동 배포 금지 |

**판단:** G1 핵심 경합 보완은 코드/CI 근거를 확보. PM의 첫 실제 서버 기능은 **일부 실구현 인정**, 하지만 V5-01/02 미차단 공격 경로가 있어 **PR #36의 'P0 없음' 주장을 승인하지 않음**. negative JWT 테스트에서 반박되거나 수정으로 차단된 증거가 있어야 병합 게이트 해제 가능.

## 3. C04 — 프로젝트별 통합 업무 진행현황 기능 정의

**화면 규칙:** 정식 AI PM 고용 없이 사용자 본인의 C04 `/dashboard`에서 바로 사용. N29 정식 PM의 배정 프로젝트 운영실과 **별도 대시보드 집계 로직은 만들지 말고**, 동일한 서버 소스에서 권한별 scope만 다르게 호출한다.

### KPI 카드
- **활성·접근 가능 프로젝트 수**: owner 프로젝트 + active 멤버 프로젝트 중 RLS로 볼 수 있는 중복제거 집합. `projects.user_id` owner만 조회하는 현 `fetchProjects` 제한을 검토.
- **완료 업무 수 / 전체 유효 업무 수**: `project_tasks.status='done'` / `deleted_at IS NULL`. 프로젝트 전체 완성도 **아님**.
- **차단 업무 수**: `status='blocked'` (유효 업무에서만). `blocked_reason` 있으면 해당 프로젝트 화면에서 실제 내용 확인 가능.
- **실재하는 owner 승인대기 건수**: DB에 구현된 `pm_plans.status='pending_owner_approval'` + owner가 승인 가능 범위(추후 다른 approval 리소스면 별도 타입). owner 아닌 접근자는 '검토 대기' 등 오해 없는 표시. 아직 연결되지 않은 승인 리소스는 0건이 아니라 '미연결'.

### 각 프로젝트 카드
`project title, updated_at, total_active_tasks, completed_tasks, in_progress, in_review, blocked, pending_owner_approval, latest_checked_at`.
진행률은 **업무 완료율** `round(100*done/total)`. `total=0`이면 **N/A, 업무 미등록**으로 표기. 공통 알림은 별도로 표시. 카드 클릭은 기존 `/projects/:projectId/tasks`; PM 계획 승인 대기는 PR #36 라우트가 통합·검증됐을 때만 그 계획 상세로 연결.

### 집계 범위/데이터 계약
- 동일 요청 시점의 서버 결과(스냅샷 범위 명시), 프로젝트별 접근 권한/AI 직원 별도 assignment scope 검증, private 데이터 다른 프로젝트 유출 0.
- S1 `VITE_S1_SERVER_TASKS` OFF 또는 마이그레이션 미적용이면 **0%/100%로 위장하지 말고 집계 연결 안 됨** 안내. 브라우저 저장 prototype과 서버 결과를 합산하지 않음.
- 삭제 업무/휴지통 제외, 편집·승인 대기·실제 AI job과 `done`을 섞지 않음.
- 조회 수가 많을 때 RLS-enabled read-only RPC/view 또는 batched fetch (N+1 방지). SQL `security definer`로 접근권한을 우회하지 않음.
- 최초/로딩/빈 프로젝트/업무 0건/partial failure/forbidden/stale/갱신 버튼/마지막 동기화 시간 구분. 반응형/키보드 동선 지원.

### 가상 fixture (실 사용자 데이터 아님)
A: 유효 업무 10개 / 완료 4 / 차단 2 → **40%**, B: 2개 / 완료 2 → **100%**, C: 0개 → **진행률 N/A**. 전체는 완료 6/유효 12 → **50%**. 문서 5종 생성률과 업무 완료율은 별개.

## 4. 식별자 연계·설계 반영 체크

| 분류 | 연결 | 구분 |
|---|---|---|
| 기능 | **DASH-01~08** (별첨 기능정의서 본문), 기존 F-002/F-101~105/F-401~402, STAFF-04~06 | DASH는 **확장 추적 ID**, 기존 F-ID 번호를 변경하지 않음 |
| 화면 | **C04** 사용자 대시보드, N01/N03/N08/N09/N12 연계, **N29** PM 전담 후속 | C04/N29 **중복 신규 화면 ID 생성 금지** |
| Task Flow | TF-04 기존 프로젝트 접근, TF-13/14 PM 계획 승인, TF-15 사람 업무, TF-18 실제 AI run 상태(후속), TF-34+ STAFF 다중운영(후속) | TF-16 'AI 업무 위임'과 단순 S1 업무 연결 **같다고 보고하지 않기** |
| 데이터 | projects+project_members+project_tasks (+pm_plans `022` 실제 적용된 환경), owner/active-member/assignment, 권한 있는 합산 | RLS·환경 feature flag·snapshot 진실 |
| 이슈 | [#39 C04](https://github.com/happysuyeun-rgb/plan_os/issues/39), [#32 PM](https://github.com/happysuyeun-rgb/plan_os/issues/32), [#36 코드 리뷰](https://github.com/happysuyeun-rgb/plan_os/pull/36#issuecomment-6332797665) | G1/PM 코드 안정화 우선, 별도 Dashboard 개발 PR |

## 5. 권장 개발 순서

1. **안전 게이트**: V5-01/02 direct API 우회 테스트·서버 guard 적용, V5-03~07 설계/코드 차이 수정. 별도 리뷰에서 P0=0 재확인.
2. **C04 V1 읽기 전용 프로젝트 운영 요약**: S1 실서버 모드 + RLS read, 프로젝트별 업무 상태와 막힘 카드. PM 채용 없이 사용 가능.
3. **PM 승인 연결**: `022` 안정화 및 실 서버 활성화 환경에서 승인대기 카드만 데이터 연동. 존재하지 않는 정식 승인함/인력 운영을 fake 0으로 표시하지 않음.
4. **N29 V2**: 실제 정식 PM 프로젝트 배정·인가·worker/비용/감사 검증 이후 사용자 대시보드 통합 query로 확장.

**배포 차단:** 이 문서/코멘트가 병합·운영 DB 마이그레이션·Vercel 배포·유료 모델 실행·실고객 데이터 이용을 허가하지 않음.
