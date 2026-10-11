# PlanOS — 화면별 멤버 코멘트 설계서

> 작성일: 2026.06.10 · **v1.2** (Figma 스타일 영역 코멘트 + DOC 레이아웃 v2)  
> 상태: **C1 Real API ✅** (`005`) · C2~C5 미구현  
> 연관: [`MEMBER_PERMISSIONS_DESIGN.md`](./MEMBER_PERMISSIONS_DESIGN.md), [`HISTORY_AND_EXPORT_DESIGN.md`](./HISTORY_AND_EXPORT_DESIGN.md), [`TECH_SPEC.md`](./TECH_SPEC.md)

---

## 1. 배경 & 목표

### 1.1 문제

PlanOS는 팀 멤버(owner / editor / viewer)를 초대할 수 있지만, **뷰어는 본문을 수정할 수 없어** 리뷰 피드백을 남길 채널이 없습니다. AI 채팅(L3)은 「문서 수정 요청」용이며, 멤버 간 **비동기 협업·리뷰**와는 목적이 다릅니다.

### 1.2 목표 (v1.1 — Figma 스타일)

| 목표 | 설명 |
|------|------|
| **영역 지정 코멘트** | 문서 위 **드래그로 영역 선택** → 해당 위치에 댓글 핀 고정 (첨부 레퍼런스 UI) |
| **대댓글·대대댓글** | 스레드 **무제한 중첩** (`parent_id` 트리) |
| **이모지** | 본문 이모지 입력 + 댓글 **리액션** (👍 ✅ 등) |
| **완료/미완료** | **스레드 전체** 해결 + **멤버별** 완료 체크 (누가 처리했는지 구분) |
| **뷰어 참여** | 읽기 전용 멤버도 영역 코멘트·답글·이모지·본인 완료 처리 |
| **AI 채팅과 분리** | 채팅 = AI 수정 / 코멘트 = 사람 간 협업 |

### 1.3 UX 레퍼런스 (Figma 댓글)

```
┌──────────────────────────────────────────────────────────────────┐
│  [← 대시보드]  프로젝트명                    [멤버] [댓글 패널]   │
├────────────────────────────┬─────────────────────────────────────┤
│                            │  댓글                          🔍  │
│   Markdown 리뷰 뷰          │  ─────────────────────────────    │
│                            │  [미완료] [완료] [전체]  필터      │
│   ┌─ ─ ─ ─ ─ ─ ─ ─┐       │                                     │
│   │  선택 영역      │◉1    │  ◉1 PRD · 목표 사용자              │
│   │  (점선 오렌지)  │       │     서아: 이 부분 KPI 구체화 필요   │
│   └─ ─ ─ ─ ─ ─ ─ ─┘       │     └ 민트: 수정했습니다 @서아       │
│         ┌──────────────┐   │        └ 서아: 확인 완료 ✅          │
│         │ 댓글 입력...  │   │     [👍2] [✅1]  [답글] [내 완료☐] │
│         │ 😀 @ 📎  [전송]│   │                                     │
│         └──────────────┘   │  ◉2 IA · 네비게이션 ...             │
│                            │                                     │
│  [✋] [선택] [💬댓글모드]   │  "파일에서 영역을 드래그해 댓글..."  │
└────────────────────────────┴─────────────────────────────────────┘
```

### 1.4 비목표

- 실시간 공동 편집
- 코멘트 → AI 자동 반영 (V2 검토)
- 비로그인 게스트 코멘트
- 첨부 파일 업로드 (📎 아이콘은 V2, MVP는 @멘션·이모지만)

---

## 2. 용어 & 기존 기능 구분

```
┌────────────────────────────────────────────────────────────┐
│ L3  AI 채팅 (chat_messages)     — 1:1 AI, 문서 수정 유도    │
├────────────────────────────────────────────────────────────┤
│ L5  멤버 코멘트 (project_comments) — 영역 핀·스레드·리액션   │  ← 신규
├────────────────────────────────────────────────────────────┤
│ L4  활동 로그 (project_activities) — 감사 이벤트             │
└────────────────────────────────────────────────────────────┘
```

| 구분 | AI 채팅 | 멤버 코멘트 |
|------|---------|------------|
| 앵커 | 없음 | **영역(rect) + 본문 라인** |
| 스레드 | 선형 | **무제한 중첩 답글** |
| 이모지 | 없음 | 본문 + 리액션 |
| 완료 | 없음 | 스레드 해결 + **멤버별 완료** |

---

## 3. 화면 스코프

### 3.1 앱 화면

| 화면 | 코드 | 코멘트 | Phase |
|------|------|:------:|-------|
| **산출물 편집** | **DOC-001** | **✅** | **C1** |
| 대시보드 / 프로젝트 목록 | DASH / PROJ | △ 뱃지 | N1·N2 ([`DASHBOARD_NOTIFICATIONS_DESIGN.md`](./DASHBOARD_NOTIFICATIONS_DESIGN.md)) |
| 그 외 | — | ❌ | — |

### 3.2 DOC-001 산출물 탭

PRD · 기능명세서 · 정책서 · 화면설계서 · Cursor — 탭별 `document_id`로 코멘트 분리.  
(`screen_list`는 UI 탭 숨김이나 파이프라인·DB에는 존재)
사이드바 탭에 **미완료 스레드 수** 뱃지: `PRD (2)`.

---

## 4. 핵심 UX — 영역 선택 코멘트 (Figma 방식)

### 4.1 리뷰 모드 vs 편집 모드

현재 `MarkdownEditor`는 textarea이므로, **영역 선택은 렌더된 미리보기 레이어**에서 수행합니다.

| 모드 | UI | 코멘트 |
|------|-----|--------|
| **편집 모드** | textarea (기존) | 코멘트 핀만 반투명 표시, 새 댓글은 리뷰 모드로 유도 |
| **리뷰 모드** | `MarkdownPreview` + 오버레이 | 영역 드래그·핀·플로팅 작성기 **활성** |

툴바 토글: `[편집 | 리뷰]` — viewer는 **리뷰 모드만** (기본).

### 4.2 영역 선택 인터랙션

1. 하단 도구바 또는 툴바에서 **댓글 모드** (`💬`) 활성화
2. 리뷰 뷰 위에서 **드래그** → 점선 사각형 (브랜드 오렌지 `#F97316`, Figma 레퍼런스)
3. 마우스 업 시 **플로팅 `CommentComposer`** — 선택 영역 우하단에 앵커
4. 내용 입력 → 이모지·@멘션 → **전송** (↑ 버튼)
5. 영역에 **핀 번호** `◉1` 표시; 사이드 패널 해당 스레드와 양방향 하이라이트

**단일 클릭** (드래그 없이): 클릭 지점 1줄 높이 기본 박스 (최소 영역).

### 4.3 앵커 데이터 모델

```typescript
type CommentAnchorType = 'region' | 'project'

/** region = Figma 스타일 영역 핀 (C1 핵심) */
interface RegionAnchor {
  type: 'region'
  /** 리뷰 뷰 컨테이너 대비 정규화 좌표 0~1 (리사이즈 대응) */
  rect_norm: { x: number; y: number; w: number; h: number }
  /** 본문 변경 시 핀 재배치용 — 작성 시점 라인 범위 */
  line_start: number
  line_end: number
  /** 선택 당시 인용 (최대 200자) */
  excerpt: string
  /** 문서 위 표시 번호 1, 2, 3… */
  pin_index: number
}
```

본문이 수정되면 `line_start`/`excerpt`로 **핀 위치 재계산**; 실패 시 excerpt 옆에 「원문 변경됨」 배지.

### 4.4 핀 & 오버레이 컴포넌트

| 컴포넌트 | 역할 |
|---------|------|
| `CommentOverlay` | 리뷰 뷰 전체 absolute 레이어 |
| `CommentRegionSelector` | 드래그 중 점선 박스 + 리사이즈 핸들 (선택 후 조정 가능) |
| `CommentPin` | `◉N` 원형 마커, 클릭 시 패널 스크롤 |
| `CommentFloatingComposer` | 영역 옆 플로팅 입력 (이미지 레퍼런스와 동일) |

---

## 5. 스레드 · 대댓글 · 이모지

### 5.1 무제한 중첩 답글

```
루트 댓글 (parent_id = null, region 앵커 보유)
├── 대댓글 A (parent_id = 루트)
│   └── 대대댓글 A-1 (parent_id = A)
└── 대댓글 B
```

- **앵커(`region`)는 루트 댓글에만** 저장 — 답글은 `thread_root_id`로 묶음
- UI: 들여쓰기 + 접기/펼치기 (3단계 이상은 「답글 N개 더보기」)
- 답글 작성: 스레드 내 「답글」또는 composer 하단

```sql
-- 루트 댓글: anchor_type = 'region', parent_id IS NULL
-- 답글: anchor_type = 'none', parent_id = 직계 부모, thread_root_id = 루트 id
thread_root_id uuid references project_comments(id)
anchor_type text check (anchor_type in ('region', 'none', 'project'))
```

### 5.2 이모지

**A. 본문 이모지** — `CommentComposer` 하단 😀 버튼 → `EmojiPicker` 팝오버 → `body`에 unicode 삽입

**B. 리액션** — 댓글마다 Slack/Figma 스타일 칩

```
[ 👍 2 ] [ ✅ 1 ] [ ❓ 1 ] [ + ]
```

```sql
create table public.comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.project_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null,  -- 단일 unicode, 예: '👍'
  created_at timestamptz not null default now(),
  unique (comment_id, user_id, emoji)
);
```

- 사용자당 이모지 1개씩 토글 (같은 👍 다시 클릭 시 취소)
- 리액션은 **모든 댓글·답글**에 부착 가능
- 권한: `comment.create`와 동일

---

## 6. 완료 / 미완료 (2계층)

### 6.1 스레드 전체 상태 (Thread Status)

| 상태 | 코드 | 의미 |
|------|------|------|
| 미완료 | `open` | 논의 진행 중 (기본) |
| 완료 | `resolved` | 스레드 종료 — 회색 처리, 핀 반투명 |

- **누가**: `comment.resolve` 권한자 (owner / editor / viewer 모두)
- **UI**: 스레드 헤더 `✓ 완료 처리` / `↩ 다시 열기`
- **자동**: 모든 active 멤버가 「내 완료」체크 시 → toast 「전원 완료 — 스레드를 완료할까요?」(선택)

### 6.2 멤버별 완료 (Per-User Completion)

> 「해당 **사용자**의 완료/미완료 구분」— 리뷰어·편집자 각자 자신의 처리 여부 표시

```sql
create table public.comment_participant_status (
  thread_root_id uuid not null references public.project_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'completed')),
  completed_at timestamptz,
  primary key (thread_root_id, user_id)
);
```

| UI 요소 | 동작 |
|---------|------|
| **내 완료** 체크박스 | 본인만 토글 `pending` ↔ `completed` |
| **참여자 아바타 행** | 스레드 관련 멤버 아바타 + ✅(완료) / ☐(미완료) |
| **필터 탭** | 사이드 패널: `[미완료] [완료] [전체]` + **「내 미완료」** |
| **카운트** | `2/4명 완료` — active 멤버 중 completed 수 |

**「참여자」정의**: 루트·답글 작성자 + @멘션된 사용자 + 스레드에서 「내 완료」누른 사용자.

### 6.3 상태 조합 예시

| 스레드 status | 서아(내 완료) | 민트(내 완료) | 표시 |
|---------------|:------------:|:------------:|------|
| open | ☐ | ☐ | 🔴 미완료, 0/2 |
| open | ✅ | ☐ | 🟡 진행 중, 1/2 |
| open | ✅ | ✅ | 🟢 전원 완료 (스레드는 아직 open) |
| resolved | ✅ | ✅ | ⚪ 완료됨 (회색) |

---

## 7. 레이아웃 (v2.1 — 2026.06.12)

> 상세: [`DOC_LAYOUT_DESIGN.md`](./DOC_LAYOUT_DESIGN.md)

```
DocumentLayout
├── Header (1행)
│   ├── ← 대시보드 · EditableProjectTitle (인라인) · 멤버
│   └── DocumentTypeTabs — 산출물 가로 탭 (가운데, 밑줄 활성)
├── DocumentLeftPanel + ChatPanel (~360px) — AI 채팅 항상 표시
│   └── EditableChatTitle + 📎 파일 첨부 입력
├── EditorArea
│   ├── DocumentToolbar — [편집|리뷰] [💬댓글모드]
│   ├── MarkdownEditor / DocumentRenderer — 편집 모드
│   └── DocumentReviewPane — 리뷰 모드 + CommentOverlay
└── CommentSidebar (300px) + DocumentRightPanel (11px) — 댓글 토글
```

**패널 배치 (v2.1)**

| 영역 | 역할 |
|------|------|
| **헤더 DocumentTypeTabs** | PRD·기능명세서·정책서·화면설계서·Cursor 가로 탭 (1행 통합) |
| **좌측 ChatPanel** | AI 채팅 — **항상 표시**, 토글 없음 |
| **우측 CommentSidebar** | Figma 스타일 댓글 패널 — 스레드·검색·필터 |
| **플로팅 Composer** | 영역 선택 직후 본문 위 입력 |

리뷰 모드 진입 시 `commentsOpen = true`. 채팅은 항상 열림, 댓글은 토글.

### 7.1 CommentSidebar (우측 패널)

| 요소 | 설명 |
|------|------|
| 헤더 | `댓글` + 검색 + 설정(필터 기본값) |
| 필터 | `미완료` / `완료` / `전체` / `내 미완료` |
| 빈 상태 | 「피드백을 주거나, 질문을 하거나… **댓글을 남기려면 문서에서 영역을 드래그하세요.**」 |
| 스레드 카드 | 핀번호 · 앵커 인용 · 루트+답글 트리 · 리액션 · 완료 UI |
| 클릭 | 본문 핀 하이라이트 + 스크롤 |

### 7.2 CommentFloatingComposer

| 요소 | 설명 |
|------|------|
| textarea | placeholder: 「댓글을 입력하세요」 |
| 하단 바 | `😀` 이모지 · `@` 멘션 · `📎` 첨부(V2 disabled) · `↑` 전송(오렌지) |
| 단축키 | Cmd+Enter 전송, Esc 취소(선택 영역 해제) |

---

## 8. 권한

```typescript
type CommentPermission =
  | 'comment.view'
  | 'comment.create'       // 루트·답글·리액션
  | 'comment.edit_own'     // 15분 이내
  | 'comment.delete_own'
  | 'comment.delete_any'   // owner
  | 'comment.resolve'      // 스레드 완료/재오픈
  | 'comment.complete_own' // 본인 멤버별 완료 토글
```

| 권한 | owner | editor | viewer |
|------|:-----:|:------:|:------:|
| comment.view | ✅ | ✅ | ✅ |
| comment.create | ✅ | ✅ | ✅ |
| comment.resolve | ✅ | ✅ | ✅ |
| comment.complete_own | ✅ | ✅ | ✅ |
| comment.delete_any | ✅ | ❌ | ❌ |

---

## 9. 데이터 모델 (전체)

### 9.1 `project_comments`

```sql
create table public.project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  thread_root_id uuid references public.project_comments(id) on delete cascade,
  parent_id uuid references public.project_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete set null,
  author_name text not null default '',
  author_avatar_url text not null default '',
  body text not null check (char_length(body) between 1 and 4000),
  anchor_type text not null default 'none'
    check (anchor_type in ('region', 'none', 'project')),
  anchor_meta jsonb not null default '{}',
  status text not null default 'open'
    check (status in ('open', 'resolved')),
  resolved_by uuid references public.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index project_comments_document_idx
  on public.project_comments (document_id, status) where deleted_at is null;
create index project_comments_thread_idx
  on public.project_comments (thread_root_id, created_at);
```

### 9.2 `comment_reactions` · `comment_participant_status` · `comment_mentions`

§5.2 · §6.2 · (멘션은 C2) 참조.

### 9.3 TypeScript

```typescript
export type ThreadStatus = 'open' | 'resolved'
export type ParticipantStatus = 'pending' | 'completed'

export interface ProjectComment {
  id: string
  project_id: string
  document_id: string | null
  thread_root_id: string | null  // null이면 자신이 루트
  parent_id: string | null
  user_id: string
  author_name: string
  author_avatar_url: string
  body: string
  anchor_type: 'region' | 'none' | 'project'
  anchor_meta: RegionAnchor | Record<string, never>
  status: ThreadStatus          // 루트만 유효, 답글은 루트 따라감
  reactions: CommentReaction[]
  created_at: string
  updated_at: string
  replies?: ProjectComment[]    // 재귀 트리
}

export interface CommentThread {
  root: ProjectComment
  replies: ProjectComment[]     // flat; UI에서 트리 구성
  participants: {
    user_id: string
    name: string
    avatar_url: string
    status: ParticipantStatus
  }[]
  open_reply_count: number
}
```

---

## 10. API & Store

```typescript
// 스레드 단위 조회 (루트 + 모든 답글 + reactions + participants)
fetchThreads(projectId: string, documentId: string, filter?: {
  status?: 'open' | 'resolved' | 'all'
  mine_pending?: boolean
}): Promise<CommentThread[]>

createRootComment(input: {
  project_id: string
  document_id: string
  body: string
  anchor_meta: RegionAnchor
}): Promise<ProjectComment>

replyToComment(parentId: string, body: string): Promise<ProjectComment>

toggleReaction(commentId: string, emoji: string): Promise<CommentReaction[]>
setThreadResolved(threadRootId: string, resolved: boolean): Promise<void>
setMyCompletion(threadRootId: string, completed: boolean): Promise<void>
```

`commentStore`: `threads`, `activePinId`, `isCommentMode`, `pendingSelection`, `fetchThreads`, …

---

## 11. 활동 로그

| action | meta |
|--------|------|
| `comment_create` | `{ thread_root_id, pin_index, document_type }` |
| `comment_reply` | `{ parent_id, thread_root_id }` |
| `comment_resolve` | `{ thread_root_id }` |
| `comment_reopen` | `{ thread_root_id }` |
| `comment_reaction` | `{ comment_id, emoji }` |
| `comment_complete` | `{ thread_root_id, user_id, completed }` |

---

## 12. 구현 Phase (수정)

### Phase C1 — 영역 코멘트 + 사이드 패널 (Mock) ⭐ ✅

- [x] `MarkdownPreview` + `CommentOverlay` + `CommentRegionSelector`
- [x] `CommentFloatingComposer` (이모지 피커, @멘션 기본)
- [x] `CommentSidebar` — 필터(미완료/완료/내 미완료), 검색
- [x] 무제한 중첩 `replyToComment` + 트리 UI
- [x] `comment_reactions` Supabase Real + 리액션 칩
- [x] `comment_participant_status` — 내 완료 + 참여자 아바타 행
- [x] 스레드 `resolved` / `reopen`
- [x] `[편집 | 리뷰]` 모드 토글, viewer 기본 리뷰
- [x] 권한 가드 + `logActivity`
- [x] 사이드바 탭 미완료 뱃지 → **헤더 `DocumentTypeTabs`** 로 이동

### Phase C1b — Supabase Real API ✅ (2026.06.12)

- [x] `005_project_comments.sql` 마이그레이션
- [x] `lib/api/comments.ts` Real API (생성·답글·리액션·완료·조회)
- [x] RLS (`006` 멤버 접근, owner-only trash/restore/purge는 앱 권한)

### Phase C2 — 앵커 안정화 & 알림

- [ ] 본문 수정 시 핀 재배치 (`line_start` + excerpt fuzzy match)
- [x] `@멘션` 기본 파싱 + `comment.mention` 알림 (`notify.ts`, `comment_mentions` 테이블 없음)
- [ ] @멘션 자동완성 UI + `comment_mentions` 테이블
- [x] 딥링크 `?panel=comments&thread={threadRootId}` (`DocumentPage`)

### Phase C3 — 편집 모드 핀 표시 & 성능

- [ ] 편집 모드에서도 핀 반투명 오버레이
- [ ] 50+ 스레드 가상 스크롤

### Phase C4 — 프로젝트 수준 & export

- [ ] DASH/PROJ 프로젝트 코멘트
- [ ] ZIP/JSON에 `comments.json`

### Phase C5 — Realtime

- [x] 마이그레이션 + RLS (`005`, `006`)
- [ ] Realtime — 새 댓글·답글·리액션 즉시 반영

---

## 13. 에러·엣지 케이스

| 상황 | 처리 |
|------|------|
| 편집 모드에서 댓글 시도 | 「리뷰 모드로 전환」토스트 |
| 영역 0px | 클릭 → 1줄 높이 최소 박스 |
| viewer | 리뷰 모드만, 영역 댓글·답글·이모지·내 완료 가능 |
| 문서 미생성 탭 | 댓글 모드 disabled |
| 루트 삭제 | 스레드 전체 soft delete |
| 답글만 있는 경우 | 없음 — 루트만 삭제 가능, 답글은 개별 삭제 |
| excerpt 변경 | 「원문이 변경되었습니다」+ 핀 위치 재계산 |

---

## 14. 의사결정 기록 (v1.1 확정)

| # | 항목 | 결정 |
|---|------|------|
| 1 | 영역 선택 | Figma 스타일 드래그 + `MarkdownPreview` 리뷰 모드 |
| 2 | 패널 | 우측 `CommentSidebar` + 플로팅 composer |
| 3 | 답글 깊이 | **무제한 중첩** |
| 4 | 이모지 | 본문 입력 + 리액션 칩 |
| 5 | 완료 | **스레드 resolved** + **멤버별 completed** 이중 구조 |
| 6 | viewer | 리뷰·댓글·완료 모두 가능 |

---

## 15. 문서 체크리스트

- [x] v1.1 Figma 스타일 영역·이모지·완료 반영
- [ ] `TECH_SPEC.md` — `MarkdownPreview`, Comment 컴포넌트 목록
- [x] `MEMBER_PERMISSIONS_DESIGN.md` — `comment.complete_own`, M3 RLS
- [x] `DEV_GUIDE.md` — C1 범위 갱신

---

*구현 지시: 「Phase C1 멤버 코멘트 구현해줘」*
