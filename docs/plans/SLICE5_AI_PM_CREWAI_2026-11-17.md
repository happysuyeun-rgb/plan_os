# Slice 5 — AI PM CrewAI 실경로 (승인≠실행) · 2026-11-17

부모: [UNIMPLEMENTED_KICKOFF_PLAN](./UNIMPLEMENTED_KICKOFF_PLAN_2026-11-17.md) · Issue #32 F-401→F-402→S1

## 상태 머신 분리

| 상태 | 의미 |
|------|------|
| `plan.approved` | 사람 승인 기록만 |
| 계약 draft/active | owner 동의 |
| `ai_runs` queued | CrewAI enqueue 명시 CTA |
| consent / billing | Gate C 유료 경로 없음 (`paidLlmAllowed=false` on AI PM scope) |

## 코드

| 산출물 | 역할 |
|--------|------|
| `supabase/local_only/037_ai_pm_contract.sql` | `create_ai_pm_contract_draft` · slug `ai_pm_v1` |
| `createAiPmContractDraft` | 클라이언트 RPC 래퍼 |
| PM 상세 `pm-plan-crewai-followup` | 승인 후 Specialist/CrewAI 이어가기 (자동 enqueue 없음) |
| Specialist `?fromPlan=` | 승인 계획으로 task 프리필 |

MetaGPT/Agency/OpenHands 설치 없음. Worker 역할 정의는 기존 `roles.py` `ai_pm_v1`.

## Apply

037 Preview apply = **별도 승인**. 지금은 CTA+프리필+SQL 동결.

## 테스트

- `tests/slice5-ai-pm-crewai-contract.test.mjs`
- Chromium enqueue = disposable+037+worker 있을 때 (NOT RUN 기본)
