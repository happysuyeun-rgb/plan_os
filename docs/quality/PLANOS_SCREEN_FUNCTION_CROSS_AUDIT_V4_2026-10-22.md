# PlanOS 3.0 — 화면설계·기능정의·Task Flow·실코드 교차감사 V4 (2026-10-22)

**감사 목적:** Cursor가 TARGET 문서와 현재 실제 기능·Mock PR을 혼동하거나 같은 기능을 다른 URL/API/테이블로 두 번 만들지 않게 한다. [Cursor 실행전략](../plans/CURSOR_SPEC_DRIVEN_EXECUTION_STRATEGY_2026-10-22.md)의 선행 결함 대장.

**읽고 대조한 근거:** [FUNCTIONAL_SPEC](../product/FUNCTIONAL_SPEC_V1_2026-10-20.md) 전체 F-001~801 + STAFF-01~11, [Task Flow](../product/TASK_FLOWS.md) TF-01~46, [IA](../ux/IA.md) C01~11/N01~32, [화면명세](../ux/SCREEN_SPEC.md), [전체 화면 수용 매트릭스](../ux/PLANOS_ALL_SCREENS_ACCEPTANCE_MATRIX_2026-10-21.md) C01~11/N01~32, [직원 상세 스토리보드](../ux/AI_STAFF_SCREEN_STORYBOARD_V1_2026-10-21.md), [UX Flow](../ux/UX_FLOWS.md), [PRD](../product/PRD.md), [data/auth 계약](../engineering/AI_STAFF_DATA_AUTH_CONTRACT_V1_2026-10-21.md), [권한](../product/PERMISSIONS_POLICY.md)/[QA](TEST_PLAN_2026-10-20.md), 그리고 GitHub `main` HEAD `3e3fc660`의 `src/App.tsx`, `src/lib/documentTypes.ts`, `src/lib/api/generation.ts`, `src/pages/ProjectTasksPage.tsx`, `src/pages/AuditSourceSelectionPage.tsx`; PR #25/#27/#30의 화면 및 저장 변경. **검증은 코드 정적 감사/PR·CI 확인이며 사용자 브라우저 E2E 재실행 또는 hosted DB를 새로 조회한 것은 아님.**

**판정:** `FIX-DOC` 문서 정정, `FIX-CODE` 개발 필요, `NEEDS-DECISION` 실제 제품 승인 필요, `VERIFY` 코드/CI·실 DB 확인 필요. 중요도 P0=사용자 데이터/인가/첫 실제 루프 차단, P1=다음 구현에서 누락·반복 개발 위험, P2=문서 색인·성능/카피 개선. **문서에 수정사항이 반영됐더라도 테스트/개발 완료로 체크 금지.**

## 1. 발견한 누락·불일치와 해결 기준

| ID | 중요 | 구체 증거 / 불일치·누락 | Cursor가 따를 단일 수정 방향 | 상태 |
|---|---|---|---|---|
| **A4-01** | P0 | `FUNCTIONAL_SPEC §3` F-201/202 ‘설계만’ vs **main** `/projects/:projectId/audits/new`, SHA256·`VITE_S2_MANIFEST_RPC` 기반 manifest 코드 이미 일부 존재 | ‘일부 코드, 개발 플래그, 격리 DB/실행 연계 미검증’으로 표기. UI 소스 선택·manifest를 다시 구현하지 않음 | FIX-DOC |
| **A4-02** | P0 | F-301/401 ‘설계만’ vs **PR #25** 전문직원 요청/계약·비용 안내 Mock, **PR #27** F401 사람 작성 계획 Mock와 실제 Chromium CI 존재 | Mock-only PR 상태와 실제 계약/저장/AI PM 미구현을 각각 표기, 정확한 기존 코드를 DEV-01 기반으로 재사용 | FIX-DOC |
| **A4-03** | P0 | `FUNCTIONAL_SPEC F-401`, `PERMISSIONS_POLICY`, N08 화면은 **owner/editor 계획 초안 허용**. PR #27 UI는 `currentProject.user_id===userId` owner-only | draft 작성은 owner/editor, 최종 승인·예산·외부전송·산출물 수락은 owner. JWT/RLS role check + UI 권한 검사 수정 | FIX-CODE |
| **A4-04** | P0 | `SCREEN_SPEC §7`, `FUNCTIONAL_SPEC §131`에서 `STAFF-API-01~14`라고 표시 vs 실제 [data/auth](../engineering/AI_STAFF_DATA_AUTH_CONTRACT_V1_2026-10-21.md) 정본 **STAFF-API-01~15**, API-15 owner 최종 채용 확정 | 15까지 동일 링크와 draft(04)/accept(15) 구분. 직원 채용 최종 수락·프로젝트별 동의·동시성 누락 금지 | FIX-DOC |
| **A4-05** | P1 | `SCREEN_SPEC` ‘MVP 9개+잔여 14개’ 표와 끝의 N24~32 확장; `IA`에는 N01~32, ST-UI01~10, 서비스기획 P-01~12 | 9개는 예전 N01~23의 *우선 상세화 범위*일 뿐 전체 화면 건수가 아님. 구현 ID **C01~11, N01~32**, ST-UI/P는 alias, N24/25는 N16/17 패널 | FIX-DOC |
| **A4-06** | P0 | `SCREEN_SPEC N03/N08` 후보 `/workspace/:projectId/tasks`, `/workspace/:projectId/plan`; `FUNCTIONAL_SPEC` `/projects/:projectId/tasks`, `/projects/:projectId/plans/:planId`. **main**의 업무 URL은 후자 계열, 신규 `/workspace` 없음 | 이번 DEV-01은 existing `/projects/:projectId/tasks`, PR #27 `/projects/:projectId/plans/new` 재사용. 기존 `/projects/:projectId[/:docType]`는 DocumentPage 유지. `/workspace`는 장기 후보만 | FIX-DOC + VERIFY |
| **A4-07** | P0 | `F-401` ‘계획 초안 저장/재조회’가 acceptance인데 PR #27 초안은 React 메모리 상태만, 새로고침 유실을 고지 | DEV-01에 안전한 실제 계획 데이터 저장/재조회 + revision·동시수정/유실 복구 + RLS 테스트 필수 | FIX-CODE |
| **A4-08** | P0 | `SCREEN_SPEC N08/UX_FLOWS`에 모델이 PM 계획 생성→승인 흐름만 보이며 F401 사람 초안 Mock과 혼재 | N08의 ‘작성 주체’(human vs real AI/worker)를 별도 필드/배지. 무과금 사람 작성은 계약/유료 호출 없이 draft 가능; 실제 모델 계획은 별도 제공사·데이터 전송/비용 동의 이후 | FIX-DOC + FIX-CODE |
| **A4-09** | P0 | 기존 ‘AI 인터뷰→5종 기획서 자동생성’ 설명은 실제 LLM 수행처럼 읽힐 수 있으나 `main src/lib/api/generation.ts`는 `placeholderContent.ts` 고정 템플릿 | 기능 화면 유지 + **TEMPLATE/AI LIVE** 표시 분리. 생성 품질 개발·공급자 승인/원가/권한은 후속 실제 범위. 템플릿 출력을 실모델 성공으로 집계 금지 | FIX-DOC + FIX-CODE |
| **A4-10** | P1 | 같은 제품을 문서 곳곳에서 ‘5종’ 또는 ‘6종’이라 표기. `src/lib/documentTypes.ts` 실제 **6개 생성 타입**, UI만 `screen_list`를 숨긴 5타입 | ‘내부 생성 6종, UI 노출 5종’으로 정확히 고치고 문서 export/목록/와이어프레임/화면 목록 회귀 확인 | FIX-DOC |
| **A4-11** | P0 | `SCREEN_SPEC §4`에 계획 승인 후 `queued`로 곧장 이동하는 전이; 계획·실행·승인·산출물의 상태가 같은 리소스로 보임 | 계획: draft→pending_owner_approval→approved/needs_revision/rejected. 실행: 별도 run `queued/running/verifying`. 검증: report validated ≠ owner accepted. 승인 직후 유료 자동 실행 금지 | FIX-DOC |
| **A4-12** | P0 | F-402의 plan 상태/DB 데이터 정본, `expectedVersion`, `sourceDigest`, 멱등 승인·S1 생성 1건/commit 경계, retry/rollback이 스토리보드와 기능정의서에 충분히 상세하지 않음 | [Issue #32](https://github.com/happysuyeun-rgb/plan_os/issues/32) 기준 **실행 가능한 F-401/402 UX+테스트 계약 추가**: 계획 생성자, 상태별 CTA, owner approval CAS, approval 사건 immutable, task 연결 unique, failure restore | FIX-DOC + FIX-CODE |
| **A4-13** | P0 | `API_CONTRACTS` `/api/v1/`은 TARGET이나 React 실제는 Supabase direct API 사용. 브라우저만 API-05/06 호출하면 404 | 신규 BFF/Edge endpoint는 실제 구현 시 선택하고 route/RPC/DTO를 적는다. 이름만 있는 TARGET API를 호출하지 않는다. 서버인가·멱등은 실제 RLS/RPC에서 증명 | FIX-CODE |
| **A4-14** | P1 | 신규 화면 N02/N04/N05/N06/N07/N09/N10/N13~15/N18/N21~23은 한 줄 매트릭스/간략 전략일 뿐 **화면별 상세 이벤트·입력·실패 스토리보드 부족** | 해당 화면을 작업할 때 11요소 계약(entry, CTA, field, state, actor, error, success route, audit, keyboard, mobile) 충족. 이번에는 **N03/N08/N09/N12** first slice 상세 인계부터 | FIX-DOC + FOLLOW-UP |
| **A4-15** | P1 | N11 결과 검토와 N12/N13 승인함이 중복 ‘최종 수락’ 버튼 저장 사건을 만들 위험 | 동일 `artifact_id + revision`에 대한 최종 판단은 N11/승인함에서 **하나의 서버 acceptance 이벤트**만; 동일 request id 재시도 중복 0 | FIX-DOC / VERIFY |
| **A4-16** | P0 | 직원 N27 A/B 다중 배정과 N28 고객 공개/경력 동의가 별도 owner/project 검증 없이 한 계약에서 자동 허용될 위험 | STAFF-API-15 owner 전 프로젝트 검사/원자 계약 vs 별도 모델 전송 동의 vs 경력 적립/공개/평가·홍보 동의. 미선택 C·미동의 공개 OFF | FIX-CODE / NEEDS-DECISION |
| **A4-17** | P1 | 경력 등급을 검증 능력, 모델 패키지, 가격과 연결하는 UI가 실측 없는 품질 프리미엄으로 오인될 수 있음 | 경력/능력 평가일·테스트 출처/모델/가격 기준 독립. 검증 없는 배지·가짜 활동일/별점 금지. 사업개선 PR #31 IMP-04/08/09 | FIX-DOC / NEEDS-DECISION |
| **A4-18** | P0 | `main` 011 S1/012 S2 migration은 코드 존재와 실제 hosted 적용이 다름. PR #30 013~019/CAS는 2026-10-22 최신 확인 `d9e34e9` OPEN Draft, main 미반영 | Cursor가 schema 존재라 가정 금지. `supabase/drafts/017`·020 cutover는 미적용, 실제 hosted schema/릴리스 승인 분리. G1 완료 전 S1/plan 영속 서버 모드 운영 금지 | VERIFY |
| **A4-19** | P1 | 이전 [개발 운영규칙](../plans/PLANOS_WORK_EXECUTION_PROTOCOL_2026-10-21.md)은 ‘S3 Mock 첫 수직 개발’을 현재 다음 작업으로 지시, PR #25/#27 이미 Mock 검증 성공; 신규 [Issue #32](https://github.com/happysuyeun-rgb/plan_os/issues/32)와 충돌 | 다음 단위는 **F401 DB draft→F402 승인→S1 업무 link**. 문서 리뷰만 반복하지 않고 코드 + 실제 격리 테스트 + Draft PR을 생성 | FIX-DOC |
| **A4-20** | P1 | `TASK_FLOWS.md` 본문 제목/상태는 TF-01~30인데 실제 TF-31~46까지 정의, `SCREEN_SPEC` 상위 TF/버전도 30으로 표시 | 모든 구현용 레퍼런스의 제목/상위 기준을 **TF-01~46**으로 수정. 과거 TF-S는 alias만 | FIX-DOC |
| **A4-21** | P1 | F-601 보고서가 ‘owner 전용 비공개’로 적혔으나 일반 `PERMISSIONS_POLICY`의 AI run 로그/산출물은 editor 읽기 허용(조건부 viewer) | **제품 정책 결정 분리**: 첫 검수 원문/AI 결과·비용/비공개 소스는 owner only로 제한, 협업 요약 접근은 별도 server allowlist 설계. 업무별 허용 필드는 가격/원문을 자동 포함하면 안 됨 | NEEDS-DECISION |
| **A4-22** | P1 | 사용성·사업 검증에서 ‘AI 직원 보이기/채용 완료’만 기록하면 PM 유료 가치 미검증 | 첫 실제 루프 지표: 제안→owner 승인→업무 수락률/재작업/고객 절감시간·재방문. 기본 AI vs 정식 PM 비교; 외부 지불 실증 전 매출/수익 확정 금지 | FIX-DOC / TEST |

## 2. 화면별 실제 작업 추적 — 모두 한 번씩 검토한 범위

여기서 `CURRENT`는 **main 라우트/기초 코드 확인**이지 운영 API 검증 완료가 아니다. `MOCK`는 별도 Draft PR 코드만. `TARGET`은 문서 정의만.

| 화면군 | 현재 증거 | 필수 연결/보존 | 다음 구현 판정 |
|---|---|---|---|
| **C01~C03** | main 랜딩/로그인/온보딩 | 기본 AI 시작, 세션 만료/취소/공급자 동의 분리 | KEEP/회귀; 새 채용 필수로 만들지 않음 |
| **C04~C08** | main 대시보드/프로젝트 목록·생성/휴지통/설정 | N01 프로젝트 허브 진입, staff 공개·소유권, 과금 숨김 | KEEP + 안전한 확장 |
| **C09~C11** | main 문서/유형 딥링크·404, G1 PR #30 검증 중 | 문서 6타입/표시 5종, 채팅/버전/복원/CAS/MD·ZIP 보존 | 절대 기존 문서 URL 재할당 금지 |
| **N01~N02** | 신규 허브/브리프 TARGET | 기존 AI 기획 진행→업무/직원 중간 투입·문서 revision | 재사용 후보; 최초에는 C09/C10 링크와 S1 |
| **N03~N05** | N03=main S1 보드(로컬 기본), N04 TARGET, N05=main 문서/S2 selector 부분 재사용 | F-101~105, F-201/202, task 상태·승인 전 run 불가 | DEV-01/02 실제 연결 |
| **N06~N07** | TARGET | 프로젝트 AI 팀·계약/권한·직원 배정·A/B/C 분리 | 직원 계약 서버 이후 |
| **N08~N09** | N08 초안=PR #27 Mock, N09 TARGET | 사람/AI plan 타입, 실제 서버 초안, owner 최종 승인, stale/digest | **최우선 실제 개발** |
| **N10~N11** | TARGET (기존 QA/소스 선택 코드 참고) | 실행/결과 증빙, pending/accepted 분리, 실패·원가 표시 | 안전한 run·report 뒤 |
| **N12~N13** | TARGET | 동일 approval ID의 프로젝트 승인함·상세, N11 acceptance 중복 금지 | DEV-02 최소 구현 |
| **N14~N15** | 비용 TARGET/댓글·활동 기존 일부 | 원가/요금 분리, 기존 댓글/알림 RLS 회귀 | 후속 적용 |
| **N16+N24** | TARGET, S3 PR #25 한 전문직원 요청 Mock 별개 | 실제 직원 목록 하나, 직무·성향·모델·등급·가격 범위 | 경력/직원 데이터 Mock 먼저 |
| **N17+N25** | TARGET | 프로필 하나, 가상 캐릭터 vs 합성 역량 vs 고객동의 실경력 | 다음 인력사무소 UX |
| **N18** | TARGET | 업무 적합성 시연, 실모델/비용/외부전송 구분 | 실제 호출 조건 검증 후 |
| **N19~N21+N26** | TARGET, PR #25 계약 ‘review_only’ Mock만 | 정식 채용/단발, terms, owner 최종, 해임/교체/비용 영향 | STAFF-API-04 draft와 -15 accept를 분리 |
| **N22~N23** | TARGET, 기존 설정/알림 일부 | 통합 승인함은 N12 이벤트 공유, 동의/계약 설정 owner | 서버 approval/consent 재사용 |
| **N27~N28** | TARGET | PM A/B 명시 owner 체크, C 거부; 경력 적립/공개 OFF·전송 동의 분리 | 독립 권한 QA 후 |
| **N29** | TARGET | PM 한/복수 프로젝트 브리핑, 실제 scheduler 없으면 ‘자동 운영 중’ 금지 | 한 프로젝트 검증 후 확대 |
| **N30~N32** | TARGET | 실제 사람 수락·종료 평가, 공개 가능 이력·승급·철회/재계산 | 동의 기반 원장·실원가 후 |

## 3. 첫 개발 슬라이스의 상세 화면↔기능↔QA 인계

### N08: 사람 작성 계획 초안 → 실제 서버 draft (F-401; TF-13)
- **진입:** 기존 `/projects/:projectId/tasks` 업무 보드에서 `계획 작성`. 별도 후보 `/projects/:projectId/plans/new`는 PR #27에서만 존재하므로 통합 전 후보 여부를 검증.
- **owner/editor:** 목표 10~1000자, 단계 1~20, 각 제목 1~120·완료 기준 5~500, 선행 단계는 현재보다 앞선 단계만 선택(현재 F401 Mock 검증과 호환). 서버-side 동일 validation. editor는 계획 생성/수정, owner만 최종 결정.
- **UI 상태:** loading/empty/dirty/saving/saved/validation_error/conflict/forbidden/not_found/review_pending. 저장 실패 후 입력값을 버리지 않고 로컬 복구 선택.
- **서버 원칙:** project_id/actor와 document source revision·plan expectedVersion 검사, 일반 사용자 원본 문서에 대한 암묵적 쓰기·모델 외부 전송 0. 새 plan/steps/approval tables가 실제 존재할 때만 영속 제공.
- **수용:** 같은 프로젝트 재방문/새로고침/2탭에서 일치, 타 프로젝트 ID 403/404, 승인 요청은 별도 버튼/이벤트, AI 자동실행 0.

### N09+N12: 계획 승인 요청/owner 결정 (F-402; TF-14)
- **초안 작성과 승인 구분:** 사람 작성 `draft`가 서버 저장돼도 `approved`가 아니다. `requestApproval` 후 `pending_owner_approval`; `owner approve/reject/needs_revision` 세 가지. editor는 승인함 요약을 볼 수 있는 정책을 별도로 정하되 owner CTA 금지.
- **필수 표시:** plan ID/version/제안자, 프로젝트/문서 digest 시점, 수정 diff/step acceptance criteria, 실행비용 0(이 단계는 실제 모델 미호출), 승인/거부 주체·이유·시간.
- **서버 경계:** owner JWT+프로젝트 활성/멤버십 재확인, version/digest stale 때 409+현재 상태 조회, `Idempotency-Key` 반복 승인도 같은 사건. 승인함 N12는 N09로 딥링크일 뿐 중복 승인 생성 없음.
- **수용:** owner만 1회 최종 결정, editor/viewer/outsider 0, 잘못된 다음 단계/해지 프로젝트 차단, 중단·reload 후 승인 이력 동일.

### N03+N04: 승인된 계획을 S1 실제 업무로 1회 반영 (F-101~105; TF-15~16)
- 승인된 plan의 선택 step → `project_tasks` 생성. DB/idempotency unique `plan_step_id` or immutable link·outbox로 재요청 중복 0. 계획 승인과 업무 생성의 원자 경계/지연 실패 시 복구 경로 먼저 결정.
- `project_tasks`는 사람 업무 enum `todo/in_progress/in_review/blocked/done`. AI 전문 검수 `run`은 별도 자원; Task 완료≠run 성공≠사람 보고서 수락. 본 슬라이스에서 전문 AI 실행·유료 호출은 0.
- 현재 main S1은 기본 `localStorage`; 실 DB 플래그가 안전하게 활성화돼 실제 격리 JWT/RLS 테스트를 통과해야 계획→업무 연결을 서버 기능 완료로 볼 수 있다.
- **수용:** 승인 1번→task 1개, editor 초안 입력 허용, owner 승인 권한, 다른 프로젝트 task/source 주입 차단, refresh/중복클릭/동시 승인/네트워크 장애 보호.

## 4. 결함 처리 우선순위 및 종료 기준

1. **차단 P0** A4-03/07/11/12/13/18 + G1 데이터 안전. 이를 해결하기 전 DEV-01/02 ‘완료’ 선언 금지. A4-09 기본 AI 실제 생성 여부는 상품·UI/품질 표기에서 반드시 격리.
2. **Cursor 작업 시작 전 문서 정리** A4-01/02/04/05/06/10/19/20. 본 PR #28에서 해당 파일의 직접 수정/정본 링크로 조정.
3. **후속 구현 범위** A4-14/15/16/17/21/22. 중장기 N16~32의 상세 수용은 화면별 패키지마다 테스트로 확장; 미결정을 임의 가격·권한으로 출시하지 않는다.

**QA 최저선:** spec link 검사 + 변경되는 F/TF/N-ID/Git commit hash + build/lint + isolated JWT/RLS actual DB(적어도 owner/editor/viewer/outsider/A/B) + Chromium 재접속/2탭/409 + 이전 DocumentPage/인터뷰/타입·버전·채팅 회귀. 유료 모델/실 DB/배포는 별도 승인. **완료 보고는 PASS/FAIL/NOT RUN 증빙만**.

**범위:** 이 파일은 실제 코드와 문서 간 정적 교차감사 및 첫 실행용 상세 보완. 브라우저/hosted DB 테스트를 신규 수행하지 않았고, 신규 화면·API·서버 구현 완료 판정은 하지 않는다.
