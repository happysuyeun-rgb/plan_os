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
| AI 검수 `/ai-review` view | R M | R M | R M | X | |
| AI 검수 hire/run/accept | A M | A M | X | X | **CURRENT: editor 허용** (유료 시 owner-only로 잠금 예정 · 결정 DEC-RBAC-01) |
| 계약 `/contracts` | T | T | T | T | 미구현 |
| 실행 `/runs` | T | T | T | T | 미구현 |
| 감사 소스 `/audits/new` | R/W | R/W | R? | X | S2 Mock/부분 |

---

## 3. 정책 결정 대기

| ID | 이슈 | CURRENT | 후보 |
|---|---|---|---|
| DEC-RBAC-01 | Mock 검수 accept/run 주체 | owner\|editor | 유료 LLM·실계약 도입 시 owner-only (`FIRST_SPECIALIST` 메모와 정합) |
| DEC-RBAC-02 | 채용 Mock을 editor에게 열지 | owner only | 제품 결정 전 유지 |
| DEC-HTTP-01 | 비멤버 404 마스킹 | EmptyState 문구 | 서버 일괄 404는 Preview/RLS 이후 |
