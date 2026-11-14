# AI 시장조사·리서치 직원 (Liner Platform) — 2026-11-14

## Slice

| ID | Value |
|---|---|
| Staff | `ai_market_researcher_v1` |
| Engine | Liner Search Agent (`stream:false`) + Web Search (`include_knowledge:false`) |
| Optional | Deep Research (user opt-in only) |
| DB | `supabase/local_only/035_*` (disposable only) |
| Keep | `requirements_auditor_v1` + Mock path unchanged |

## Success evidence (this branch)

1. `planos-crewai-worker research-local` — live Search Agent + Web Search → structured report + sources (**PASS**)
2. `tests/e2e/market_research_queue_live_e2e.mjs` — contract → enqueue → poll → `market_research_report_v1` (**PASS**, ~93 sources, ~$0.05 est.)
3. UI route `/projects/:id/specialists/market-research` + catalog hireable after live verify

## Forbidden

- Ops/Production DB apply of 035
- Mock-only card without live Liner path
- Auto Deep Research / scheduled repeat research
- External post / email / arbitrary file edits

## Next

Browser UI approve → enqueue → publish → accept E2E (`tests/e2e/browser_market_research_live_flow.mjs`) when Vite preview is up.
