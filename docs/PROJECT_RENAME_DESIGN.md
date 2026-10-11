# PlanOS — 프로젝트명 수정 설계

> 작성일: 2026.06.12 · **갱신: 2026.06.12 (v2.1)**  
> 기준: `TECH_SPEC.md`, `MEMBER_PERMISSIONS_DESIGN.md`  
> 상태: **DASH/PROJ ✅ (모달) · DOC-001 ✅ (인라인)**

---

## 1. 목표

| 목표 | 설명 |
|------|------|
| **접근성** | 대시보드·프로젝트 목록·산출물 편집 화면 어디서든 이름 변경 가능 |
| **일관성** | 동일 API(`updateProject`)·동일 검증 — **DOC는 인라인**, DASH/PROJ는 모달 |
| **권한** | `project.edit_meta` — **owner만** (editor/viewer 불가) |
| **추적** | L4 활동 로그 `project_rename` 기록 |

---

## 2. 현재 구현 (갱신)

| 화면 | 코드 | 진입점 | UI | 상태 |
|------|------|--------|-----|------|
| 대시보드 | DASH-001 | 카드 **⋮** 또는 우클릭 → 이름 변경 | `RenameProjectModal` | ✅ |
| 프로젝트 목록 | PROJ-001 | 카드 **⋮** 또는 우클릭 → 이름 변경 | `RenameProjectModal` | ✅ |
| 산출물 편집 | DOC-001 | 헤더 **프로젝트명 클릭** | `EditableProjectTitle` (인라인) | ✅ |
| 프로젝트 생성 | PROJ-002 | 생성 폼 `title` (최초 1회만) | 폼 입력 | ✅ |
| 휴지통 | TRASH | 이름 변경 없음 (복원 후 변경) | — | — |

---

## 3. UI 설계

### 3.1 DASH-001 / PROJ-001 — 카드

```
┌─────────────────────────────┐
│ [SaaS]              ⋮  6/8  │
│ 프로젝트 제목                  │
│ 설명 미리보기...               │
│ [PRD][IA]...                  │
└─────────────────────────────┘
```

- 카드 클릭 → DOC-001 진입
- **⋮** 또는 우클릭 → `ContextMenu`
  - 이름 변경 → `RenameProjectModal`
  - 휴지통으로 이동

### 3.2 DOC-001 — 산출물 편집 (v2.1)

```
헤더 1행:  ← 대시보드  [프로젝트명]  [PRD][기능명세서][정책서]…  [멤버]
```

- `project.edit_meta` 권한 있을 때 프로젝트명 **클릭** → 인라인 편집 (`EditableInlineTitle`)
- Enter 저장 / Esc 취소 / blur 시 저장
- `RenameProjectModal` **미사용** (DASH/PROJ만 모달)
- 저장: `updateProject({ title })` → `currentProject`·헤더 즉시 반영 + `logProjectActivity`

---

## 4. API·상태

| 계층 | 처리 |
|------|------|
| API | `PATCH projects SET title = ?` (`lib/api/projects.ts` → `updateProject`) |
| Store | `projectStore.updateProject` — `projects[]` + `currentProject` 동기 갱신 |
| Hook | `useProjectActions` — DASH/PROJ 공용 rename/trash 상태 |
| DOC | `EditableProjectTitle` — 인라인 저장 + `logProjectActivity` (모달 없음) |

### 검증 규칙

| 규칙 | 값 |
|------|-----|
| 최소 길이 | 2자 |
| 최대 길이 | 50자 |
| 공백만 | 불가 |
| 중복명 | 허용 (MVP) |

---

## 5. 권한 (`MEMBER_PERMISSIONS_DESIGN.md`)

| 역할 | `project.edit_meta` | 이름 변경 |
|------|---------------------|----------|
| owner | ✅ | ✅ |
| editor | ❌ | ❌ |
| viewer | ❌ | ❌ |

프로젝트 `user_id`와 일치하면 owner로 해석 (`resolveMemberRole`).

---

## 6. 활동 로그 (L4)

```typescript
logProjectActivity({
  project_id,
  action: 'project_rename',
  meta: { from: string, to: string },
})
```

히스토리 패널 「활동」탭에 「프로젝트명 변경」으로 표시.

---

## 7. 컴포넌트

| 컴포넌트 | 경로 | 역할 |
|----------|------|------|
| `RenameProjectModal` | `project/RenameProjectModal.tsx` | 이름 입력 모달 (DASH/PROJ) |
| `EditableInlineTitle` | `common/EditableInlineTitle.tsx` | 클릭→인라인 편집 공통 |
| `EditableProjectTitle` | `project/EditableProjectTitle.tsx` | DOC 헤더 프로젝트명 |
| `ProjectCardItem` | `project/ProjectCardItem.tsx` | ⋮ 메뉴 + rename 연결 |
| `useProjectActions` | `hooks/useProjectActions.ts` | rename/trash 상태·핸들러 (DASH/PROJ) |

---

## 8. 비범위 (V2)

- 프로젝트 설명(`description`) 인라인 수정
- 팀 멤버(editor)에게 메타 수정 권한 부여
- 이름 변경 시 연쇄 파일명 자동 갱신 (export는 저장 시점 제목 사용)
