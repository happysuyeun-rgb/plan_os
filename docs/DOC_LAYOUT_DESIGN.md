# PlanOS — DOC-001 레이아웃 설계 (v2.1)

> 작성일: 2026.06.12 · **갱신: 2026.06.12 (v2.1)**  
> 상태: **구현 완료**  
> 연관: [`TECH_SPEC.md`](./TECH_SPEC.md), [`MEMBER_COMMENTS_DESIGN.md`](./MEMBER_COMMENTS_DESIGN.md), [`PROJECT_RENAME_DESIGN.md`](./PROJECT_RENAME_DESIGN.md)

---

## 1. 변경 배경

v1은 **왼쪽 세로 사이드바**에 산출물 탭(PRD, IA…)을 두고, **우측**에 AI 채팅·댓글 토글을 배치했습니다.  
v2에서는 탭을 **상단 헤더**로 올리고, **AI 채팅을 좌측**, **댓글을 우측**에 고정 배치합니다.  
v2.1에서는 헤더를 **1행 통합**, 채팅 패널 **항상 표시**, **편집 가능한 채팅 제목**·**파일 첨부**를 추가했습니다.

---

## 2. 레이아웃 (v2.1 확정)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← 대시보드  [프로젝트명✎]  [PRD][기능명세서][정책서]…        [멤버]      │
├──────────────┬──────────────────────────────────────────────┬───────────┤
│ [채팅제목 ✎] │  DocumentToolbar (편집|리뷰, 버전, export…)    │  🗨 댓글  │
│ AI 채팅 패널 │  본문 (MarkdownEditor / DocumentReviewPane)    │  패널     │
│ (항상 표시)  │                                              │ (토글)    │
└──────────────┴──────────────────────────────────────────────┴───────────┘
```

| 영역 | 컴포넌트 | 너비 | 설명 |
|------|----------|------|------|
| 헤더 1행 | `DocumentLayout` | — | 뒤로가기 · `EditableProjectTitle` · **`DocumentTypeTabs`(가운데)** · 멤버 버튼 |
| 좌측 | `DocumentLeftPanel` + `ChatPanel` | ~360px (max 30vw) | AI 채팅 **항상 펼침** (토글 아이콘 없음) |
| 중앙 | `DocumentToolbar` + editor | flex-1 | 편집·리뷰 본문 |
| 우측 | `DocumentRightPanel` + `CommentSidebar` | 300px + 11px 토글 | 멤버 댓글 |

### v2 → v2.1 변경 요약

| 항목 | v2 | v2.1 |
|------|-----|------|
| 산출물 탭 | 헤더 2행 (탭 별도 줄) | **헤더 1행** 가운데 통합, 활성 탭 밑줄 |
| 좌측 채팅 | 💬 토글(11px) + 접기 | **토글 제거**, 항상 표시 |
| 채팅 헤더 | 고정 「AI 채팅」 | **`chat_title`** 편집 가능 (`EditableChatTitle`) |
| 채팅 입력 | 텍스트만 | **📎 파일 첨부** (최대 5개·5MB) |
| 프로젝트명 | 연필 → 모달 | **클릭 시 인라인 편집** (`EditableInlineTitle`) |

---

## 3. 산출물 탭 (`DocumentTypeTabs`)

- 데이터: `DOCUMENT_TYPE_UI_ORDER` (`lib/documentTypes.ts`)
- **UI에 표시:** PRD, 기능명세서, 정책서, 화면설계서, Cursor 프롬프트
- **UI 숨김:** `screen_list` (화면목록) — 파이프라인·export에는 유지
- 잠긴 탭: `Lock` 아이콘 + 비활성 (생성 전 산출물)
- 뱃지: `vN`, `최종`, 미완료 댓글 수
- 스타일: 활성 탭 **하단 brand 밑줄** (pill 배경 제거)

### 라벨 변경 (2026.06.12)

| `DocumentType` | UI 표시명 | URL |
|----------------|----------|-----|
| `ia` | **기능명세서** | `/ia` |
| `screen_list` | *(탭 숨김)* | `/screen-list` |

---

## 4. 패널 동작

| 패널 | 기본 상태 | 토글 |
|------|----------|------|
| AI 채팅 | **항상 표시** | 없음 (v2.1) |
| 댓글 | 닫힘 (`commentsOpen = false`) | 우측 🗨 버튼 |

리뷰 모드 진입 시 `commentsOpen = true` 자동 설정.  
댓글 모드 활성화 시 리뷰 모드 + 댓글 패널 열림.

쿼리 파라미터: `?panel=comments` | `?thread={id}` (`?panel=chat`는 v2.1에서 불필요)

---

## 5. 채팅 패널 (`ChatPanel`)

### 5.1 채팅 제목 (`chat_title`)

| 항목 | 내용 |
|------|------|
| DB | `projects.chat_title` (`008_project_chat_title.sql`) |
| 자동 생성 | 프로젝트 생성 시 `description` → `title` → 인터뷰 답변 순 (`lib/chatTitle.ts` → `deriveChatTitle`) |
| 편집 | `EditableChatTitle` — 클릭 시 인라인 입력, `chat.send` 권한 |
| 저장 | `updateProject({ chat_title })` |

### 5.2 파일 첨부

| 항목 | 내용 |
|------|------|
| UI | 입력창 좌측 📎 버튼 |
| 제한 | 최대 **5개**, 파일당 **5MB** |
| 형식 | `.txt`, `.md`, `.csv`, `.json`, `.pdf`, 이미지 |
| 전송 | `chatStore.pendingAttachments` → 메시지 본문에 파일명·텍스트 excerpt 포함 |
| 구현 | `lib/chatAttachments.ts` |

### 5.3 입력 UI

- `textarea` 2행, Shift+Enter 줄바꿈 / Enter 전송
- placeholder: `'@'를 입력해 채팅에 항목을 언급할 수 있어요.`
- 글자수 표시 (1000자)

---

## 6. 인라인 제목 편집 (`EditableInlineTitle`)

헤더·패널 상단 제목 공통 컴포넌트 (`src/components/common/EditableInlineTitle.tsx`).

| 동작 | 설명 |
|------|------|
| 클릭 / ✏️ | 편집 모드 전환, 텍스트 전체 선택 |
| Enter | 저장 |
| Esc | 취소 |
| blur | 저장 시도 |

| 사용처 | 컴포넌트 | 검증 |
|--------|----------|------|
| 프로젝트명 (헤더) | `EditableProjectTitle` | 2~50자 |
| 채팅 제목 (좌측 패널) | `EditableChatTitle` | 2~40자 (`validateChatTitle`) |

DASH/PROJ 카드 이름 변경은 기존 **`RenameProjectModal`** 유지.

---

## 7. 제거·대체 컴포넌트

| v1 | v2 / v2.1 |
|----|-----------|
| `DocumentSidebar` (180px 세로 탭) | **삭제** → `DocumentTypeTabs` (헤더) |
| `DocumentRightPanel` (채팅+댓글 토글) | **분리** → `DocumentLeftPanel` + `DocumentRightPanel` |
| 좌측 💬 토글 바 (11px) | **삭제** (v2.1) |
| `chatOpen` 상태 | **삭제** (v2.1) |
| DOC 프로젝트명 모달 | **인라인 편집** (v2.1) |

---

## 8. `DocumentPage` 상태 (v2.1)

```typescript
const [commentsOpen, setCommentsOpen] = useState(false)
// chatOpen 제거 — 채팅 패널 항상 표시
```

---

## 9. 비범위 (V2)

- 1280px 이하 CommentSidebar 드로어 전환
- 채팅 첨부 파일 Supabase Storage 업로드 (현재는 메시지 본문에 메타·텍스트 excerpt만)
- `@멘션` 자동완성 (placeholder만 표시)
