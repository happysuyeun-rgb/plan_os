# 서아 할 일 체크리스트

> 최종 갱신: 2026.06.12  
> AI 진행 상황은 [`DEV_GUIDE.md`](./DEV_GUIDE.md) §3 참고

---

## ✅ 이미 완료 (확인만)

| # | 작업 | 비고 |
|---|------|------|
| 1 | Supabase 프로젝트 생성 | Dashboard 접속 가능 |
| 2 | `.env.local` 설정 | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_DB_URL` |
| 3 | DB 마이그레이션 `001`~`008` | `npm run db:push` — 멤버 RLS·알림·`chat_title` 포함 |
| 4 | 로컬 dev 로그인 | `npm run dev:user` 후 LoginPage 이메일/비밀번호 |

---

## 🔴 다음 (로그인·AI 연결 전)

### Google OAuth

1. [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication → Providers → Google** 활성화
2. Google Cloud Console에서 OAuth 클라이언트 ID/Secret 발급
3. **Redirect URLs** 등록:
   - `http://localhost:5173/auth/callback`
   - (배포 후) `https://<도메인>/auth/callback`
4. 브라우저에서 **Google 로그인** E2E 확인

### Claude API + Edge Function

1. Anthropic API 키 발급
2. Supabase **Edge Function Secrets**에 `ANTHROPIC_API_KEY` 등록
3. 터미널에서 `supabase functions deploy` (AI가 작성한 함수 배포)
4. 생성·채팅이 placeholder가 아닌 실제 응답인지 확인

### ~~DB 마이그레이션 `006`~`008`~~ ✅

- `006_member_project_access_rls.sql` — 멤버(editor/viewer) DB 접근
- `007_user_notifications.sql` — 알림 테이블
- `008_project_chat_title.sql` — `projects.chat_title` (채팅 패널 제목)
- `npm run db:push` 적용 완료

---

## 🟡 출시 전

| 작업 | 설명 |
|------|------|
| **Vercel 배포** | 프로덕션 env (`VITE_SUPABASE_*`), 도메인 연결 |
| **E2E 수동 테스트** | 로그인 → 프로젝트 생성 → 편집 → 댓글 → 알림 → 휴지통 |
| **디자인 확정** | 색상·폰트·간격 (UI polish 전) |
| **법적 문서** | 이용약관·개인정보처리방침 실제 URL |
| **플랜 한도 확인** | Free 3프로젝트 / 10회 생성 등 수치 최종 승인 |

---

## 🟢 MVP 이후 (V2)

| 작업 | 설명 |
|------|------|
| 결제 연동 | Stripe/토스 Pro 업그레이드 |
| AI 프롬프트 품질 검수 | 샘플 산출물 피드백 |
| 에러 문구 톤 검수 | 토스트·모달 한국어 |

---

## 협업 요약

| 구분 | 서아 | AI(에이전트) |
|------|------|-------------|
| OAuth·API 키·배포 | ✅ 설정·배포 | 코드·EF 작성·검증 안내 |
| DB | `db:push` 실행 | 마이그레이션 SQL 작성 |
| 기능 구현 | E2E 테스트·피드백 | React·API·RLS·문서 |
| 기획 결정 | 가격·톤·템플릿 | 명세 반영 구현 |

---

## 빠른 로컬 검증 명령

```bash
npm run dev          # http://localhost:5173 (포트 충돌 시 기존 node 종료)
npm run dev:user     # 테스트 유저 생성/확인
npm run db:push      # 마이그레이션 적용
npm run build        # 타입·빌드 검증
```
