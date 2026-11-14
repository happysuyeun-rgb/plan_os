# PlanOS CrewAI Worker (isolated)

Apache-2.0 CrewAI runs in this directory only. It does **not** replace
`process_mock_ai_run` (SQL Mock). Real runs:

1. Owner accepts F-A contract in the app  
2. UI **CrewAI 실실행 큐에 넣기** → `enqueue_ai_run` (status=`queued`)  
3. This worker `claim_crewai_ai_run` → CrewAI/Liner → `complete_crewai_ai_run`  
4. Existing F-C `publish_ai_artifact_from_run` / decide (TS)

## Requirements

- Python **>=3.11,<3.14** (CrewAI does not support 3.14 yet)
- [`uv`](https://github.com/astral-sh/uv)
- Disposable local Supabase (loopback). **No hosted/ops DB.**
- Apply `supabase/local_only/034_crewai_worker_rpcs.sql` via
  `node scripts/apply-034-crewai-local-only.mjs`
- For market research also apply `035_market_researcher_agent.sql` via
  `node scripts/apply-035-market-researcher-local-only.mjs`

## Install

```powershell
cd workers/crewai
$env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
uv python install 3.12
uv sync
```

## Secrets

| Variable | Where | Purpose |
|---|---|---|
| `LINER_API_KEY` | `workers/crewai/.env` or shell | Liner Router API key ([docs](https://liner.com/ko/developers/docs/router-api)) |
| `PLANOS_LINER_MODEL` | same | default `liner-gemini-router` |
| `SUPABASE_SERVICE_ROLE_KEY` | same | local disposable service role only |
| `PLANOS_LOCAL_API_URL` | same | default `http://127.0.0.1:54321` |
| `GEMINI_API_KEY` | Vite/server (existing) | **document generation BFF only** — unchanged |

Never put Liner keys in `VITE_*` or commit `.env`.

## Commands

```powershell
uv run planos-crewai-worker roles
uv run planos-crewai-worker smoke-llm
uv run planos-crewai-worker audit-local
uv run planos-crewai-worker research-local --target "반려동물 예약 경쟁시장" --region KR
uv run planos-crewai-worker poll --limit 3
```

Without `LINER_API_KEY`, commands run in **dry-run** (no live LLM; report marks `dryRun: true`).

## Roles (MetaGPT-mapped)

See `src/planos_crewai/roles.py`. Executable crews:

- `requirements_auditor_v1` — CrewAI + Liner Router
- `ai_market_researcher_v1` — Liner Search Agent + Web Search (+ optional Deep Research)

## License note

| Package | License | Commercial |
|---|---|---|
| CrewAI | Apache-2.0 | Yes (Apache terms) |
| MetaGPT (reference only) | MIT | Yes |
| OpenHands (later) | MIT | Yes — sandbox only after first E2E |

## Ops

Hosted DB / Production: **do not apply 034**. PoC is local/disposable only until approved.
