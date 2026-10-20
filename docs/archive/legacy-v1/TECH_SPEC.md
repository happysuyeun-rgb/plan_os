# PlanOS 기술 명세서

> 기반 문서: `PlanOS_기획서_v3.0.docx`, `PlanOS_화면설계서_v1.0.docx`  
> 기술스택: React + TypeScript + Vite · Tailwind CSS · Supabase · Zustand · React Router v6 · Claude API (Edge Function 경유)  
> 범위: **V1 MVP**  
> **현재 상태 (2026.06.12 v4):** Supabase Real API · 마이그레이션 `001`~`008` · DOC v2.1 레이아웃 · 채팅 제목·첨부 · 인라인 헤더 편집

### 관련 문서

| 문서 | 역할 |
|------|------|
| **이 문서** (`TECH_SPEC.md`) | 개발 명세 — 구현 시 참조하는 기준 |
| [`DEV_GUIDE.md`](../../DEV_GUIDE.md) | 개발 가이드 — 역할 분담, Phase 체크리스트, 진행 순서 |
| [`MOCK_GAP_REVIEW.md`](../../MOCK_GAP_REVIEW.md) | 갭 검토서 — 명세 대비 구현 현황·누락·우선순위 |
| [`HISTORY_AND_EXPORT_DESIGN.md`](../../HISTORY_AND_EXPORT_DESIGN.md) | 히스토리·파일보내기 상세 설계 |
| [`EXPORT_FORMATS_DESIGN.md`](../../EXPORT_FORMATS_DESIGN.md) | 보내기 형식 확장 (HTML·JSON·PDF·DOCX 등) |
| [`MEMBER_PERMISSIONS_DESIGN.md`](../../MEMBER_PERMISSIONS_DESIGN.md) | 멤버 권한 체계·역할 변경 정책 |
| [`MEMBER_COMMENTS_DESIGN.md`](../../MEMBER_COMMENTS_DESIGN.md) | 화면별 멤버 코멘트·리뷰 협업 |
| [`PROJECT_TRASH_DESIGN.md`](../../PROJECT_TRASH_DESIGN.md) | 프로젝트 휴지통·복원·영구삭제 |
| [`DASHBOARD_NOTIFICATIONS_DESIGN.md`](../../DASHBOARD_NOTIFICATIONS_DESIGN.md) | 대시보드·GNB 알림 (채팅·댓글) |
| [`DOC_LAYOUT_DESIGN.md`](../../DOC_LAYOUT_DESIGN.md) | DOC-001 레이아웃 v2.1 (헤더 1행·채팅 항상 표시·인라인 제목) |

## 1. 전체 화면 목록 및 라우팅 구조

### 1.1 화면 목록

| 화면코드 | 화면명 | 인증 | 설명 |
|---------|--------|------|------|
| LAND-001 | 랜딩 + 프롬프트 | 불필요 | 비로그인 1회 체험, 로그인 유도 |
| AUTH-001 | 로그인 | 불필요 | Google OAuth |
| AUTH-002 | 온보딩 | 필요 | 최초 로그인 1회 서비스 안내 |
| DASH-001 | 홈 대시보드 | 필요 | 최근 프로젝트 + 빠른 생성 |
| PROJ-001 | 프로젝트 목록 | 필요 | 전체 프로젝트 카드 리스트 |
| TRASH-001 | 휴지통 | 필요 | 삭제(이동)된 프로젝트 복원·영구삭제 |
| PROJ-002 | 프로젝트 생성 + AI 인터뷰 | 필요 | 스텝형 입력 → AI 질문 → 생성 |
| DOC-001 | 산출물 편집 + AI 채팅 | 필요 | 3단 레이아웃 통합 화면 |
| SET-001 | 설정 | 필요 | 프로필 + 플랜 탭 |

### 1.2 라우팅 구조

```
/                           → LAND-001  LandingPage
/login                      → AUTH-001  LoginPage
/onboarding                 → AUTH-002  OnboardingPage  [Protected, 최초 1회]
/dashboard                  → DASH-001  DashboardPage   [Protected]
/projects                   → PROJ-001  ProjectListPage [Protected]
/projects/trash             → TRASH-001 TrashPage        [Protected, owner]
/projects/new               → PROJ-002  ProjectCreatePage [Protected]
/projects/:projectId        → DOC-001   DocumentPage    [Protected]
/projects/:projectId/:docType → DOC-001 DocumentPage (탭 딥링크) [Protected]
/settings                   → SET-001   SettingsPage    [Protected]
/*                          → NotFoundPage
```

### 1.3 라우트 가드 정책

| 가드 | 조건 | 동작 |
|------|------|------|
| `PublicOnlyRoute` | `/`, `/login` | 로그인 상태면 `/dashboard` 리다이렉트 |
| `ProtectedRoute` | 인증 필요 화면 | 미로그인 시 `/login` + `redirect` 쿼리 저장 |
| `OnboardingGuard` | 최초 로그인 | `users.onboarding_completed = false` → `/onboarding` |
| `PlanLimitGuard` | 생성/프로젝트 추가 | Free 한도 초과 시 `UpgradeModal` (라우트 차단 아님) |
| `DesktopOnlyBanner` | viewport < 1024px | 전역 안내 배너 노출 (라우트 차단 없음) |

### 1.4 레이아웃 구조

```
AppLayout (인증 필요 화면 공통)
├── GNB (GlobalNavBar)
│   ├── Logo → /dashboard
│   ├── Nav: Dashboard / Projects
│   └── Avatar → /settings
└── <Outlet />

DocumentLayout (DOC-001 전용, GNB 없음)
├── Header (1행)
│   ├── 뒤로가기 · EditableProjectTitle (인라인 편집)
│   ├── DocumentTypeTabs — 산출물 가로 탭 (가운데, 밑줄 활성)
│   └── 멤버 버튼
├── DocumentLeftPanel + ChatPanel (~360px) — AI 채팅 항상 표시
│   └── EditableChatTitle + 파일첨부 입력
├── Main: DocumentToolbar + Editor
└── CommentSidebar (300px) + DocumentRightPanel (11px) — 댓글 토글
```

> v1 `DocumentSidebar`(180px 세로 탭)는 v2에서 제거. 상세: [`DOC_LAYOUT_DESIGN.md`](../../DOC_LAYOUT_DESIGN.md)

### 1.5 핵심 플로우별 라우팅

**비로그인 체험**
```
/ → 인터뷰 인라인 → LoadingStream → 결과 미리보기
  → 로그인 클릭 → /login → /onboarding
  → sessionStorage 결과 저장 → /projects/:id/prd
```

**로그인 사용자 — 신규 프로젝트**
```
/dashboard → /projects/new (스텝1→2→3)
  → 생성 완료 → /projects/:id/prd
```

**기존 프로젝트 수정**
```
/dashboard or /projects → /projects/:id/:docType
```

---

## 2. 컴포넌트 목록

### 2.1 공통 컴포넌트 (`src/components/common/`)

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| `Button` | `Button.tsx` | primary/ghost/danger 변형, 로딩 상태 |
| `Input` | `Input.tsx` | 텍스트 입력, 오류 상태, 글자수 표시 |
| `Textarea` | `Textarea.tsx` | 프롬프트/설명/에디터 공용 |
| `Select` | `Select.tsx` | 서비스 유형, 필터 |
| `Badge` | `Badge.tsx` | 산출물 상태, 플랜, 서비스유형 |
| `Chip` | `Chip.tsx` | 랜딩 예시 칩 |
| `Card` | `Card.tsx` | 프로젝트 카드, 질문 카드 |
| `EmptyState` | `EmptyState.tsx` | 프로젝트/검색 결과 없음 |
| `Toast` | `Toast.tsx` + `useToast` | success/error/info, 3초 자동 닫힘 |
| `Modal` | `Modal.tsx` | 확인/취소 기본 모달 |
| `ConfirmModal` | `ConfirmModal.tsx` | 삭제/복원 확인 (danger 버튼) |
| `UpgradeModal` | `UpgradeModal.tsx` | Free/Pro/Team 비교 + CTA |
| `LoadingStream` | `LoadingStream.tsx` | SSE 스트리밍 + 5단계 stepper |
| `ProgressBar` | `ProgressBar.tsx` | 스텝/온보딩/AI 사용량 |
| `ContextMenu` | `ContextMenu.tsx` | 프로젝트 이름 변경/삭제 |
| `SaveStatus` | `SaveStatus.tsx` | 저장됨/저장중/실패 표시 |
| `DesktopOnlyBanner` | `DesktopOnlyBanner.tsx` | 모바일 접근 안내 |
| `LoginModal` | `LoginModal.tsx` | 비로그인 저장 시도 시 노출 |
| `EditableInlineTitle` | `EditableInlineTitle.tsx` | 헤더·패널 제목 클릭 인라인 편집 |

### 2.2 레이아웃 컴포넌트 (`src/components/layout/`)

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| `AppLayout` | `AppLayout.tsx` | GNB + Outlet 래퍼 |
| `GlobalNavBar` | `GlobalNavBar.tsx` | 로고, 네비, 아바타 |
| `AuthLayout` | `AuthLayout.tsx` | 로그인/온보딩 중앙 정렬 |
| `DocumentLayout` | `DocumentLayout.tsx` | 3단 레이아웃 래퍼 |
| `ProtectedRoute` | `ProtectedRoute.tsx` | 인증 가드 |
| `PublicOnlyRoute` | `PublicOnlyRoute.tsx` | 비인증 전용 가드 |

### 2.3 프로젝트 컴포넌트 (`src/components/project/`)

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| `ProjectCard` | `ProjectCard.tsx` | 대시보드/목록 공용 카드 |
| `NewProjectCard` | `NewProjectCard.tsx` | 점선 + 아이콘 카드 |
| `ProjectGrid` | `ProjectGrid.tsx` | 3열 카드 그리드 |
| `ProjectSearch` | `ProjectSearch.tsx` | 검색 + debounce 300ms |
| `ServiceTypeFilter` | `ServiceTypeFilter.tsx` | 서비스 유형 필터 |
| `ProjectForm` | `ProjectForm.tsx` | 스텝1 기본정보 폼 |
| `InterviewStep` | `InterviewStep.tsx` | 스텝2 AI 인터뷰 |
| `InterviewQuestion` | `InterviewQuestion.tsx` | 개별 질문 카드 |
| `StepProgress` | `StepProgress.tsx` | PROJ-002 3단계 진행 바 |
| `GenerationStep` | `GenerationStep.tsx` | 스텝3 LoadingStream 래퍼 |
| `MemberPanel` | `MemberPanel.tsx` | 멤버 목록·역할 변경 *(M2)* |
| `InviteMemberModal` | `InviteMemberModal.tsx` | 멤버 초대 |
| `TrashedProjectCard` | `TrashedProjectCard.tsx` | 휴지통 카드 + D-day *(T1)* |
| `ProjectActionModals` | `ProjectActionModals.tsx` | 이름변경·휴지통 이동 확인 |

### 2.4 문서 컴포넌트 (`src/components/document/`)

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| `DocumentLayout` | `DocumentLayout.tsx` | 헤더 + 본문 3열 래퍼 |
| `DocumentTypeTabs` | `DocumentTypeTabs.tsx` | 헤더 산출물 가로 탭 + 버전·댓글 뱃지 |
| `DocumentLeftPanel` | `DocumentLeftPanel.tsx` | 좌측 ChatPanel 슬롯 (토글 없음) |
| `DocumentRightPanel` | `DocumentRightPanel.tsx` | 우측 댓글 토글 + 패널 슬롯 |
| `EditableProjectTitle` | `EditableProjectTitle.tsx` | 프로젝트명 인라인 편집 (DOC 헤더) |
| `EditableChatTitle` | `EditableChatTitle.tsx` | 채팅 패널 제목 인라인 편집 |
| `SaveVersionModal` | `SaveVersionModal.tsx` | 버전 저장 시 이름 입력 |
| `DocumentToolbar` | `DocumentToolbar.tsx` | 재생성/버전저장 버튼 |
| `VersionPills` | `VersionPills.tsx` | v1, v2... 버전 선택 |
| `VersionRestoreBar` | `VersionRestoreBar.tsx` | 과거 버전 읽기전용 + 복원 |
| `MarkdownEditor` | `MarkdownEditor.tsx` | textarea 기반, 50,000자 제한 |
| `ChatPanel` | `ChatPanel.tsx` | AI 채팅 패널 (제목·메시지·📎첨부·textarea 입력) |
| `RelatedDocsNotice` | `RelatedDocsNotice.tsx` | 관련 산출물 업데이트 안내 |
| `RegenerateModal` | `RegenerateModal.tsx` | PRD/IA 재생성 시 연쇄 확인 |
| `HistoryPanel` | `HistoryPanel.tsx` | 버전·채팅·활동 통합 히스토리 *(E2)* |
| `ActivityTimeline` | `ActivityTimeline.tsx` | 프로젝트 활동 로그 타임라인 *(E2)* |
| `ExportMenu` | `ExportMenu.tsx` | MD/ZIP/클립보드보내기 *(E1)* |
| `MarkdownPreview` | `MarkdownPreview.tsx` | 리뷰 모드 MD 렌더 *(C1)* |
| `DocumentReviewPane` | `DocumentReviewPane.tsx` | 미리보기 + 코멘트 오버레이 *(C1)* |
| `CommentOverlay` | `CommentOverlay.tsx` | 영역 드래그 선택 *(C1)* |
| `CommentSidebar` | `CommentSidebar.tsx` | 댓글 스레드 패널 *(C1)* |
| `CommentFloatingComposer` | `CommentFloatingComposer.tsx` | 플로팅 댓글 입력 *(C1)* |
| `CommentThreadCard` | `CommentThreadCard.tsx` | 스레드·답글·리액션 *(C1)* |

### 2.5 페이지 컴포넌트 (`src/pages/`)

| 페이지 | 파일 | 주요 하위 컴포넌트 |
|--------|------|-------------------|
| `LandingPage` | `LandingPage.tsx` | Chip, Textarea, LoginModal, LoadingStream |
| `LoginPage` | `LoginPage.tsx` | Google 로그인 버튼 |
| `OnboardingPage` | `OnboardingPage.tsx` | ProgressBar, 단계 카드 ×3 |
| `DashboardPage` | `DashboardPage.tsx` | ProjectGrid, NewProjectCard |
| `ProjectListPage` | `ProjectListPage.tsx` | ProjectSearch, ServiceTypeFilter, 휴지통 링크 |
| `TrashPage` | `TrashPage.tsx` | 휴지통 목록·복원·영구삭제 *(T1)* |
| `ProjectCreatePage` | `ProjectCreatePage.tsx` | ProjectForm, InterviewStep, GenerationStep |
| `DocumentPage` | `DocumentPage.tsx` | DocumentLayout 전체 조합 |
| `SettingsPage` | `SettingsPage.tsx` | 프로필 탭, 플랜 탭 |
| `NotFoundPage` | `NotFoundPage.tsx` | 404 안내 + 대시보드 버튼 |

---

## 3. 상태관리 구조 (Zustand)

### 3.1 Store 목록

```
src/store/
├── authStore.ts        # 인증 세션, 사용자 프로필
├── projectStore.ts     # 프로젝트 CRUD, 목록, 필터
├── documentStore.ts    # 산출물 content, 탭, 자동저장
├── versionStore.ts     # 버전 목록, 선택, 복원
├── chatStore.ts        # AI 채팅 이력, 스트리밍 상태
├── generationStore.ts  # 산출물 생성 파이프라인 (5단계)
├── interviewStore.ts   # AI 인터뷰 답변 (비로그인/로그인 공용)
├── activityStore.ts    # 프로젝트 활동 로그 (L4) *(E2)*
├── memberStore.ts      # 프로젝트 멤버 CRUD *(M2)*
├── commentStore.ts     # 멤버 코멘트 스레드 *(C1)*
├── uiStore.ts          # Toast, Modal, UpgradeModal
└── planStore.ts        # 플랜 한도, 사용량 체크 (active 프로젝트만 카운트)
```

### 3.2 Store 상세

#### `authStore`
```typescript
interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  isOnboardingCompleted: boolean

  initialize: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<void>
  completeOnboarding: () => Promise<void>
}
```

#### `projectStore`
```typescript
interface ProjectState {
  projects: Project[]
  currentProject: Project | null
  searchQuery: string
  serviceTypeFilter: string
  isLoading: boolean

  fetchProjects: () => Promise<void>
  createProject: (data: CreateProjectInput) => Promise<Project>
  updateProject: (id: string, data: Partial<Project>) => Promise<void>
  trashProject: (id: string) => Promise<void>
  restoreProject: (id: string) => Promise<void>
  purgeProject: (id: string) => Promise<void>
  fetchTrashedProjects: () => Promise<void>
  setCurrentProject: (id: string) => Promise<void>
  getFilteredProjects: () => Project[]
}
```

#### `documentStore`
```typescript
interface DocumentState {
  documents: Record<DocumentType, Document | null>
  activeDocType: DocumentType
  content: string
  saveStatus: 'saved' | 'saving' | 'error'
  isReadOnly: boolean  // 과거 버전 열람 시

  fetchDocuments: (projectId: string) => Promise<void>
  setActiveDocType: (type: DocumentType) => void
  updateContent: (content: string) => void
  autoSave: () => Promise<void>       // debounce 2초
  regenerate: (type: DocumentType) => Promise<void>
}
```

#### `versionStore`
```typescript
interface VersionState {
  versions: DocumentVersion[]
  activeVersionId: string | null
  isViewingPastVersion: boolean

  fetchVersions: (documentId: string) => Promise<void>
  saveVersion: (name?: string) => Promise<void>
  selectVersion: (versionId: string) => void
  restoreVersion: (versionId: string) => Promise<void>
}
```

#### `chatStore`
```typescript
interface ChatState {
  messages: ChatMessage[]
  input: string
  pendingAttachments: ChatAttachment[]  // 전송 전 첨부 (최대 5개)
  isStreaming: boolean

  fetchMessages: (projectId: string, documentId?: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  addAttachment: (file: File) => void
  removeAttachment: (id: string) => void
  clearInput: () => void
}
```

#### `generationStore`
```typescript
type GenerationStep = 'prd' | 'ia' | 'screen_list' | 'policy' | 'cursor_prompt'

interface GenerationState {
  currentStep: GenerationStep | null
  completedSteps: GenerationStep[]
  streamText: string
  isGenerating: boolean
  error: string | null

  startPipeline: (input: GenerationInput) => Promise<string>  // projectId 반환
  cancelGeneration: () => Promise<void>
  regenerateSingle: (step: GenerationStep) => Promise<void>
}
```

#### `interviewStore`
```typescript
interface InterviewState {
  answers: Record<string, string>
  currentQuestionIndex: number
  serviceType: string

  setAnswer: (questionId: string, answer: string) => void
  skipQuestion: () => void
  skipAll: () => void
  getQuestions: () => InterviewQuestion[]
  isComplete: () => boolean
  reset: () => void
}
```

#### `uiStore`
```typescript
interface UIState {
  toasts: Toast[]
  modals: { upgrade: boolean; login: boolean; confirm: ConfirmModalConfig | null }

  showToast: (type: ToastType, message: string) => void
  openUpgradeModal: () => void
  openLoginModal: () => void
  openConfirmModal: (config: ConfirmModalConfig) => void
  closeModal: (key: ModalKey) => void
}
```

#### `planStore`
```typescript
interface PlanState {
  plan: PlanType
  aiGenerationsThisMonth: number
  projectCount: number
  versionCount: number

  canCreateProject: () => boolean
  canGenerate: () => boolean
  canSaveVersion: () => boolean
  getRemainingGenerations: () => number | 'unlimited'
}
```

### 3.3 Store 간 의존관계

```
authStore ─────────────────────────► planStore (user.plan, ai_generations)
    │
    ▼
projectStore ──► documentStore ──► versionStore
    │                  │
    │                  ▼
    │             chatStore
    ▼
generationStore ◄── interviewStore
    │
    ▼
uiStore (에러/한도 초과 시 모달·토스트)
```

### 3.4 클라이언트 영속화

| 저장소 | 키 | 용도 |
|--------|-----|------|
| `sessionStorage` | `planos_guest_result` | 비로그인 체험 결과 (로그인 후 이관) |
| `sessionStorage` | `planos_last_doc_type:{projectId}` | 마지막 본 산출물 탭 |
| `sessionStorage` | `planos_guest_*` | 비로그인 체험 히스토리 (LAND-001) |
| `localStorage` | `planos_onboarding_done` | 온보딩 완료 캐시 (서버 값과 동기화) |
| Cookie (서버) | `guest_session` | 비로그인 1회 rate limit |
| DB | `document_versions` | L2 명시적 버전 (DOC-001) |
| DB | `chat_messages` | L3 AI 채팅 이력 (DOC-001) |
| DB | `project_activities` | L4 활동 로그 |
| DB | `generation_runs` | 생성 파이프라인 실행 이력 |
| DB | `user_notifications` | L6 알림 인박스 *(N4, `007`)* |

---

## 4. API / Edge Function 목록

### 4.1 Supabase Database (직접 호출)

| 리소스 | 메서드 | RLS | 설명 |
|--------|--------|-----|------|
| `users` | SELECT, UPDATE, DELETE | `auth.uid() = id` | 프로필, 온보딩, 탈퇴 |
| `projects` | CRUD | owner 전체 + 멤버 SELECT (`006`) | 프로젝트 관리 (`title`, `chat_title` 등) |
| `documents` | CRUD | 멤버 SELECT / editor+ INSERT·UPDATE (`006`) | 산출물 content |
| `document_versions` | SELECT, INSERT | 멤버 SELECT / editor+ INSERT (`006`) | 버전 생성/조회 |
| `chat_messages` | SELECT, INSERT | 멤버 SELECT / editor+ INSERT (`006`) | 채팅 이력 |
| `project_members` | SELECT, INSERT, UPDATE, DELETE | 소유자 관리·동료 조회 (`002`, `006`) | 멤버 초대·역할 |
| `project_activities` | SELECT, INSERT | 프로젝트 멤버 (`006`) | 활동 로그 |
| `generation_runs` | ALL | editor+ owner (`006`) | AI 생성 실행 기록 |

| `project_comments` | CRUD | 프로젝트 멤버 (`006`) | 댓글·스레드 |
| `comment_reactions` | CRUD | 프로젝트 멤버 (`006`) | 리액션 |
| `comment_participant_status` | CRUD | 프로젝트 멤버 (`006`) | 멤버별 완료 |
| `user_notifications` | SELECT, INSERT, UPDATE | 본인 SELECT/UPDATE, actor INSERT (`007`) | 대시보드·GNB 알림 |

### 4.2 Supabase Auth

| API | 설명 |
|-----|------|
| `signInWithOAuth({ provider: 'google' })` | Google 로그인 |
| `signOut()` | 로그아웃 |
| `getSession()` / `onAuthStateChange` | 세션 관리 |
| `auth.admin.deleteUser()` (Edge Function 경유) | 계정 삭제 |

### 4.3 Edge Functions

모든 AI 호출은 **프론트 → Edge Function → Claude API → SSE 스트리밍 → 프론트** 구조.

| Function | Method | 인증 | Input | Output |
|----------|--------|------|-------|--------|
| `generate-prd` | POST | JWT 또는 Guest | `{ projectInfo, interviewAnswers }` | SSE stream → PRD markdown |
| `generate-ia` | POST | JWT | `{ prdContent }` | SSE stream → IA markdown |
| `generate-screen-list` | POST | JWT | `{ prdContent, iaContent }` | SSE stream → 화면목록 |
| `generate-policy` | POST | JWT | `{ prdContent, screenListContent }` | SSE stream → 정책서 |
| `generate-cursor-prompt` | POST | JWT | `{ prd, ia, screenList, policy }` | SSE stream → Cursor 프롬프트 |
| `generate-pipeline` | POST | JWT | `{ projectInfo, interviewAnswers }` | SSE stream (5단계 순차) |
| `chat-document` | POST | JWT | `{ documentContent, chatHistory, docType }` | SSE stream → 수정된 content |
| `update-memory-summary` | POST | JWT | `{ projectId, trigger }` | `{ memory_summary }` |
| `delete-account` | POST | JWT | `{}` | cascade delete |
| `guest-generate` | POST | Guest (IP rate limit) | `{ idea, interviewAnswers }` | SSE stream (PRD만 또는 전체) |

### 4.4 Edge Function 공통 스펙

```typescript
// 공통 요청 헤더
Authorization: Bearer <supabase_jwt>  // 로그인 사용자
X-Guest-Session: <session_id>         // 비로그인

// 공통 Claude 파라미터
model: 'claude-sonnet-4-20250514'
max_tokens: 4000
stream: true

// 공통 응답 (SSE)
event: chunk   data: { text: string }
event: done    data: { fullContent: string }
event: error   data: { message: string }
```

### 4.5 프론트 API 레이어 (`src/lib/`)

| 파일 | 역할 |
|------|------|
| `supabase.ts` | Supabase client |
| `supabaseHelpers.ts` | PostgREST 에러 처리 유틸 |
| `api/projects.ts` | 프로젝트 CRUD + `chat_title` 자동 생성 (`deriveChatTitle`) ✅ |
| `api/documents.ts` | 문서 CRUD + 자동저장 ✅ |
| `api/versions.ts` | 버전 CRUD ✅ |
| `api/chat.ts` | 채팅 메시지 CRUD ✅ |
| `api/members.ts` | `project_members` CRUD ✅ |
| `api/activities.ts` | `project_activities` 로그 ✅ |
| `api/generationRuns.ts` | `generation_runs` 기록 ✅ |
| `api/generation.ts` | placeholder 파이프라인 (EF 전) / SSE 예정 |
| `api/auth.ts` | OAuth, 프로필, 온보딩 ✅ |
| `api/comments.ts` | ✅ Real API (`005`) — 생성·답글·리액션·완료 + `notify.ts` |
| `api/notifications.ts` | ✅ Real API (`007`) — fetch·markRead·summary |
| `notifications/notify.ts` | ✅ 댓글·채팅 이벤트 → `user_notifications` insert |
| `generation/placeholderContent.ts` | EF 배포 전 임시 생성 콘텐츠 |
| `scripts/db-push.mjs` | `npm run db:push` 마이그레이션 CLI |
| `config.ts` | `USE_MOCK_API`, `MOCK_USER_ID`, `ENABLE_MOCK_ROUTE_GUARDS` 등 |
| `api/export.ts` |보내기 횟수·감사 *(E4)* |
| `lib/export/buildMarkdown.ts` | MD 파일 생성 *(E1)* |
| `lib/export/buildZip.ts` | ZIP 번들 생성 *(E1)* |
| `chatTitle.ts` | 채팅 제목 자동 생성·검증 (`deriveChatTitle`, `validateChatTitle`) |
| `chatAttachments.ts` | 채팅 파일 첨부 파싱·크기 제한 (5개·5MB) |
| `hooks/useSSE.ts` | SSE 스트리밍 수신 훅 |
| `hooks/useAutoSave.ts` | debounce 2초 자동저장 |
| `hooks/useDebounce.ts` | 검색 300ms debounce |

### 4.6 DB 스키마 보완 (기존 타입 대비 추가 필요)

```sql
-- users 테이블 추가 컬럼
plan                      text DEFAULT 'free'
ai_generations_this_month integer DEFAULT 0
onboarding_completed      boolean DEFAULT false
created_at                timestamptz DEFAULT now()

-- projects 테이블
created_at, updated_at    timestamptz
chat_title                text DEFAULT ''  -- 008: 채팅 패널 표시 제목

-- documents 테이블
created_at, updated_at    timestamptz

-- document_versions 테이블
id                        uuid PK
document_id               uuid FK
created_at                timestamptz

-- chat_messages 테이블
id                        uuid PK
created_at                timestamptz
```

### 4.7 RLS 정책 요약 (`006`, `007` 적용 후)

```sql
-- 헬퍼 (006)
get_project_role(project_id)  -- 'owner' | 'editor' | 'viewer' | null
can_access_project(project_id)
can_edit_project_content(project_id)  -- owner | editor

-- projects: owner FOR ALL + member SELECT (active, not trashed)
-- documents, versions, chat, comments: member SELECT / editor+ write
-- project_members: owner manage + 동료 조회
-- user_notifications: 본인 SELECT/UPDATE, actor INSERT (007)
-- users: auth.uid() = id
```

---

## 5. 개발 순서 추천 (의존관계 기준)

### Phase 0 — 인프라 기반 (1~2일)
- [x] Supabase 프로젝트 생성, DB 마이그레이션 (`001`, `002`), RLS 적용
- [x] `.env.local` 환경변수 (`VITE_SUPABASE_*`, `SUPABASE_DB_URL`)
- [x] `npm run db:push` 마이그레이션 스크립트
- [x] 공통 UI 컴포넌트 (`Button`, `Input`, `Modal`, `Toast` 등)
- [x] `AppLayout`, `GlobalNavBar`, 라우터 + 가드 설정
- [x] `authStore` — Supabase Auth (`getSession`, `onAuthStateChange`)
- [x] 라우트 가드 활성 (`ENABLE_MOCK_ROUTE_GUARDS = true`)
- [x] `USE_MOCK_API = false`, 마이그레이션 `001`~`008`
- [ ] Google OAuth E2E (콘솔 Redirect URL 설정)

**완료 기준:** 로컬 UI 접근 ✅ / OAuth E2E·RLS 정합 검증 남음

---

### Phase 1 — 인증 & 온보딩 (2~3일)
- [x] `LoginPage` (AUTH-001)
- [x] `OnboardingPage` (AUTH-002)
- [x] `SettingsPage` 프로필/로그아웃 탭 (SET-001 일부)
- [x] `users` 테이블 프로필 (`handle_new_user` 트리거 + `fetchUserProfile`)
- [ ] Google OAuth E2E (콘솔 Redirect URL 설정)

**완료 기준:** Google 로그인 → 온보딩(1회) → 대시보드 진입 *(OAuth 설정 후 검증)*

---

### Phase 2 — 프로젝트 CRUD (2~3일)
- [x] `projectStore`, `planStore` — Supabase `projects` 연동
- [x] `DashboardPage` (DASH-001)
- [x] `ProjectListPage` (PROJ-001)
- [x] `ProjectCard`, 검색/필터, 휴지통 이동
- [x] Free 플랜 3개 제한 + `UpgradeModal` (UI만, 결제 연동은 후순위)

**완료 기준:** 프로젝트 생성/조회/삭제, 대시보드·목록 화면 완성 ✅

---

### Phase 3 — 프로젝트 생성 + AI 인터뷰 (3~4일)
- [x] `ProjectCreatePage` 스텝1 (기본정보 폼 + 유효성 검사, `ProjectForm`)
- [x] `ProjectCreatePage` 스텝2 (AI 인터뷰, 서비스유형별 분기, `InterviewPanel`)
- [x] 입력값 정책 적용 (글자수 제한, 필수값)
- [ ] `interviewStore` (현재 페이지 state + `generationStore`로 관리)

**완료 기준:** 스텝1→2 완료, 인터뷰 답변 DB 저장 ✅

---

### Phase 4 — AI 생성 파이프라인 (4~5일) ⚠️ 핵심
- [ ] Edge Functions: `generate-prd` ~ `generate-cursor-prompt` (미배포)
- [ ] `generate-pipeline` (5단계 순차 호출 통합)
- [x] `generationStore` + `LoadingStream` + `GenerationStep`
- [x] `ProjectCreatePage` 스텝3 (생성 중 UI)
- [x] 생성 완료 → DB 저장 (projects, documents, `generation_runs`) — **placeholder 콘텐츠**
- [x] AI 생성 횟수 카운트 (Free 월 10회)
- [x] 생성 취소 UI

**완료 기준:** placeholder로 5개 산출물 생성 → DOC-001 이동 ✅ / 실제 Claude는 EF 후

---

### Phase 5 — 산출물 편집 화면 (4~5일)
- [x] `documentStore`, `versionStore` — Supabase `documents`, `document_versions` 연동
- [x] `DocumentPage` 3단 레이아웃
- [x] `DocumentPage` v2 레이아웃 (`DocumentTypeTabs`, `DocumentLeftPanel`, `DocumentRightPanel`)
- [x] DOC v2.1 — 헤더 1행 통합, 채팅 항상 표시, `EditableInlineTitle`, `chat_title` (`008`)
- [x] `ChatPanel` 파일 첨부 (📎) + `EditableChatTitle`
- [x] `MarkdownEditor` + 자동저장 (debounce 2초)
- [x] `VersionPills` + 버전 저장/복원 + `SaveVersionModal` (`version_name`)
- [x] 산출물 탭 딥링크 (`/projects/:id/:docType`)

**완료 기준:** 산출물 열람/편집/자동저장/버전관리 동작 ✅

---

### Phase 6 — AI 채팅 & 재생성 (3~4일)
- [ ] Edge Function: `chat-document` (미배포)
- [x] `chatStore` + `ChatPanel` — `chat_messages` Supabase 저장, `pendingAttachments`
- [x] `projects.chat_title` — 생성 시 자동·패널에서 인라인 편집
- [x] 채팅 → 문서 content 반영 (placeholder append, 스트리밍은 EF 후)
- [x] `RegenerateModal` (PRD/IA 연쇄 재생성 확인)
- [x] Cursor 프롬프트 단독 재생성
- [x] `memory_summary` 갱신 (클라이언트)
- [x] 관련 산출물 업데이트 안내 (`RelatedDocsNotice`)

**완료 기준:** AI 채팅으로 문서 수정, 재생성 플로우 완성

---

### Phase 7 — 비로그인 체험 & 랜딩 (2~3일)
- [x] `LandingPage` (LAND-001)
- [ ] Edge Function: `guest-generate` (IP rate limit)
- [x] 인라인 인터뷰 + `LoadingStream` + 결과 미리보기
- [x] `LoginModal` + sessionStorage 이관 로직
- [x] 로그인 후 자동 저장 → DOC-001

**완료 기준:** 비로그인 1회 체험 → 로그인 → 결과 저장 전체 플로우

---

### Phase 8 — 설정 & 마무리 (2일)
- [x] `SettingsPage` 플랜 탭 (AI 사용량, 업그레이드)
- [x] 계정 삭제 UI + `users` DELETE (`auth.ts`)
- [ ] Edge Function: `delete-account` (`auth.users` cascade)
- [x] `NotFoundPage`, `DesktopOnlyBanner`
- [ ] 전역 에러 처리 (세션 만료, 네트워크 오류, 404)
- [ ] E2E 핵심 플로우 테스트

**완료 기준:** MVP 전체 플로우 동작, 예외처리 정책 반영

---

### 의존관계 다이어그램

```
Phase 0 (인프라)
    │
    ├──► Phase 1 (인증)
    │         │
    │         ├──► Phase 2 (프로젝트 CRUD)
    │         │         │
    │         │         ├──► Phase 3 (인터뷰)
    │         │         │         │
    │         │         │         ▼
    │         │         │    Phase 4 (AI 생성) ◄── Edge Functions
    │         │         │         │
    │         │         │         ▼
    │         │         │    Phase 5 (편집)
    │         │         │         │
    │         │         │         ▼
    │         │         │    Phase 6 (채팅/재생성)
    │         │         │
    │         │         └──► Phase 7 (랜딩/비로그인)
    │         │
    │         └──► Phase 8 (설정/마무리)
```

---

## 6. 예상 기술적 난이도 및 주의사항

### 6.1 난이도 매트릭스

| 영역 | 난이도 | 이유 |
|------|--------|------|
| 기본 CRUD + 라우팅 | ★★☆☆☆ | Supabase + React Router 표준 패턴 |
| Google OAuth | ★★☆☆☆ | Supabase Auth 내장, Redirect URL 설정만 주의 |
| AI 5단계 파이프라인 | ★★★★★ | 순차 의존, SSE 스트리밍, 중간 실패 복구 |
| SSE 스트리밍 UI | ★★★★☆ | LoadingStream, 채팅, 재생성 3곳에서 공용 필요 |
| 버전 관리 | ★★★☆☆ | 자동저장 vs 버전저장 분리, 복원 시 새 버전 생성 |
| 비로그인 체험 → 로그인 이관 | ★★★★☆ | sessionStorage + DB 저장 타이밍, race condition |
| 플랜 한도 체크 | ★★★☆☆ | 월간 카운트 리셋, 버전 보관 한도 |
| memory_summary 관리 | ★★★☆☆ | 2,000자 제한, 갱신 시점 정확히 준수 |
| 산출물 연쇄 재생성 | ★★★★☆ | PRD 변경 → IA/화면목록/정책서 영향도 처리 |

### 6.2 핵심 주의사항

#### AI / Edge Function
- **API 키는 Edge Function 환경변수에만** 저장. 프론트 번들에 절대 포함 금지.
- 5단계 파이프라인 중간 실패 시 **완료된 단계까지 DB 저장** 후 재시도 UI 제공 (기획서 취소 정책).
- SSE 연결 끊김 시 클라이언트에서 재연결 또는 부분 결과 보존 로직 필요.
- `max_tokens: 4000` 제한으로 긴 산출물 잘림 가능 → 프롬프트에서 분량 가이드 필요.
- 비로그인 `guest-generate`는 **IP + 세션 쿠키 기준 1회** rate limit 필수.

#### 상태관리
- `documentStore`의 자동저장과 `versionStore`의 수동 버전 저장을 **반드시 분리**. 자동저장은 `documents.content`만 UPDATE.
- `generationStore`와 `chatStore`의 `isStreaming` 상태가 겹치지 않도록 UI에서 동시 요청 차단.
- 비로그인 체험 데이터(`interviewStore`)와 로그인 후 프로젝트 생성 간 **상태 초기화/이관** 명확히 정의.

#### 인증 / 보안
- Supabase RLS를 프론트 검증과 **이중으로** 적용. 프론트 한도 체크는 UX용, 실제 제한은 Edge Function에서 JWT + DB 카운트로 enforcement.
- `delete-account`는 Edge Function에서 cascade delete 수행 (RLS 우회 필요 시 service role).
- OAuth redirect URL: `localhost:5173` + 프로덕션 도메인 모두 Supabase에 등록.

#### UX / 정책
- MVP는 **데스크탑 전용 (1024px+)**. `DesktopOnlyBanner`는 차단이 아닌 안내.
- PRD/IA 재생성 시 **연쇄 재생성 모달** 필수. Cursor 프롬프트만 단독 재생성.
- 되돌리기는 현재 버전 보존 후 **새 버전으로 생성** (기존 버전 삭제 아님).
- Free 플랜 한도 초과 시 버튼 비활성화 + `UpgradeModal`. **기존 데이터 삭제하지 않음**.

#### 성능
- 프로젝트 목록 검색: debounce 300ms, 클라이언트 필터링 (MVP 규모에서 충분).
- 문서 자동저장: debounce 2초, 저장 중 중복 요청 방지 (queue 또는 abort).
- 채팅 이력: 프로젝트+문서 단위 pagination 고려 (초기에는 전체 로드, 100건 이상 시 분页).

### 6.3 기술 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| Claude API 응답 지연/타임아웃 | 생성 UX 저하 | Edge Function timeout 60s, 단계별 재시도, 취소 버튼 |
| SSE 브라우저 호환 | 스트리밍 실패 | `fetch` + `ReadableStream` 폴백, non-stream 폴백 API |
| 대용량 markdown (50,000자) | 에디터 성능 | MVP는 textarea, V2에서 CodeMirror 전환 |
| 동시 탭 편집 | 데이터 충돌 | MVP는 단일 탭 가정, `updated_at` 낙관적 잠금은 V2 |
| 결제 연동 미구현 | 업그레이드 CTA 무동작 | MVP에서 UpgradeModal은 안내만, 결제는 V2 (Stripe/토스) |

### 6.4 V2 이후 확장 포인트 (참고)

- `CodeMirror` 에디터, `Mermaid.js` 유저 플로우
- 멤버 초대 수락·소유권 이전 (Mock은 owner/editor/viewer만) — [`MEMBER_PERMISSIONS_DESIGN.md`](../../MEMBER_PERMISSIONS_DESIGN.md)
- PDF보내기 (Markdown/ZIP은 E1~E3 완료, PDF는 V2) — [`HISTORY_AND_EXPORT_DESIGN.md`](../../HISTORY_AND_EXPORT_DESIGN.md)
- 반응형 레이아웃
- 결제 연동 (Pro 9,900원 / Team 29,000원)

---

## 부록: 산출물 생성 의존 그래프

```
[기본정보 + AI 인터뷰]
         │
         ▼
       PRD ──────────────────────────────┐
         │                               │
         ▼                               │
        IA                                │
         │                               │
         ▼                               │
   화면목록                               │
         │                               │
         ▼                               │
      정책서                              │
         │                               │
         └───────────┬───────────────────┘
                     ▼
            Cursor 프롬프트
```

## 부록: 서비스 유형 옵션

`앱` · `웹` · `커머스` · `SaaS` · `플랫폼` · `기타`

## 부록: DocumentType ↔ URL 매핑

| DocumentType | URL segment | 표시명 |
|-------------|-------------|--------|
| `prd` | `/prd` | PRD |
| `ia` | `/ia` | 기능명세서 |
| `screen_list` | `/screen-list` | 화면목록 *(UI 탭 숨김, 파이프라인 유지)* |
| `policy` | `/policy` | 정책서 |
| `wireframe` | `/wireframe` | 화면설계서 |
| `cursor_prompt` | `/cursor-prompt` | Cursor 프롬프트 |
