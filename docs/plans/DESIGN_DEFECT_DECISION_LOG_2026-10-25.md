# 설계·코드 결함 및 결정 로그

**작성·수정일:** 2026-10-25 · **버전:** v1.0  
**작업 브랜치:** `fix/planos-f105-docs-align-20261025` (PR #58 계열 결함 수정 + 문서 정합화)  
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

## C. 미결정 (제품 결정 필요 · 코드 임의 변경 금지)

| ID | 내용 | 영향 |
|---|---|---|
| DEC-RBAC-01 | Mock AI 검수 run/accept를 유료화 시 owner-only로 잠글 시점 | PERMISSIONS vs 코드 |
| DEC-RBAC-02 | S3 채용 Mock을 editor 개방 여부 | SpecialistRequest |
| DEC-HTTP-01 | 비멤버 404 마스킹 도입 시점 | DocumentPage EmptyState |
| DEC-IA-01 | `/workspace` vs `/projects` 점진 전환 (IA-D01) | DocumentPage KEEP |
| DEC-F105-DB | `assignee_kind` DB 영속 시기 | mig 승인 전 localStorage 유지 |

---

## D. 미해결 P0 (기능·검증 — 문서 정합화로 완료 선언 금지)

| 항목 | 상태 |
|---|---|
| F-105 DB 영속·실 E2E | 미완 (Mock only) |
| F-302 실계약·철회 화면 | 미구현 |
| Gate A-027 Preview 호스티드 | 미적용 |
| 유료 LLM / Production | 금지·미진행 |
| placeholder 프로젝트 생성 로컬 가드 | 잔여 (REMAINING 1-B) |
| FD-06 done 재오픈 | 미구현 |

---

## E. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-10-25 | 초판: F105-01/02 수정, 상태·권한·추적 산출물, 핵심 문서 CURRENT/TARGET 정합 |
