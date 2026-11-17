# Slice 1 — E2E / CTA 정렬 매트릭스 (2026-11-17)

기준: `feat/unimplemented-kickoff-slice1-e2e-20261117` · 부모 계획 [UNIMPLEMENTED_KICKOFF_PLAN](./UNIMPLEMENTED_KICKOFF_PLAN_2026-11-17.md)

## CTA 규칙

| 표면 | Preview / 일반 local DEV | Disposable CI (`local_browser_env`) | S3 fixture (`VITE_S3_E2E_FIXTURE`) |
|------|--------------------------|-------------------------------------|-------------------------------------|
| CrewAI enqueue | **기본 CTA** | 있음 | 있음 |
| Mock worker run | **숨김** | `VITE_ALLOW_MOCK_AI_RUN=true`로 표시 | 표시 (fixtureMode) |
| PM AI 제안 | Gemini BFF → 템플릿 폴백 | 동일 | 동일 |
| N29 / F-801 | 「준비 중」 placeholder | 동일 | 동일 |

`VITE_S3_E2E_FIXTURE`는 서버 계약 hydrate를 건너뛰므로 F-B/F-C에 쓰지 않는다.

## E2E 스크립트

| 스크립트 | 기대 CTA | 환경 | 비고 |
|----------|----------|------|------|
| `browser_crewai_live_flow.mjs` | `crewai-worker-enqueue` | local + worker | **실경로 기준** |
| `browser_market_research_live_flow.mjs` | CrewAI + Liner | local + worker | 실경로 |
| `browser_ai_run_mock.mjs` (F-B) | `mock-worker-run` | disposable + ALLOW_MOCK | process_mock 회귀 |
| `browser_ai_artifact_accept.mjs` (F-C) | `mock-worker-run` | disposable + ALLOW_MOCK | process_mock → artifact |
| `s3-browser-e2e.mjs` | fixture 카탈로그 | `VITE_S3_E2E_FIXTURE` | localDev IDs |
| `mock-integrated-journey-e2e.mjs` | 모드별 | disposable 또는 fixture | handoff ≠ server job |

## 정적 계약 테스트 (Slice 1에서 맞춤)

- `tests/crewai-worker-contract.test.mjs`
- `tests/ai-suggested-pm-plan-draft.test.mjs`
- `tests/ai-staff-catalog-mock.test.mjs`
- `tests/n29-pm-ops-room-mock.test.mjs`
- `tests/f801-interview-reputation-mock.test.mjs`
- `tests/s3-specialist-access-contract.test.mjs`

Chromium live F-B/F-C/CrewAI는 disposable/worker 스택이 있을 때 실행. 없으면 NOT RUN으로 보고.
