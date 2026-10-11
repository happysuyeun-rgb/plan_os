# PlanOS Mock MVP 갭 검토서

> **갱신: 2026.06.12 (v4)**  
> 검토 기준: `TECH_SPEC.md`, `DEV_GUIDE.md`, 실제 코드베이스  
> 현재 모드: **Supabase Real API** + **Supabase Auth** + 마이그레이션 `001`~`008`

---

## 1. 문서 체계 안내

개발 명세·가이드는 아래 3개 문서로 역할이 나뉩니다.

| 문서 | 역할 | 대상 독자 |
|------|------|----------|
| [`TECH_SPEC.md`](./TECH_SPEC.md) | **개발 명세서** — 라우팅, 컴포넌트, Store, API, DB, Phase 체크리스트 | 구현 시 참조하는 기준 문서 |
| [`DEV_GUIDE.md`](./DEV_GUIDE.md) | **개발 가이드** — AI/사용자 역할 분담, 진행 순서, Phase별 완료 체크 | 작업 지시·협업 시 참조 |
| **이 문서** (`MOCK_GAP_REVIEW.md`) | **갭 검토서** — 명세 대비 구현 현황, 누락·버그·우선순위 | Mock 마무리 / Supabase 전 점검 |

> **명세서 정리 여부:** `TECH_SPEC.md`는 기획서·화면설계서를 바탕으로 이미 작성되어 있습니다(703줄).  
> 이 갭 검토서는 그 명세와 **실제 코드의 차이**를 기록한 보조 문서입니다.

---

## 2. 전체 완성도 요약

| 구분 | 완성도 | 설명 |
|------|--------|------|
| Mock MVP (프론트 플로우) | **~95%** | 9개 화면 + 생성/편집/채팅/멤버·코멘트·휴지통 UI |
| TECH_SPEC 컴포넌트 구조 | **~85%** | C1·T1·E1~E3 컴포넌트 추가, 일부는 페이지 인라인 |
| 백엔드 / 실서비스 | **~56%** | 마이그레이션 8종·핵심 CRUD·comments·notifications·M3 RLS·`chat_title` ✅ / EF·Claude·OAuth E2E·Realtime 남음 |

### Phase별 Mock 완성도

| Phase | 명칭 | 완성도 | 상태 |
|-------|------|--------|------|
| 0 | 인프라 기반 | 95% | Supabase client·마이그레이션·Real API, Mock 제거 |
| 1 | 인증 & 온보딩 | 85% | Supabase Auth + dev 로그인, Google OAuth E2E 대기 |
| 2 | 프로젝트 CRUD | 98% | 휴지통 T1·대시보드 메뉴·target_user 저장 |
| 3 | AI 인터뷰 | 90% | InterviewPanel로 통합 |
| 4 | AI 생성 파이프라인 | 90% | placeholder 파이프라인 + 취소 UI (EF·Claude 미배포) |
| 5 | 산출물 편집 | 96% | v2.1 레이아웃·인라인 제목·`SaveVersionModal` |
| 6 | AI 채팅 & 재생성 | 88% | placeholder 채팅 + 📎첨부 + `chat_title`, SSE는 EF 후 |
| 7 | 비로그인 체험 | 85% | rate limit 없음 (백엔드 후) |
| 8 | 설정 & 마무리 | 75% | 계정 삭제 UI+`users` DELETE ✅ / `delete-account` EF·전역 에러·E2E 남음 |
| 3.5 | 히스토리·보내기 | 95% | E1~E3 (인터뷰 조회 UI·E6+ 미구현) |
| 3.6 | 멤버·권한 | 95% | M1~M2 UI·API + **M3 RLS (`006`)** |
| 3.7 | 멤버 코멘트 | 85% | C1 + **`005` Real API** (C2~C5 미구현) |
| 3.8 | 프로젝트 휴지통 | 90% | T1 Supabase Real (T2~T4 미구현) |
| 3.9 | 대시보드 알림 | 75% | N1 UI + **N4 Real API (`007`)** / N2~N3·Realtime 미구현 |

---

## 3. Mock 단계에서 손볼 갭 (Supabase 없이 가능)

### 3.1 🔴 높음 — 기능·데이터 정합성

#### ~~(1) `target_user` 미저장~~ ✅ 해결 (A1)

- `Project.target_user` 타입·mock·`createProject` 저장 완료
- `DocumentPage` 재생성 시 `currentProject.target_user` 사용

#### ~~(2) 온보딩 1회 강제 플로우~~ ✅ 해결 (A2)

- `ProtectedRoute`에 온보딩 분기 통합 (`ENABLE_MOCK_ROUTE_GUARDS`)
- `MOCK_NEW_USER` 플래그로 신규 유저 테스트 가능

#### ~~(3) 산출물 탭 잠금 출시 모드~~ ✅ 해결 (A3)

- `TEST_UNLOCK_ALL_DOCUMENTS: false` 전환
- 잠긴 탭 Lock UI·URL 리다이렉트·빈 상태 UX 보완

---

### 3.2 🟡 중간 — UX·구조 정합성

#### ~~(4) 대시보드 vs 프로젝트 목록 기능 비대칭~~ ✅ 해결 (A4)

- `DashboardPage`에 ContextMenu + 이름변경·휴지통 이동 적용
- 검색/필터는 목록 전용 유지 (의도적)

#### (5) 동시 AI 요청 전역 차단 미흡

명세 6.2: `generationStore.isGenerating`과 `chatStore.isStreaming` 겹침 방지.

| 현재 | 부족한 부분 |
|------|------------|
| 채팅 패널 `isStreaming` 시 입력 비활성 | 생성 중 문서 재생성·편집 차단 없음 |
| | 생성 중 채팅 전송 차단 없음 (다른 화면) |

**조치:** `DocumentPage`에서 `isGenerating || isStreaming` 시 재생성·채팅·편집 버튼 비활성.

#### (6) `uiStore` 모달 통합 미완

`TECH_SPEC` 3.2 `uiStore` 설계:

```typescript
modals: { upgrade: boolean; login: boolean; confirm: ConfirmModalConfig | null }
openUpgradeModal / openLoginModal / openConfirmModal
```

**현재:** 각 페이지가 `useState`로 `UpgradeModal` 등을 개별 관리.

**조치:** 전역 모달 상태로 통합 (선택, Mock 마무리 후반).

#### ~~(7) API 스왑 패턴 불일치~~ ✅ 해결 (2026.06.12)

`USE_MOCK_API = false`, `src/mocks/` 삭제, 모든 `lib/api/*.ts`가 Supabase 직접 호출. `*.mock.ts`·`*.real.ts` 분기 패턴은 **더 이상 사용하지 않음**.

---

### 3.3 🟢 낮음 — 명세 파일 구조 차이 (기능은 동작)

명세에 정의된 별도 파일이 없고, 페이지·상위 컴포넌트에 인라인 처리된 항목:

| 명세 컴포넌트 | 현재 구현 위치 |
|--------------|---------------|
| `Chip.tsx` | `LandingPage` 인라인 버튼 |
| `ProgressBar.tsx` | `SettingsPage` 인라인 div |
| `InterviewStep.tsx` / `InterviewQuestion.tsx` | `InterviewPanel.tsx` 통합 |
| `DocumentEditor.tsx` | `DocumentLayout` + `DocumentToolbar` 조합 |
| `VersionRestoreBar.tsx` | `DocumentToolbar` + `ConfirmModal` |
| `ChatMessageList.tsx` / `ChatInput.tsx` | `ChatPanel.tsx` 내부 |
| `DocumentLayout` | `components/document/` (명세는 `layout/`) |
| `hooks/useAutoSave.ts` | `documentStore.updateContent` 내장 (debounce 2초) |
| `hooks/useSSE.ts` | 없음 (mock은 AsyncGenerator) |

**판단:** MVP 기능에는 영향 없음. 리팩터링·유지보수 시 분리 권장.

---

## 4. Supabase / 백엔드 연동 현황 (2026.06.12 v3)

### 4.0 로컬 개발 모드

| 항목 | 상태 |
|------|------|
| 라우트 가드 | ✅ `ENABLE_MOCK_ROUTE_GUARDS = true` |
| `authStore` | Supabase Auth (`getSession`, `onAuthStateChange`) |
| dev 로그인 | ✅ `ENABLE_DEV_LOGIN` + `npm run dev:user` |
| DB RLS | ✅ `auth.uid()` 기준 — 로그인 필수 |
| OAuth | 코드 있음 — Google 콘솔 E2E 검증 대기 |

### 4.1 ✅ 완료

| 항목 | 구현 위치 | 비고 |
|------|----------|------|
| Supabase 프로젝트 + `.env.local` | 루트 | `VITE_SUPABASE_*`, `SUPABASE_DB_URL` |
| DB 마이그레이션 | `supabase/migrations/` | `001`~`008` 적용 |
| 멤버 RLS M3 | `006_member_project_access_rls.sql` | `get_project_role` / `can_access_project` |
| notifications Real | `007_user_notifications.sql` | `notifications.ts` + `notify.ts` |
| `generation_runs` RLS | `003_generation_runs_rls.sql` | editor+ owner |
| `project_members` RLS | `002` + `006` | 동료 멤버 목록 조회 |
| projects / documents / versions / chat | `lib/api/*.ts` | Supabase 직접 호출 |
| members / activities / generationRuns | `lib/api/*.ts` | 해당 테이블 연동 |
| comments Real API | `lib/api/comments.ts` | `005` + 알림 연동 |
| 휴지통 T1 Real | `projects.ts` | `deleted_at` soft delete·복원·purge |
| 계정 삭제 UI | `SettingsPage` + `auth.deleteAccount` | `users` 행 삭제 (EF 미완) |
| `version_name` UI | `SaveVersionModal` | `DocumentPage` 연동 |
| DOC 레이아웃 v2.1 | `DocumentTypeTabs`, `EditableInlineTitle`, `chat_title` | [`DOC_LAYOUT_DESIGN.md`](./DOC_LAYOUT_DESIGN.md) |
| IA 라벨 | `DOCUMENT_TYPE_LABELS.ia` | **기능명세서** |
| 화면목록 UI | `DOCUMENT_TYPE_UI_ORDER` | 탭 숨김 (파이프라인·export 유지) |

### 4.2 ⚠️ Placeholder (DB 저장은 Real, AI는 미연동)

| 항목 | 상태 | 다음 작업 |
|------|------|----------|
| AI 생성 | `generation.ts` + `placeholderContent.ts` | Edge Function + Claude |
| AI 채팅 | `chat.ts` — 본문 append + 고정 응답 | `chat-document` EF |
| 계정 삭제 완전성 | `users` DELETE만 | `delete-account` EF (`auth.users` 정리) |

### 4.3 ❌ 미구현 (4단계 이후)

| 항목 | 사용자 선행 | AI 구현 |
|------|------------|---------|
| Google OAuth E2E | Supabase Auth Google Provider + Redirect URL | 로그인 플로우 검증 |
| AI 5단계 파이프라인 (Claude) | Claude API 키 + EF 배포 | `generate-pipeline` Edge Function |
| AI 채팅 (Claude) | EF 배포 | `chat-document` Edge Function |
| SSE 스트리밍 | EF 배포 | `hooks/useSSE.ts` |
| memory_summary 서버 갱신 | EF 배포 | `update-memory-summary` |
| 계정 삭제 EF | - | `delete-account` EF (`auth.users` cascade) |
| 비로그인 rate limit | - | `guest-generate` EF |
| RLS 서버 한도 enforcement | - | Edge Function JWT + DB 카운트 |
| 월간 AI 생성 횟수 리셋 | - | cron 또는 DB 트리거 |

### 백엔드 파일 현황

```
supabase/
├── migrations/001_initial_schema.sql              ✅
├── migrations/002_fix_project_members_rls.sql     ✅
├── migrations/003_generation_runs_rls.sql         ✅
├── migrations/004_add_wireframe_document_type.sql ✅
├── migrations/005_project_comments.sql            ✅
├── migrations/006_member_project_access_rls.sql   ✅
├── migrations/007_user_notifications.sql          ✅
├── migrations/008_project_chat_title.sql          ✅
├── config.toml                                    ✅
└── functions/                                     ❌ 없음

src/
├── config.ts          USE_MOCK_API=false, ENABLE_MOCK_ROUTE_GUARDS=true
├── store/authStore.ts Supabase Auth
└── lib/api/
    ├── *.ts (Real)       ✅ Supabase 직접 호출
    ├── comments.ts       ✅ + notify 연동
    ├── notifications.ts  ✅ Real API
    ├── chatTitle.ts      ✅ chat_title 자동·검증
    ├── chatAttachments.ts ✅ 채팅 파일 첨부
    ├── generation.ts     ⚠️ placeholder AI
    └── chat.ts           ⚠️ placeholder AI
```

---

## 5. 출시 전 결정·검증 필요

| 항목 | 현재 | 출시 전 조치 |
|------|------|-------------|
| 랜딩 미리보기 UX | 5종 전체 펼침 (테스트) | 접기/탭 UX 결정 |
| `TEST_UNLOCK_ALL_DOCUMENTS` | `false` | 출시 전 최종 회귀 검증 |
| 전역 에러 처리 | 없음 | 세션 만료, 네트워크, 404 통합 |
| E2E 테스트 | 0건 | 핵심 플로우 3~5개 |
| `TECH_SPEC.md` 섹션 5 체크리스트 | **v3 동기화 완료** | 이 문서·`DEV_GUIDE`와 일치 |
| 결제 연동 | `UpgradeModal` 안내만 | V2 (Stripe/토스) |
| 브랜드 컬러·폰트 | Tailwind `brand-600` 기본 | polish 전 확정 |

---

## 6. 완료된 항목 (Mock 기준)

### 핵심 플로우
- ✅ 9개 화면 라우트 + 404 (TRASH-001 포함)
- ✅ ~~Mock API 레이어~~ → **Supabase Real API** (`lib/api/*.ts`, 2026.06.12)
- ✅ Zustand Store 12개 (`memberStore`, `commentStore`, `activityStore` 등)
- ✅ 프로젝트 CRUD + 검색/필터 + 휴지통 이동 + 복원 + 영구삭제
- ✅ 프로젝트 생성 3단계 (폼 → 인터뷰 → 생성)
- ✅ 5단계 placeholder 생성 파이프라인 + 취소 UI (EF 전)
- ✅ 산출물 v2.1 레이아웃 + 자동저장 2초 + 버전 pills/복원 + `SaveVersionModal`
- ✅ AI 채팅 placeholder + 문서 content 반영 + 알림 연동
- ✅ PRD/IA 연쇄 재생성 + `RegenerateModal`
- ✅ `memory_summary` 채팅 시 갱신 (mock)
- ✅ 랜딩 비로그인 체험 + 인라인 인터뷰
- ✅ 게스트 sessionStorage → 로그인 후 프로젝트 이관
- ✅ `planos_last_doc_type` 탭 기억
- ✅ AI 생성 횟수 +1 (생성/재생성/채팅)
- ✅ Free 플랜 한도 UI (프로젝트 3개, AI 10회, 버전 10개)
- ✅ `npm run build` 통과

### 컴포넌트 분리 (최근)
- ✅ `DocumentLayout`, `DocumentToolbar`
- ✅ `ProjectForm`, `StepProgress`, `GenerationStep`
- ✅ `ProjectGrid`, `ProjectSearch`, `ServiceTypeFilter`
- ✅ `ContextMenu`, `ProjectActionModals`
- ✅ `LoginModal`, `RelatedDocsNotice`

### 멤버·권한 (M1~M3)
- ✅ `permissions.ts`, `useProjectPermissions`
- ✅ `MemberPanel`, `InviteMemberModal`, 역할 Select
- ✅ viewer/editor/owner UI 가드
- ✅ **M3 RLS** (`006`) — editor/viewer DB 접근

### 대시보드 알림 (N1 + N4)
- ✅ `NotificationBell`, `NotificationFeed`, `notificationStore`
- ✅ **`007` + `notifications.ts` Real API** + `notify.ts` 이벤트 연동

### 기타 UX
- ✅ 프로젝트명 변경 — DASH/PROJ 모달 / DOC 헤더 **인라인 편집**
- ✅ `target_user` 저장·재생성 연동
- ✅ `SaveVersionModal` — 버전 이름 입력
- ✅ 계정 삭제 UI (`SettingsPage` + `auth.deleteAccount`)

### 히스토리·보내기 (E1~E3)
- ✅ `ExportMenu` — MD/ZIP/클립보드
- ✅ `HistoryPanel`, `ActivityTimeline`, `activityStore`
- ✅ 랜딩 ZIP, `interview_answers`·`generation_runs` Supabase Real
- ✅ 채팅 시 `chat` 활동 로그

### 멤버 코멘트 (C1 + Real API)
- ✅ `MarkdownPreview` + `CommentOverlay` 영역 드래그
- ✅ `CommentSidebar`, `CommentFloatingComposer`, 무제한 대댓글
- ✅ **`005` + `comments.ts` Real API** — 저장·조회·리액션·완료
- ✅ 이모지·리액션, 스레드/멤버별 완료
- ✅ `[편집|리뷰]` 모드, `commentStore`

### DOC-001 레이아웃 v2.1
- ✅ `DocumentTypeTabs` — 헤더 1행 가운데 탭 + `vN`·`최종`·댓글 뱃지 (밑줄 활성)
- ✅ `DocumentLeftPanel` + `ChatPanel` — AI 채팅 **항상 표시** (토글 제거)
- ✅ `DocumentRightPanel` + `CommentSidebar` — 댓글 우측 토글
- ✅ `EditableInlineTitle` — 프로젝트명·채팅 제목 인라인 편집
- ✅ `projects.chat_title` (`008`) — 생성 시 자동, `EditableChatTitle`
- ✅ 채팅 📎 파일 첨부 — `chatAttachments.ts`, `pendingAttachments`
- ✅ IA → **기능명세서**, 화면목록 탭 UI 숨김

### 프로젝트 휴지통 (T1)
- ✅ `TrashPage` (`/projects/trash`), `TrashedProjectCard`
- ✅ `trashProject` / `restoreProject` / `purgeProject`
- ✅ 메뉴 「휴지통으로 이동」, DOC 휴지통 접근 차단
- ✅ `project_trash` / `restore` / `purge` 활동 로그

---

## 7. 우선순위별 작업 목록

### A. Mock 마무리 (Supabase 전, 1~2일)

| # | 작업 | 예상 공수 | 담당 |
|---|------|----------|------|
| ~~A1~~ | ~~`target_user` 프로젝트 저장 + 재생성 인자 수정~~ | 2h | AI | ✅ |
| ~~A2~~ | ~~온보딩 가드 + mock 신규유저 테스트 모드~~ | 3h | AI | ✅ |
| ~~A3~~ | ~~`TEST_UNLOCK_ALL_DOCUMENTS: false` 검증·보완~~ | 2h | AI | ✅ |
| ~~A4~~ | ~~대시보드 ContextMenu (이름변경/삭제)~~ | 2h | AI | ✅ |
| ~~A5~~ | ~~`USE_MOCK_API` 스왑 + Real API 전환~~ | 3h | AI | ✅ |
| A6 | 동시 AI 요청 UI 차단 | 1h | AI |
| A7 | `uiStore` 모달 통합 (선택) | 3h | AI |
| A8 | 명세 컴포넌트 파일 분리 (선택) | 4h | AI |

### B. Supabase 연결

| # | 작업 | 상태 |
|---|------|------|
| ~~B1~~ | `.env.local` + Supabase client + `db:push` | ✅ |
| ~~B2~~ | `authStore` + `lib/api/auth.ts` Auth 연동 | ✅ 코드 완료 |
| B2b | Google OAuth E2E 로그인 검증 | ⏳ 사용자 콘솔 설정 필요 |
| ~~B3~~ | projects/documents/versions/chat/members API | ✅ |
| ~~B3b~~ | notifications Real API | ✅ `007` + `notifications.ts` + `notify.ts` |
| ~~B3c~~ | 멤버 RLS M3 | ✅ `006` |
| B4 | Edge Functions 배포 | ❌ Claude API 키 등록 후 |

### C. 확장 Phase (설계 완료, Mock 미구현)

| # | 작업 | 설계 문서 |
|---|------|----------|
| N2~N3, Realtime | 알림 UX·실시간 | `DASHBOARD_NOTIFICATIONS_DESIGN.md` |
| C2~C4 | 코멘트 앵커·멘션 UI·성능 | `MEMBER_COMMENTS_DESIGN.md` |
| E4~E5 | PDF·Supabase export | `HISTORY_AND_EXPORT_DESIGN.md` |
| E6~E9 | DOCX·Notion·Figma 등 | `EXPORT_FORMATS_DESIGN.md` |
| T2~T4 | GNB 뱃지·비우기·Supabase purge | `PROJECT_TRASH_DESIGN.md` |

### D. 출시 전

| # | 작업 |
|---|------|
| D1 | 전역 에러 처리 |
| D2 | E2E 테스트 |
| D3 | UI polish (Figma 시안 권장) |
| D4 | 탭 잠금·휴지통 회귀 검증 |
| D5 | 법적 문서 URL |

---

## 8. AI 작업 지시 예시

```
「Mock 마무리 A1~A4 진행해줘」     → target_user, 온보딩, 탭잠금, 대시보드 메뉴
「Supabase 연결해줘」              → ✅ 완료
「4단계 Edge Function 진행해줘」   → Claude API + EF 배포
「notifications 연동해줘」 → 마이그레이션 + Real API (N4)
「명세 컴포넌트 분리해줘」         → A8 작업
```

---

## 9. 관련 문서

| 문서 | 경로 |
|------|------|
| 개발 명세서 | [`docs/TECH_SPEC.md`](./TECH_SPEC.md) |
| 개발 가이드 | [`docs/DEV_GUIDE.md`](./DEV_GUIDE.md) |
| 갭 검토서 (이 문서) | [`docs/MOCK_GAP_REVIEW.md`](./MOCK_GAP_REVIEW.md) |
| 대시보드 알림 설계 | [`docs/DASHBOARD_NOTIFICATIONS_DESIGN.md`](./DASHBOARD_NOTIFICATIONS_DESIGN.md) |
| DB 스키마 (초기) | [`supabase/migrations/001_initial_schema.sql`](../supabase/migrations/001_initial_schema.sql) |
| DB 스키마 (RLS 수정) | [`supabase/migrations/002_fix_project_members_rls.sql`](../supabase/migrations/002_fix_project_members_rls.sql) |
| DB 스키마 (generation_runs) | [`supabase/migrations/003_generation_runs_rls.sql`](../supabase/migrations/003_generation_runs_rls.sql) |
| DB push 스크립트 | [`scripts/db-push.mjs`](../scripts/db-push.mjs) |
| 기획서 | `PlanOS_기획서_v3.0.docx` |
| 화면설계서 | `PlanOS_화면설계서_v1.0.docx` |

---

*이 문서는 코드·명세 대조 검토 결과입니다. 구현 완료 시 해당 항목을 체크하고 `DEV_GUIDE.md` Phase 체크리스트와 동기화하세요.*
