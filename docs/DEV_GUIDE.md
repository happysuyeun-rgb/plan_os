# PlanOS 개발 가이드 — 역할 분담 & 잔여 작업

> **2026-10-21 기준 안내:** 본 2026.06 개발 기록의 성공/완료·개발 순서는 현재 PlanOS 3.0 통합 출시 증거가 아니다. 새 작업은 [통합 실행계획 G0~G7](plans/PLANOS_INTEGRATED_EXECUTION_PLAN_2026-10-21.md), [현재 서비스기획 v2.0](product/SERVICE_PLAN_V1_2026-10-20.md), [53개 문서 교차검수](quality/PLANOS_FULL_DOC_REAUDIT_V3_2026-10-21.md), [개발용 데이터/권한 계약](engineering/AI_STAFF_DATA_AUTH_CONTRACT_V1_2026-10-21.md)를 기준으로 판단. 기존 V1 AI 인터뷰·5종 문서·댓글/버전/내보내기 기능 보존 참고에만 사용하며 실제 G1 CAS/RLS 재검증 필요.


> 최종 갱신: 2026.06.12 (v3)  
> 기준 문서: `TECH_SPEC.md`, `PlanOS_기획서_v3.0`, `PlanOS_화면설계서_v1.0`  
> 현재 모드: **Supabase Real API** (`USE_MOCK_API = false`) + **Supabase Auth** + **라우트 가드 ON** (`ENABLE_MOCK_ROUTE_GUARDS = true`)

---

## 0. 로컬 개발 모드

| 설정 | 값 | 설명 |
|------|-----|------|
| `USE_MOCK_API` | `false` | Supabase Real API |
| `ENABLE_MOCK_ROUTE_GUARDS` | `true` | 미로그인 시 `/login` 리다이렉트 |
| `ENABLE_DEV_LOGIN` | `true` (dev) | LoginPage 이메일/비밀번호 폼 |
| `authStore` | Supabase Auth | `getSession`, `onAuthStateChange` |

**로컬 DB 검증:** `.env.local`에 `VITE_SUPABASE_*` 설정 후 `npm run dev:user` 또는 Supabase Dashboard에서 테스트 유저 생성. RLS는 `auth.uid()` 기준이므로 **로그인 없이는 DB CRUD 불가**.

**dev 서버 포트:** `5173` (`strictPort: true`) — 충돌 시 기존 node 프로세스 종료 후 재시작.

---

## 1. 역할 분담 — AI(에이전트) vs 사용자(서아)

### 1.1 AI(에이전트)가 하는 일

| 영역 | 구체적 작업 |
|------|------------|
| **프론트엔드 구현** | React 컴포넌트, 페이지, Zustand store, 라우팅, Tailwind 스타일 |
| **Supabase API** | `src/lib/api/*.ts` — DB·Auth 직접 호출 구현·유지 |
| **DB 마이그레이션** | `supabase/migrations/` 작성 + `npm run db:push` 실행 |
| **타입·유틸** | `src/types/`, hooks, 공통 컴포넌트 |
| **Supabase SQL** | `supabase/migrations/` 마이그레이션 파일 작성·적용 |
| **Edge Function 코드** | `supabase/functions/` 함수 작성 (배포는 사용자) |
| **버그 수정** | 재현 가능한 로직 오류, 타입 오류, 빌드 실패 |
| **리팩터링** | 컴포넌트 분리, store 정리, 명세 대비 코드 정합성 |
| **문서** | `docs/` 기술 문서, 체크리스트 갱신 |
| **로컬 검증** | `npm run build`, dev 서버 기동 확인 |

### 1.2 사용자(서아)가 하는 일

> 상세 체크리스트: [`USER_TASKS.md`](./USER_TASKS.md)

| 영역 | 구체적 작업 | 시점 |
|------|------------|------|
| ~~**Supabase 프로젝트 생성**~~ | ~~[supabase.com](https://supabase.com)에서 프로젝트 생성~~ | ✅ 완료 |
| ~~**DB 마이그레이션 실행**~~ | ~~`npm run db:push` (`001`~`008`)~~ | ✅ 완료 |
| ~~**환경변수 설정**~~ | ~~`.env.local` (`VITE_SUPABASE_*`, `SUPABASE_DB_URL`)~~ | ✅ 완료 |
| ~~**로컬 dev 로그인**~~ | ~~`npm run dev:user` + LoginPage 이메일/비밀번호~~ | ✅ 완료 |
| ~~**DB 마이그레이션 `006`~`008`**~~ | ~~`006` 멤버 RLS + `007` 알림 + `008` chat_title, `npm run db:push`~~ | ✅ 완료 |
| **Google OAuth 설정** | Supabase Auth → Google Provider, Redirect URL | 로그인 E2E 전 |
| **Claude API 키** | Edge Function Secrets `ANTHROPIC_API_KEY` | AI 연결 전 |
| **Edge Function 배포** | `supabase functions deploy` | AI 연결 전 |
| **Vercel 배포** | 프로덕션 환경변수, 도메인 | 출시 전 |
| **브라우저 E2E 테스트** | 로그인·생성·편집·댓글·알림 | 매 Phase 후 |
| **기획·디자인·법적** | 플랜 가격, UI 톤, 약관 URL | 수시 / 출시 전 |
| **결제 연동** | Stripe/토스 (V2) | MVP 이후 |

### 1.3 협업이 필요한 작업

| 작업 | AI | 사용자 |
|------|-----|--------|
| AI 프롬프트 설계 | Edge Function 프롬프트 코드 작성 | 도메인 톤·품질 검수, 샘플 산출물 피드백 |
| Mock → Real 전환 | ~~`src/lib/api/*.ts` Supabase 구현, `authStore` Auth 연동~~ | ~~키·마이그레이션~~ ✅ / Google OAuth·EF 배포 남음 |
| 플랜 한도 정책 | UI 차단 + 서버 enforcement 코드 | 한도 수치 최종 확인 (Free 3개/10회 등) |
| 에러 메시지 | 토스트·모달 문구 구현 | 한국어 문구 톤 검수 |

---

## 2. 개발 진행 순서 (권장)

```
[현재] Mock MVP 완성 (~93%)
    ↓
~~2단계: Mock 갭 메우기~~ ✅ (게스트 이관, 연쇄 재생성, 컴포넌트 분리)
    ↓
~~3단계: Supabase 연결 (DB + Auth + RLS)~~ ✅ 부분 완료 — DB·API·Auth 코드 연동 / Google OAuth·E2E 검증 남음
    ↓
4단계: Edge Functions + Claude API (실제 AI 생성)  ← 다음
~~3.5단계: 히스토리·보내기 (E1~E3)~~ ✅ — [`HISTORY_AND_EXPORT_DESIGN.md`](./HISTORY_AND_EXPORT_DESIGN.md)  
~~3.6단계: 멤버 권한 (M1~M3)~~ ✅ — [`MEMBER_PERMISSIONS_DESIGN.md`](./MEMBER_PERMISSIONS_DESIGN.md)  
~~3.7단계: 멤버 코멘트 C1~~ ✅ — [`MEMBER_COMMENTS_DESIGN.md`](./MEMBER_COMMENTS_DESIGN.md)  
　~~C1 Real API (`005`)~~ ✅ · C2~C5: 앵커·멘션·Realtime (미구현)  
~~3.8단계: 프로젝트 휴지통 T1 (Mock)~~ ✅ — [`PROJECT_TRASH_DESIGN.md`](./PROJECT_TRASH_DESIGN.md)  
　T2~T4: GNB 뱃지·자동 purge (미구현)  
~~3.9단계: 대시보드 알림 N1 (Mock)~~ ✅ — [`DASHBOARD_NOTIFICATIONS_DESIGN.md`](./DASHBOARD_NOTIFICATIONS_DESIGN.md)  
　~~N4 Real API (`007`)~~ ✅ · N2~N3·Realtime (미구현)
    ↓
5단계: UI Polish + E2E 테스트
    ↓
6단계: Vercel 배포 + 출시
```

각 단계 시작 시 사용자가 **「○단계 진행해줘」**라고 지시하면 AI가 해당 범위만 구현합니다.

---

## 3. 잔여 개발 구현 현황

### 전체 완성도: **약 96%** (프론트) / **약 50%** (백엔드·실서비스)

| Phase | 명칭 | 완성도 | 상태 |
|-------|------|--------|------|
| 0 | 인프라 기반 | 95% | ✅ Supabase client·마이그레이션 `001`~`008`·`db:push` |
| 1 | 인증 & 온보딩 | 85% | ✅ Supabase Auth + dev 로그인 / Google OAuth E2E 대기 |
| 2 | 프로젝트 CRUD | 98% | ✅ CRUD·휴지통 T1·이름 변경·⋮ 메뉴 |
| 3 | AI 인터뷰 | 90% | ✅ ProjectForm·StepProgress·InterviewPanel |
| 4 | AI 생성 파이프라인 | 90% | ✅ placeholder 파이프라인 (EF·Claude 미배포) |
| 5 | 산출물 편집 | 96% | ✅ v2.1 레이아웃·인라인 제목·채팅 첨부·리뷰모드 |
| 6 | AI 채팅 & 재생성 | 85% | ✅ 연쇄 재생성, memory_summary 갱신 |
| 7 | 비로그인 체험 | 85% | ✅ 게스트 이관, 인라인 인터뷰 |
| 8 | 설정 & 마무리 | 75% | ✅ 계정 삭제 UI / 전역 에러 처리 미구현 |
| 3.5 | 히스토리·보내기 | 95% | ✅ E1~E3 (E4~E6+ 미구현) |
| 3.6 | 멤버·권한 | 95% | ✅ M1~M2 UI·API + **M3 RLS (`006`)** |
| 3.7 | 멤버 코멘트 | 85% | ✅ C1 UI + **`005` Real API** / C2~C5 미구현 |
| 3.8 | 프로젝트 휴지통 | 90% | ✅ T1 (T2~T4 미구현) |
| 3.9 | 대시보드 알림 | 75% | ✅ N1 UI + **N4 Real API (`007`)** / N2~N3·Realtime 미구현 |

---

### 3.1 AI가 다음에 구현할 수 있는 것 (Supabase 없이)

| 우선순위 | 작업 | Phase | 상태 |
|----------|------|-------|------|
| ~~🔴 높음~~ | ~~게스트 체험 → 로그인 후 프로젝트 자동 저장·DOC 이동~~ | 7 | ✅ |
| ~~🔴 높음~~ | ~~PRD/IA 연쇄 재생성 로직 + `RegenerateModal`~~ | 6 | ✅ |
| ~~🔴 높음~~ | ~~랜딩 인라인 AI 인터뷰~~ | 7 | ✅ |
| ~~🟡 중간~~ | ~~프로젝트 이름 변경~~ | 2 | ✅ |
| ~~🟡 중간~~ | ~~`memory_summary` 채팅 수정 시 갱신 (mock)~~ | 6 | ✅ |
| ~~🟡 중간~~ | ~~`planos_last_doc_type` sessionStorage~~ | 5 | ✅ |
| ~~🟡 중간~~ | ~~컴포넌트 분리 (스펙 구조 정리)~~ | 전체 | ✅ |
| 🟡 중간 | `uiStore` 모달 통합 | 0 |
| ~~🟡 중간~~ | ~~생성 파이프라인 취소 버튼~~ | 4 | ✅ |
| 🟢 낮음 | `ProgressBar`, `Chip`, `LoginModal` 등 미분리 컴포넌트 | 0 |
| 🟢 낮음 | mock 데이터 품질 향상 (실제 같은 PRD 샘플) | - |
| ~~🟢 낮음~~ | ~~`TECH_SPEC.md` 체크리스트 갱신~~ | - | ✅ → `MOCK_GAP_REVIEW.md`로 분리 |

### 3.2 Supabase 연동 현황 (2026.06.12 v2)

| 작업 | 상태 | 비고 |
|------|------|------|
| Supabase 프로젝트 + `.env.local` | ✅ | `VITE_SUPABASE_*`, `SUPABASE_DB_URL` |
| DB 마이그레이션 | ✅ | `001`~`008` |
| 라우트 가드 | ✅ | `ENABLE_MOCK_ROUTE_GUARDS = true` |
| `authStore` Supabase Auth | ✅ | `getSession`, `onAuthStateChange`, dev 로그인 |
| projects / documents / versions / chat API | ✅ | Real API |
| members / activities / generationRuns API | ✅ | Real API |
| **comments API** | ✅ | `005_project_comments.sql` + `comments.ts` |
| **notifications API** | ✅ | `007_user_notifications.sql` + `notifications.ts`, `notify.ts` |
| AI 생성·채팅 (실제 Claude) | ❌ | placeholder, Edge Function 미배포 |
| Google OAuth E2E | ❌ | 사용자 — Supabase Auth Google Provider |
| SSE 스트리밍 | ❌ | `hooks/useSSE.ts` 미구현 |
| 계정 삭제 | UI+`users` DELETE ✅ | `delete-account` EF |

### 3.2.1 알려진 DB·설계 갭

| 갭 | 영향 |
|----|------|
| ~~멤버 RLS M3 미구현~~ | ✅ `006` — editor/viewer DB 접근 |
| ~~`notifications` 테이블 없음~~ | ✅ `007` + notify 연동 |
| `screen_list` UI 숨김 | 파이프라인·export에는 유지, 탭만 비표시 |
| ~~`version_name` 입력 UI 없음~~ | ✅ `SaveVersionModal` |

### 3.3 사용자 작업 후 AI가 구현할 것 (남은 Supabase·백엔드)

| 작업 | 사용자 선행 작업 | AI 구현 |
|------|-----------------|---------|
| 실제 Google 로그인 E2E | OAuth 설정 완료 | Redirect URL 검증, 로그인 플로우 테스트 |
| AI 생성 | API 키 + EF 배포 | `generate-pipeline` Edge Function |
| AI 채팅 | EF 배포 | `chat-document` Edge Function |
| SSE 스트리밍 | EF 배포 | `useSSE.ts` 훅 |
| 코멘트 Real | ✅ `005` 적용됨 | C2~C5 (멘션·Realtime) |
| 알림 Real | ✅ `007` 적용됨 | `notifications.ts`, `notify.ts` |
| 계정 삭제 | - | `delete-account` EF |
| 비로그인 rate limit | - | `guest-generate` EF |

### 3.4 완료된 것 (최근 포함)

- ✅ **댓글 Supabase Real API** — `005_project_comments.sql`, `comments.ts` (생성·답글·리액션·완료)
- ✅ **프로젝트명 수정** — DASH/PROJ ⋮·우클릭 모달 / DOC 헤더 **인라인 편집** (`PROJECT_RENAME_DESIGN.md`)
- ✅ **DOC-001 레이아웃 v2.1** — 헤더 1행·탭 통합, 채팅 항상 표시, 제목·첨부 (`DOC_LAYOUT_DESIGN.md`)
- ✅ **`projects.chat_title`** — 생성 시 자동, `EditableChatTitle` 편집 (`008`)
- ✅ **`EditableInlineTitle`** — 헤더·패널 제목 클릭 인라인 편집 공통 컴포넌트
- ✅ **채팅 파일 첨부** — `chatAttachments.ts`, `pendingAttachments` (최대 5개·5MB)
- ✅ **IA → 기능명세서** 라벨, **화면목록 탭 UI 숨김** (`DOCUMENT_TYPE_UI_ORDER`)
- ✅ `wireframe` DB type (`004`), `generation_runs` RLS (`003`)
- ✅ **Supabase Auth** — `authStore` 세션 연동, dev 로그인 폼
- ✅ 8개 화면 라우트 + 기본 UI
- ✅ Store 12개 (`memberStore`, `commentStore`, `activityStore` 등)
- ✅ 버전 복원 시 문서 본문 업데이트
- ✅ AI 생성 횟수 +1 (생성/재생성/채팅)
- ✅ 버전 저장 Free 10개 한도
- ✅ 랜딩 5개 산출물 미리보기 전체 공개 (테스트 모드)
- ✅ `TEST_UNLOCK_ALL_DOCUMENTS` 테스트 플래그
- ✅ 게스트 이관, 연쇄 재생성, 랜딩 인라인 인터뷰 (2단계)
- ✅ 프로젝트 이름 변경 — DASH/PROJ: ⋮·우클릭 모달 / DOC-001: 헤더 **인라인 편집**
- ✅ 멤버 코멘트 C1 + Real API — 영역 선택·`CommentSidebar`·`005` 마이그레이션
- ✅ 탭 버전 표시 — `DocumentTypeTabs`에 `최종` 뱃지 + `vN`

---

## 4. 화면설계 추가 필요성 판단

### 결론: **기능 개발에는 추가 화면설계 불필요 / UI polish 전에 비주얼 디자인 권장**

| 구분 | 판단 | 이유 |
|------|------|------|
| **기능 구현 (현재~Mock MVP 완성)** | ❌ 불필요 | `화면설계서_v1.0`에 8개 화면 컴포넌트·인터랙션·정책이 이미 정의됨. 코드 골격이 이를 따름 |
| **컴포넌트 분리 리팩터링** | ❌ 불필요 | 화면설계서 컴포넌트 목록 = `TECH_SPEC` 섹션 2와 동일 |
| **연쇄 재생성·게스트 이관 등 갭** | ❌ 불필요 | 기획서_v3.0 플로우 시나리오(섹션 9)에 이미 기술됨 |
| **비주얼/UI polish** | ⚠️ 권장 | 현재 Tailwind 기본 스타일. Figma 시안 없음 |
| **에러/Empty 상태 디자인** | ⚠️ 선택 | 화면설계서에 예외처리 정책은 있으나 시각적 목업 없음 |
| **모바일 반응형 (V2)** | ✅ 필요 (V2 시) | 기획서: MVP는 데스크탑 전용. V2에서 별도 설계 필요 |
| **결제/업그레이드 UX (V2)** | ✅ 필요 (V2 시) | `UpgradeModal` UI만 있고 결제 플로우 설계 없음 |

### 기존 화면설계서로 커버되는 것

- 8개 화면 레이아웃, 컴포넌트 목록, 상태(활성/비활성/로딩)
- 인터랙션 정책 (클릭 시 동작, 유효성 검사)
- 공통 컴포넌트 (Toast, Modal, UpgradeModal, LoadingStream)
- AI 인터뷰 질문 분기 (서비스유형별 Q4)

### 화면설계서에 없어서 개발 중 AI가 임의 처리한 것

| 항목 | 현재 처리 | 디자인 확정 필요 여부 |
|------|-----------|----------------------|
| 색상/브랜딩 | Tailwind `brand-600` (보라) | polish 전 확정 권장 |
| DOC-001 상단 뒤로가기 바 | GNB 없는 축소 헤더 | 기획 의도와 일치, 유지 가능 |
| 랜딩 미리보기 5종 펼침 | 테스트용 전체 공개 | 출시 전 접기/탭 UX 결정 |
| DOC-001 레이아웃 v2.1 | 헤더 1행·채팅 항상 표시·인라인 제목 | ✅ `DOC_LAYOUT_DESIGN.md` |
| IA 표시명 | **기능명세서** | ✅ |
| 화면목록 탭 | UI 숨김 (파이프라인 유지) | ✅ |

### 권장 사항

1. **지금 당장:** 화면설계 추가 없이 **2단계 Mock 갭** 구현 진행 가능
2. **Supabase 연결 전:** 브랜드 컬러·폰트만 정하면 됨 (Figma 전체 시안은 선택)
3. **출시 2~4주 전:** Figma polish 시안 1회 권장 (8개 화면 + 모달)
4. **V2 (반응형·결제):** 별도 화면설계서 v2.0 작성 필요

---

## 5. Phase별 체크리스트 (갱신)

### Phase 0 — 인프라
- [x] API 레이어 (`src/lib/api/*.ts` → Supabase)
- [x] 공통 UI (Button, Input, Modal, Toast)
- [x] AppLayout, GlobalNavBar
- [x] 라우터 8화면 + 404
- [x] `authStore` — Supabase Auth (`getSession`, `onAuthStateChange`)
- [x] ProtectedRoute / PublicOnlyRoute / OnboardingRoute
- [x] `USE_MOCK_API = false`
- [x] Supabase + `npm run db:push` (`001`~`008`)
- [x] orphan `*.mock.ts` 정리 완료

### Phase 1 — 인증
- [x] LoginPage UI
- [x] OnboardingPage UI
- [x] SettingsPage 프로필 탭
- [x] `signInWithOAuth` + dev 이메일/비밀번호 로그인
- [ ] Google OAuth 콘솔 설정 + E2E 로그인 검증 ← **출시 전 필수**
- [x] `authStore` Supabase Auth 연동
- [x] `users` 테이블 + `handle_new_user` 트리거 (OAuth 연동 시 동작)

### Phase 2 — 프로젝트 CRUD
- [x] DashboardPage, ProjectListPage
- [x] ProjectCard, 검색/필터, 삭제
- [x] Free 3개 제한 + UpgradeModal
- [x] 프로젝트 이름 변경 — DASH/PROJ ⋮·우클릭 모달 / DOC 헤더 **인라인 편집**

### Phase 3 — AI 인터뷰
- [x] 스텝1 폼 + 유효성 (`ProjectForm`)
- [x] 스텝2 인터뷰 (서비스유형 분기, `InterviewPanel`)
- [x] `StepProgress`, `ProjectForm` 컴포넌트 분리

### Phase 4 — AI 생성
- [x] LoadingStream + 5단계 placeholder 파이프라인 (DB upsert 연동)
- [x] AI 생성 횟수 +1 (로컬: `authStore` 카운트 / OAuth 후: Supabase `users` 업데이트)
- [ ] Edge Functions (실제 Claude) ← **4단계, 사용자 키 + AI**
- [x] 생성 취소 버튼 UI (`GenerationStep`, `cancelGeneration`)

### Phase 5 — 산출물 편집
- [x] v2.1 레이아웃 — 헤더 1행 `DocumentTypeTabs`, 채팅 항상 표시, 댓글 우측 토글
- [x] `EditableInlineTitle` — 프로젝트명·채팅 제목 인라인 편집
- [x] 자동저장 2초, 버전 pills·복원·한도
- [x] `TEST_UNLOCK_ALL_DOCUMENTS` + 잠긴 탭 UX
- [x] last_doc_type sessionStorage
- [x] `version_name` 저장 시 이름 입력 UI (`SaveVersionModal`)

### Phase 6 — 채팅 & 재생성
- [x] ChatPanel + `chat_messages` Supabase 저장 + 📎 파일 첨부
- [x] `chat_title` 자동 생성·편집 (`008`, `EditableChatTitle`)
- [x] RegenerateModal (전용)
- [x] 연쇄 재생성 로직
- [x] memory_summary 채팅 시 갱신 (mock)
- [x] RelatedDocsNotice
- [ ] SSE 스트리밍 (Supabase 후)

### Phase 7 — 비로그인 체험
- [x] 랜딩 생성 + 5종 미리보기
- [x] 인라인 AI 인터뷰
- [x] 로그인 후 guest_result → 프로젝트 저장 → DOC-001
- [ ] guest-generate rate limit (Supabase 후)

### Phase 8 — 마무리
- [x] Settings 플랜 탭, DesktopOnlyBanner, NotFoundPage
- [x] 계정 삭제 UI + `users` DELETE
- [ ] `delete-account` EF (`auth.users` cascade)
- [ ] 전역 에러 처리 (세션 만료, 네트워크)
- [ ] E2E 테스트

---

## 6. 다음 작업 지시 예시

AI에게 이렇게 요청하면 됩니다:

```
「2단계 Mock 갭 진행해줘」        → ✅ 완료
「Supabase 연결해줘」             → ✅ 완료 (Google OAuth·EF는 남음)
「4단계 Edge Function 진행해줘」  → Claude API 키 + EF 배포 후 AI 생성 실연동
「Phase 6 완성해줘」              → 채팅·재생성 mock 갭 메우기
「컴포넌트 분리 리팩터링해줘」     → TECH_SPEC 구조대로 파일 분리
「UI polish 해줘」               → 사용자가 색상/폰트 지정 후 스타일 개선
「Phase E1보내기 구현해줘」   → DOC-001 MD/ZIP/클립보드
「히스토리 패널 구현해줘」       → HistoryPanel + 활동 로그 (E2)
```

사용자가 먼저 해야 할 때:

```
1. Google OAuth 설정했어 → AI가 Redirect URL 확인 + 로그인 E2E 검증
2. Claude API 키 발급했어 → AI가 Edge Function 작성·배포
3. notifications 테이블 추가해줘 → 마이그레이션 + Real API (N4)
```

---

## 7. 문서 체계

| 문서 | 역할 | 언제 보나 |
|------|------|----------|
| [`TECH_SPEC.md`](./TECH_SPEC.md) | **개발 명세서** — 라우팅, 컴포넌트, Store, API, DB, Phase 정의 | 구현·리팩터 시 기준 |
| [`DEV_GUIDE.md`](./DEV_GUIDE.md) | **개발 가이드** — 역할 분담, 진행 순서, Phase 체크리스트 | 작업 지시·협업 시 |
| [`MOCK_GAP_REVIEW.md`](./MOCK_GAP_REVIEW.md) | **갭 검토서** — 명세 vs 코드 차이, 누락·버그·우선순위 | Mock 마무리 / Supabase 전 점검 |
| [`HISTORY_AND_EXPORT_DESIGN.md`](./HISTORY_AND_EXPORT_DESIGN.md) | **히스토리·보내기 설계** — 화면별 L1~L4, Export Phase | E4~E5(Supabase) 전 참조 |
| [`EXPORT_FORMATS_DESIGN.md`](./EXPORT_FORMATS_DESIGN.md) | **보내기 형식 확장** — HTML·JSON·PDF·DOCX·권한·UI | E6~E9 구현 전 참조 |
| [`MEMBER_PERMISSIONS_DESIGN.md`](./MEMBER_PERMISSIONS_DESIGN.md) | **멤버 권한 설계** — 역할 매트릭스, 변경 정책 | 멤버·권한 UI/API 구현 시 |
| [`DOC_LAYOUT_DESIGN.md`](./DOC_LAYOUT_DESIGN.md) | **DOC-001 레이아웃 v2** — 탭 상단·채팅 좌·댓글 우 | 레이아웃 변경 시 |
| [`PROJECT_RENAME_DESIGN.md`](./PROJECT_RENAME_DESIGN.md) | **프로젝트명 수정** | rename UI/API |
| [`MEMBER_COMMENTS_DESIGN.md`](./MEMBER_COMMENTS_DESIGN.md) | **멤버 코멘트** — C1 Real ✅ / C2~C5 | 코멘트 고도화 시 |
| [`PROJECT_TRASH_DESIGN.md`](./PROJECT_TRASH_DESIGN.md) | **휴지통 설계** — soft delete, 복원, 30일 purge | T1 ✅ / T2~T4 참조 |
| [`DASHBOARD_NOTIFICATIONS_DESIGN.md`](./DASHBOARD_NOTIFICATIONS_DESIGN.md) | **대시보드 알림** — 채팅·댓글 인박스, GNB 벨 | N1~N4 구현 전 참조 |
| `PlanOS_기획서_v3.0.docx` | 비즈니스 요구, 플로우, 정책 | 정책·기능 의사결정 |
| `PlanOS_화면설계서_v1.0.docx` | 화면별 컴포넌트, 인터랙션 | UI·인터랙션 참조 |
| `supabase/migrations/001_initial_schema.sql` | DB 스키마 (초기) | ✅ 적용됨 |
| `supabase/migrations/002_fix_project_members_rls.sql` | `project_members` RLS 수정 | ✅ 적용됨 |
| `supabase/migrations/003_generation_runs_rls.sql` | `generation_runs` FOR ALL RLS | ✅ 적용됨 |
| `supabase/migrations/004_add_wireframe_document_type.sql` | `wireframe` document type | ✅ 적용됨 |
| `supabase/migrations/005_project_comments.sql` | 코멘트·리액션·참여자 테이블 | ✅ 적용됨 |
| `scripts/db-push.mjs` | 마이그레이션 CLI (`npm run db:push`) | DB URL·pooler 자동 탐색 |
| `src/config.ts` | `MOCK_USER_ID`, `ENABLE_MOCK_ROUTE_GUARDS` 등 플래그 | 로컬 dev 모드 |
