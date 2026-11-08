# 설계·코드 결함 및 결정 로그

**작성·수정일:** 2026-10-26 · **버전:** v1.2 (최종 검수 잔여 3항)  
**작업 브랜치:** `fix/planos-f105-docs-align-20261025` (PR #59 · 1차+2차 문서 정합)  
**금지:** 운영 DB mig · 유료 LLM · Production · 임의 main 병합

---

## A. IT박사 지적 · PR #58 코드 결함

| ID | 지적 | 수정 전 | 수정 후 | 해결 |
|---|---|---|---|---|
| **F105-01** | 서버 저장 실패 시 localStorage AI 유형이 먼저 기록되어 불일치 | `saveAssignee`가 `writeTaskAiAssignee`를 `patchServerTask` / `replace` **이전**에 호출 | durable 저장 **성공 후**에만 Mock kind 기록 | **해결** (코드+회귀 테스트) |
| **F105-02** | 사용자 전환 시 Mock 담당 격리 부족 | 키 `…:v1:{projectId}` — 동일 브라우저 다른 사용자와 공유 | 키 `…:v2:{userId}:{projectId}`; legacy v1 키 삭제 | **해결** (코드+격리 테스트) |
| 회귀 | 실패·충돌·새로고침·담당 전환 | 부분만 커버 | F105-01 순서 테스트, user 격리, human↔agent, UI 계약 테스트 | **해결**(단위) · 브라우저 E2E는 미선언 |

---

## B. 문서 불일치 (이번 정합화에서 수정)

| ID | Sev | 발견 | 수정 파일 | 근거 |
|---|---|---|---|---|
| DOC-01 | P0 | IA CURRENT 11개만 · tasks/ai-review/specialists/plans 누락 | `IA.md` | `App.tsx` |
| DOC-02 | P0 | F-105·FD-02를 「AI 담당 미구현」으로 기술 | `FUNCTIONAL_SPEC` | F-105 Mock UI |
| DOC-03 | P0 | 상태어 `awaiting_approval` 등과 코드 불일치 | `STATUS_VOCABULARY_*`, MVP/PRD 주석 | `pending_owner_approval` 등 |
| DOC-04 | P0 | 계약/runs/artifacts를 현재 경로처럼 혼재 | FUNCTIONAL 화면 인덱스 · FEATURE_TRACE | Route 없음 |
| DOC-05 | P0 | 사람 PM vs AI PM 혼동 | PRD/IA/SCREEN 주석 · DUAL_ENTRY | `/plans` vs `/ai-review` |
| DOC-06 | P1 | editor 검수 수락 vs 문서 owner-only | `PERMISSION_MATRIX` DEC-RBAC-01 | `reviewAccess.ts` |
| DOC-07 | P1 | F-105 vs hire/review 미구분 | FEATURE_TRACE · HIRE fixture · FUNCTIONAL | 레인 분리 |
| DOC-08 | P1 | E-01 생성 시 이중경로 UI 미구현을 완료처럼 | DUAL_ENTRY | ProjectCreatePage |
| DOC-09 | P2 | tip 커밋 불일치 | REMAINING / DUAL_ENTRY / fixture | 본 작업 기준 |

---

## B2. IT박사 2차 추가 검수 (문서 반영 · 코드 미구현 구분)

| ID | Sev | 지적 | 판정 | 문서 조치 |
|---|---|---|---|---|
| R2-API-01 | P0 | 계획 submit/approve REST vs 이벤트 | **DOC** · CURRENT=`transition_pm_plan`+events | API_CONTRACTS §0 · MVP §4 |
| R2-API-02 | P0 | 산출물 accept/revision/reject | **CODE-MISSING** · Mock≠API-22 | API_CONTRACTS · FEATURE_TRACE |
| R2-API-03 | P0 | 계약 digest·입력 구조 | **CODE-MISSING** · Mock `review_only` | API-11 주석 |
| R2-API-04 | P0 | 업무 생성 status·멱등·버전 충돌 | **DOC+부분코드** · create 멱등키 없음·patch CAS | API §0·MVP |
| R2-API-05 | P0 | 철회·retry·reopen·usage·승인함 등 누락 | **CODE-MISSING**(승인함 pm만 근사) | API §0 표 |
| R2-DM-01 | P0 | `audit_drafts` vs manifest | **DOC** · 정본=`audit_source_manifests` | DATA_MODEL · MVP |
| R2-DM-02 | P0 | tasks 버전·삭제·기한·artifact | **DOC** · due/artifact FK 없음 | DATA_MODEL |
| R2-DM-03 | P0 | 계약·수락 digest·ledger entry_type | **CODE-MISSING** | DATA_MODEL entry_type 후보 |
| R2-DM-04 | P0 | PM 스냅샷/승인 이력 중복 | **DOC** · 단일 행+events | DATA_MODEL |
| R2-DM-05 | P0 | 사람 assignee vs AI roleId | **DOC** · F-105 분리 | DATA_MODEL · F-105 |
| R2-RBAC-01 | P0 | viewer 비공개 산출물 | **정책충돌** · Mock view 허용 | PERMISSIONS · MATRIX |
| R2-RBAC-02 | P0 | editor 승인·실행·수락 | **정책충돌** · Mock editor A | MATRIX · DEC-RBAC-01 |
| R2-RBAC-03 | P0 | MVP 위임 실존 여부 | **없음** | PERMISSIONS · DEC-RBAC-03 |
| R2-TF-01 | P1 | MVP vs 인력사무소 경로 | **DOC** | TASK_FLOWS 두 경로 |
| R2-TF-02 | P1 | TF-22 브리핑 위치 | **DOC** · `/ai-review` 근사 | TASK_FLOWS |
| R2-TF-03 | P1 | 온보딩≠LLM 전송 동의 | **DOC** | TF-02 · THREAT |
| R2-TF-04 | P1 | TF-03 기본 업무 자동 생성 | **DOC** · CURRENT 시드 없음 | TASK_FLOWS |
| R2-OPS-01 | P1 | blocked_reconciliation 절차 | **DOC** (워커 전) | SERVICE_OPERATIONS |
| R2-OPS-02 | P1 | 외부전송 고지·법적 검토 | **DOC** 미완 게이트 | THREAT · OP-03 |
| R2-OPS-03 | P1 | 프롬프트 인젝션 | **DOC** · TM-03 보강 | THREAT |
| R2-OPS-04 | P1 | KPI·측정 이벤트 | **미결정** · 후보만 | THREAT · PRD 유지 |
| R2-OPS-05 | P1 | 분산 testid 통합 | **DOC** | FEATURE_TRACE 표 |

---

## C. 미결정 (제품 결정 필요 · 코드 임의 변경 금지)

| ID | 내용 | 영향 |
|---|---|---|
| DEC-RBAC-01 | Mock AI 검수 run/accept·viewer view를 유료화 시 잠글 시점 | PERMISSIONS vs 코드 |
| DEC-RBAC-02 | S3 채용 Mock을 editor 개방 여부 | SpecialistRequest |
| DEC-RBAC-03 | editor 승인·실행·수락 **위임** API/DDL 도입 여부(POL-01) | API-20 「명시 위임자」 |
| DEC-HTTP-01 | 비멤버 404 마스킹 도입 시점 | DocumentPage EmptyState |
| DEC-IA-01 | `/workspace` vs `/projects` 점진 전환 (IA-D01) | DocumentPage KEEP |
| DEC-F105-DB | `assignee_kind` DB 영속 시기 | mig 승인 전 localStorage 유지 |
| DEC-KPI-01 | 성과 이벤트·목표 KPI 수치 | 계측/실험 설계 |
| DEC-LEGAL-01 | 외부 모델 전송·보존·국외이전 고지 문안 | 유료 LLM 게이트 |

---

## D. 미해결 P0 (기능·검증 — 문서 정합화로 완료 선언 금지)

| 항목 | 상태 |
|---|---|
| F-105 DB 영속·실 E2E | 미완 (Mock only) |
| F-302 실계약·철회·digest consent | 미구현 |
| API-14~23 runs/artifacts/usage/retry | 미구현 |
| 범용 승인함·delegation | 미구현 (pm inbox만) |
| Gate A-027 Preview 호스티드 | 미적용 |
| 유료 LLM / Production | 금지·미진행 |
| viewer/editor Mock vs TARGET RBAC 잠금 | DEC-RBAC-01 대기 |
| placeholder 프로젝트 생성 로컬 가드 | 잔여 (REMAINING 1-B) |
| FD-06 done 재오픈 | 미구현 |
| RLS·보안 검증 | **구분 필수** — 아래 §D.1 |

### D.1 RLS / 보안 검증 상태 (혼동 금지)

| 구분 | 범위 | 상태 (PR #59 기준) |
|---|---|---|
| **일회용 Supabase CI** | workflow `RLS Auth/JWT/PostgREST - disposable local Supabase` · job `auth-postgrest-integration` | **PASS** (제한된 Auth/JWT/PostgREST 회귀). 운영 DB·전체 역할 매트릭스·침투 ≠ 이 결과 |
| **전체 보안 검증** | AUTH-01~12 전수, 운영/Preview RLS 재현, 침투(TM), service_role 우회, 유료 레인 RBAC | **미완료** — 「RLS 실측 0건」은 이 행만 의미. CI PASS를 보안 완료로 오인 금지 |

---

## E. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-25 | 초판: F105-01/02 수정, 상태·권한·추적 산출물, 핵심 문서 CURRENT/TARGET 정합 |
| 2026-10-25 | v1.1: IT박사 2차(R2) API·DM·RBAC·TF·OPS 문서 반영 · 통합 해결표 |
| 2026-10-26 | v1.2: blocked_recon 과금 문구 · API-06/20/22 정본 · RLS CI vs 전체검증 구분 |
