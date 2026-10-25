# 권한 매트릭스 (CURRENT / TARGET)

**작성·수정일:** 2026-10-25 · **버전:** v1.0  
**근거 코드:** `permissions.ts`, `reviewAccess.ts`, SpecialistRequestMockPage, project_tasks RLS  
**역할 CURRENT:** `owner` | `editor` | `viewer` | (비멤버=`null`, 문서의 outsider에 해당)

---

## 1. 범례

| 기호 | 의미 |
|---|---|
| R | 조회 |
| W | 생성·수정 |
| A | 승인·수락·결정 |
| X | 차단(UI·클라이언트·또는 RLS) |
| M | Mock만 · 실계약/실실행 아님 |
| T | TARGET(미구현) |

HTTP 403/404 마스킹은 **TARGET**. CURRENT 비멤버는 주로 EmptyState/안내 문구.

---

## 2. 화면·기능별

| 기능 / 화면 | owner | editor | viewer | 비멤버 | 비고 |
|---|---|---|---|---|---|
| 문서 C09/C10 | R/W | R/W | R | X(안내) | DocumentPage |
| S1 업무 목록/상세 | R/W | R/W | R | X | soft-delete/restore=**owner만** |
| F-105 담당 유형 Mock | R/W | R/W | R | X | localStorage user+project 스코프 |
| 사람 PM `/plans` | R/W/A | R/W | R | X | 승인/반려=owner |
| AI 카탈로그 `/specialists` | R | R | R | X | 설명만 M |
| 채용 요청 `/specialists/request` | W M | X | X | X | **owner-only Mock** |
| AI 검수 `/ai-review` view | R M | R M | R M | X | **CURRENT:** viewer도 Mock findings 조회 가능. **TARGET:** 비공개 `ai_artifacts`는 viewer **거부** — 정책 충돌 명시(DEC-RBAC-01) |
| AI 검수 hire/run/accept | A M | A M | X | X | **CURRENT: editor 허용** (`reviewAccess`). TARGET 유료 레인=owner-only·**위임 API 없음** |
| 사람 PM 승인 | A | X | X | X | `transition_pm_plan` owner |
| 계약 `/contracts` | T | T | T | T | 미구현 · digest consent TARGET |
| 실행 `/runs` · artifact accept | T | T | T | T | 미구현 · RLS 계약 미실증 |
| 감사 소스 `/audits/new` | R/W | R/W | R? | X | `audit_source_manifests` · owner read RLS |

**RLS/API 일치:** S1 tasks·PM은 membership RLS와 대체로 정합. Mock 검수는 **클라이언트 가드만**(서버 RLS artifact 없음). TARGET 매트릭스≠CURRENT Mock을 「구현 완료」로 오인 금지.

---

## 3. 정책 결정 대기

| ID | 이슈 | CURRENT | 후보 |
|---|---|---|---|
| DEC-RBAC-01 | Mock 검수 accept/run·viewer view 잠금 시점 | owner\|editor run; viewer view | 유료 LLM·실계약 시 owner-only + viewer 산출물 거부 |
| DEC-RBAC-02 | 채용 Mock을 editor에게 열지 | owner only | 제품 결정 전 유지 |
| DEC-RBAC-03 | editor 승인·실행·수락 **위임** 기능 | **없음**(문서만) | POL-01 승인 후 API/DDL |
| DEC-HTTP-01 | 비멤버 404 마스킹 | EmptyState 문구 | 서버 일괄 404는 Preview/RLS 이후 |
