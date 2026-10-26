# 상태·용어 기준표 (CURRENT / TARGET)

**작성·수정일:** 2026-10-25  
**문서 버전:** v1.0  
**기준 tip:** 본 브랜치 F-105 정합화 작업 · 코드 `src/` 정적 대조  
**원칙:** 리소스마다 **하나의 canonical 심볼**만 DB/API에 쓴다. 화면 별칭은 표시용이며 canonical을 대체하지 않는다.

---

## 1. 사람 업무 (`project_tasks` / prototype)

| Canonical (코드) | 화면 표시(예) | 허용 전이(요약) | 비고 |
|---|---|---|---|
| `todo` | 대기 | → `in_progress`, `blocked` | |
| `in_progress` | 진행 중 | → `in_review`, `blocked` | |
| `in_review` | 검토 중 | → `done`, `in_progress`, `blocked` | |
| `blocked` | 차단 | → `in_progress` (사유 필요) | |
| `done` | 완료 | (종결 · 재오픈 UI 없음) | FD-06: owner 재오픈은 TARGET |

**폐기/혼용 금지:** PRD·구문서의 `draft/planned/accepted`를 사람 업무 상태로 쓰지 않음.

**담당 유형 (F-105 Mock · CURRENT):**
| Canonical | 저장 | 의미 |
|---|---|---|
| `human` | localStorage `planos:s1-ai-assignee-mock:v2:{userId}:{projectId}` + (옵션) `assignee_user_id` | 사람 멤버 |
| `agent` | 동일 localStorage · `agentRoleId=requirements_auditor_v1` | **메타만** · 실행/채용/과금 아님 |

TARGET: DB `assignee_kind` 컬럼 + REST (미적용 · mig 금지).

---

## 2. 사람 PM 계획 (`pm_plans`)

| Canonical | 화면 표시(예) | 허용 행동 |
|---|---|---|
| `draft` | 초안 | editor/owner 편집 |
| `pending_owner_approval` | 승인 대기 | owner 승인/반려/수정요청 |
| `approved` | 승인됨 | 단계→S1 링크 가능 |
| `rejected` | 반려 | |
| `needs_revision` | 수정 요청 | 초안 재편집 후 재제출 |

**폐기:** 문서의 `awaiting_approval` → canonical은 **`pending_owner_approval`**.

소스: `human` | `ai_suggested` (표시 구분 · AI PM 실행 아님).

---

## 3. AI 기획 검수 Mock (`ReviewJob`)

| Canonical | 화면 | 비고 |
|---|---|---|
| `queued` | 대기 | |
| `running` | 실행 중 | Mock 휴리스틱 · 유료 LLM 아님 |
| `awaiting_human` | 사람 검토 대기 | finding 수락/수정요청 |
| `accepted` | 수락됨 | finding→S1 가능(입력 충분 시) |
| `rejected` | 수정 요청(검수 job) | 사람 PM `needs_revision`과 **별 리소스** |
| `failed` | 실패 | |

**TARGET 서버 run** (`validating/succeeded/…`)과 혼용 금지.

---

## 4. 계약 (F-302 · TARGET)

| Canonical (목표 DB) | CURRENT |
|---|---|
| `draft` / `active` / `revoked` / `expired` | **라우트·서버 계약 없음**. Mock은 `review_only` 고지만 |

화면 별칭 `accepted`는 **사건**이지 계약 상태 아님 (FD-09).

---

## 5. 연결 규칙

- 업무 상태 ≠ 계획 상태 ≠ 검수 job 상태 ≠ 계약 상태.
- Mock 검수 `rejected` ≠ PM `needs_revision` ≠ TARGET artifact `needs_revision`.
- F-105 `agent` ≠ specialists 채용 ≠ `/ai-review` hire.
