# AI Generation HTTP 런타임 계약 (2026-10-24)

**상태:** Preview/dev 코드 계약. Production 배포·유료 LLM·운영 DB 변경 승인 없음.

## 두 런타임 (혼동 금지)

| 런타임 | 진입점 | 언제 |
|---|---|---|
| **Vite 개발** | `src/server/ai/viteAiBffPlugin.ts` → `handleGenerateHttp(..., { runtime: 'vite-dev' })` | `npm run dev` 만 |
| **Vercel Preview** | `api/ai/generate.ts` → `handleGenerateHttp(..., { runtime: 'vercel-preview' })` | Preview 배포 |

공통 경로: `POST /api/ai/generate`  
공통 구현: `src/server/ai/generationHttp.ts` → `generationBff.ts`  
헤더: `X-PlanOS-AI-Runtime: vite-dev | vercel-preview`

## 강제 규칙

- 클라이언트 `allowPaidCalls` 무시 — 서버가 항상 `false`
- 응답 `mode` 는 승인 전 `placeholder` 만
- Vite 미들웨어를 Production BFF로 표기·배포하지 않음
- `vercel.json` 은 `/api/*` 를 SPA `index.html` 로 삼키지 않음
- 유료 활성화 절차: [`PAID_LLM_ENABLE_RUNBOOK_2026-10-25.md`](../plans/PAID_LLM_ENABLE_RUNBOOK_2026-10-25.md) (Gate C-LLM)

## ReviewJob 영속

| 계층 | 상태 |
|---|---|
| 브라우저 `BROWSER_LOCAL_V1` | 코드 완료 (재접속·CAS·finding→task 멱등) |
| `supabase/drafts/027_ai_review_jobs_DRAFT.sql` | DRAFT — **운영/Preview 적용 금지** (별도 승인) |
| Preview 027 | Gate A-027 런북 — **개발 막바지 적용 가능** ([`PREVIEW_027_APPLY_RUNBOOK_2026-10-25.md`](../plans/PREVIEW_027_APPLY_RUNBOOK_2026-10-25.md)) |
