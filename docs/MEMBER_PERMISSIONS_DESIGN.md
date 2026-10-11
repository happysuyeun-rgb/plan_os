# PlanOS — 프로젝트 멤버 권한 체계 설계서

> 작성일: 2026.06.10  
> 연관: [`HISTORY_AND_EXPORT_DESIGN.md`](./HISTORY_AND_EXPORT_DESIGN.md), [`TECH_SPEC.md`](./TECH_SPEC.md)

---

## 1. 역할(Role) 정의

| 역할 | 코드 | 설명 | 부여 방식 |
|------|------|------|----------|
| 소유자 | `owner` | 프로젝트 전체 관리 | 프로젝트 생성자 1명 (고정) |
| 편집자 | `editor` | 산출물 편집·AI 사용 | 초대 시 지정 / 소유자가 변경 |
| 뷰어 | `viewer` | 읽기 전용 | 초대 시 지정 / 소유자가 변경 |

**초대 상태 (`status`)**

| 상태 | 접근 | 설명 |
|------|------|------|
| `pending` | ❌ | 초대 메일 발송됨, 수락 전 (로그인 연동 후 활성화) |
| `active` | ✅ | 정상 멤버 |

---

## 2. 권한(Permission) 목록

```typescript
type ProjectPermission =
  | 'project.view'           // 프로젝트·산출물 열람
  | 'project.edit_meta'      // 프로젝트명 등 메타 수정
  | 'project.delete'         // → project.trash alias (휴지통 이동)
  | 'project.trash'          // 휴지통 이동 (T1+)
  | 'project.restore'        // 휴지통에서 복원
  | 'project.purge'          // 영구 삭제
  | 'document.edit'          // 본문 편집·자동저장
  | 'document.regenerate'  // AI 재생성
  | 'document.version_save'// 버전 저장
  | 'document.version_restore' // 버전 복원
  | 'chat.send'              // AI 채팅
  | 'export.md'              // 단일 Markdown
  | 'export.zip'             // 프로젝트 ZIP
  | 'member.view'            // 멤버 목록 보기
  | 'member.invite'          // 멤버 초대
  | 'member.remove'          // 멤버 제거
  | 'member.update_role'     // 권한 변경
  | 'comment.view'           // 코멘트 열람 (C1+)
  | 'comment.create'         // 코멘트·답글 작성
  | 'comment.edit_own'       // 본인 코멘트 수정
  | 'comment.delete_own'     // 본인 코멘트 삭제
  | 'comment.delete_any'     // 타인 코멘트 삭제 (owner)
  | 'comment.resolve'        // 스레드 완료·재오픈
  | 'comment.complete_own'   // 본인 멤버별 완료 토글
```

> 코멘트 권한·Figma 스타일 영역 댓글: [`MEMBER_COMMENTS_DESIGN.md`](./MEMBER_COMMENTS_DESIGN.md) v1.1

---

## 3. 역할별 권한 매트릭스

| 권한 | owner | editor | viewer | pending |
|------|:-----:|:------:|:------:|:-------:|
| project.view | ✅ | ✅ | ✅ | ❌ |
| project.edit_meta | ✅ | ❌ | ❌ | ❌ |
| project.delete / trash | ✅ | ❌ | ❌ | ❌ |
| project.restore | ✅ | ❌ | ❌ | ❌ |
| project.purge | ✅ | ❌ | ❌ | ❌ |
| document.edit | ✅ | ✅ | ❌ | ❌ |
| document.regenerate | ✅ | ✅ | ❌ | ❌ |
| document.version_save | ✅ | ✅ | ❌ | ❌ |
| document.version_restore | ✅ | ✅ | ❌ | ❌ |
| chat.send | ✅ | ✅ | ❌ | ❌ |
| export.md | ✅ | ✅ | ✅ | ❌ |
| export.zip | ✅ | ✅ | ❌ | ❌ |
| member.view | ✅ | ✅ | ✅ | ❌ |
| member.invite | ✅ | ❌ | ❌ | ❌ |
| member.remove | ✅ | ❌ | ❌ | ❌ |
| member.update_role | ✅ | ❌ | ❌ | ❌ |
| comment.view | ✅ | ✅ | ✅ | ❌ |
| comment.create | ✅ | ✅ | ✅ | ❌ |
| comment.resolve | ✅ | ✅ | ✅ | ❌ |
| comment.complete_own | ✅ | ✅ | ✅ | ❌ |
| comment.delete_any | ✅ | ❌ | ❌ | ❌ |

---

## 4. 권한 변경 정책

### 4.1 누가 변경할 수 있는가

- **`member.update_role`**: 소유자만
- 변경 가능 대상: `editor` ↔ `viewer` (비소유자만)
- `owner` 역할은 **권한 변경 API로 부여 불가** (소유권 이전은 V2 `transfer_ownership`)

### 4.2 변경 불가 케이스

| 케이스 | 처리 |
|--------|------|
| 소유자 본인 역할 변경 | 거부 |
| 마지막 소유자 제거/강등 | 거부 |
| pending 멤버 | 역할 변경 가능 (수락 전 초대 수정) |
| 자기 자신 제거 (소유자) | 거부 |

### 4.3 API

```
PATCH /members/:id  { role: 'editor' | 'viewer' }
DELETE /members/:id
POST   /members     { email, role: 'editor' | 'viewer' }
```

Mock: `updateProjectMemberRole(memberId, role)`

### 4.4 활동 로그

권한 변경 시 `project_activities`:

```json
{ "action": "member_role_update", "meta": { "member_id", "from": "viewer", "to": "editor" } }
```

---

## 5. UI 반영 (DOC-001)

| UI 요소 | 조건 |
|---------|------|
| MarkdownEditor 편집 | `document.edit` |
| 재생성 / 버전 저장 | `document.regenerate` / `document.version_save` |
| 버전 복원 | `document.version_restore` |
| ChatPanel 입력 | `chat.send` |
| 보내기 (문서 형식) | `export.md` → E6 이후 `export.document` |
| 보내기 (번들) | `export.zip` → E6 이후 `export.bundle` |
| 멤버 초대 버튼 | `member.invite` |
| 멤버 제거 | `member.remove` |
| 역할 Select | `member.update_role` |

---

## 6. 구현 Phase

| Phase | 내용 |
|-------|------|
| **M1** | `lib/permissions.ts`, `useProjectPermissions`, UI 가드 |
| **M2** | `updateMemberRole` API + MemberPanel Select |
| **M3** | ✅ Supabase RLS — 멤버 DB 접근 (`006_member_project_access_rls.sql`) |

---

## 7. 보내기 형식 확장 시 권한 (E6+)

형식이 늘어나도 **패밀리 단위**로 권한을 유지합니다. 상세는 [`EXPORT_FORMATS_DESIGN.md`](./EXPORT_FORMATS_DESIGN.md) §6.

| 패밀리 | 권한 키 | 포함 형식 |
|--------|---------|----------|
| 문서 | `export.document` | md, html, txt, pdf, docx, clipboard |
| 번들 | `export.bundle` | zip, json, html_bundle |
| 연동 | `export.integrate` | notion, google_docs (E9) |

기존 `export.md` / `export.zip`은 하위 호환 alias로 유지합니다.

---

## 8. 휴지통 시 멤버 접근 (T1+)

상세: [`PROJECT_TRASH_DESIGN.md`](./PROJECT_TRASH_DESIGN.md)

| 상태 | owner | editor / viewer |
|------|-------|-----------------|
| active | 전체 권한 | 역할별 권한 |
| trashed | 휴지통 관리만 | **접근 차단** (목록·DOC) |
| purge 후 | — | — |

---

*구현: `src/lib/permissions.ts`, `src/hooks/useProjectPermissions.ts`*
