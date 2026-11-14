# CrewAI 실실행 PoC (2026-11-14)

**기준 main:** `ce67ec4` (PR #81 병합 후)  
**브랜치:** `feat/planos-crewai-real-worker-poc-20261114`  
**운영/호스티드 DB·Production:** 변경 없음 (`034`는 `supabase/local_only/`만)

## P0

PR #81 E2E(PM 계획·AI 검수) 수정 후 main 병합 완료. 본 PoC는 그 위에 독립 진행.

## 설치·라이선스

| 오픈소스 | 버전 목표 | 라이선스 | 상용 |
|---|---|---|---|
| CrewAI | `>=0.119,<1` (`workers/crewai`) | Apache-2.0 | 가능 |
| MetaGPT | 코드 미설치 · 역할/절차 참고 | MIT | 가능 |
| OpenHands | P5 이후 | MIT | 샌드박스만 |
| Liner Router API | Gateway 연동 | 플랫폼 ToS | 크레딧 사용 |

설치 위치: `workers/crewai/` (uv + Python 3.12 격리). 시스템 Python 3.14는 CrewAI 미지원.

## PlanOS 연결

```
enqueue_ai_run (mig 030, 유지)
  → [Mock] process_mock_ai_run
  → [Real] claim_crewai_ai_run → CrewAI/Liner → complete_crewai_ai_run (034 local_only)
  → publish_ai_artifact_from_run / decide (031)
```

| 파일 | 역할 |
|---|---|
| `workers/crewai/src/planos_crewai/roles.py` | 직무 Agent Definition + MetaGPT 경로 참조 |
| `workers/crewai/src/planos_crewai/crews/requirements_auditor.py` | AI PM → 기획 검수 Crew |
| `workers/crewai/src/planos_crewai/supabase_adapter.py` | 루프백 REST 어댑터 |
| `workers/crewai/src/planos_crewai/llm.py` | Liner/OpenAI 어댑터 |
| `supabase/local_only/034_crewai_worker_rpcs.sql` | claim/complete RPC |
| `src/lib/api/aiRuns.ts` | `enqueueForCrewAiWorker` (mock 분리) |
| `src/server/ai/linerGateway.ts` | TS Liner Gateway |
| `src/pages/SpecialistRequestMockPage.tsx` | CrewAI 큐 CTA |

## MetaGPT 반영 표

| PlanOS slug | MetaGPT 참고 | PlanOS 파일 |
|---|---|---|
| `ai_pm_v1` | `roles/project_manager.py` | `roles.py` + auditor crew PM agent |
| `service_planner_v1` | `roles/product_manager.py` | `roles.py` (정의) |
| `requirements_auditor_v1` | `roles/qa_engineer.py` | `roles.py` + **실행 crew** |
| `ux_ui_auditor_v1` | QA 확장 | `roles.py` (정의) |
| `developer_v1` | `roles/engineer.py` | `roles.py` (OpenHands 대기) |
| `qa_engineer_v1` | `roles/qa_engineer.py` | `roles.py` (정의) |

## Liner 키 안내 (사용자 설정)

1. [Liner Platform](https://liner.com/ko/developers/docs/router-api)에서 API 키 발급  
2. 워커 전용: `workers/crewai/.env` 에  
   - `LINER_API_KEY=...`  
   - `PLANOS_LINER_MODEL=liner-gemini-router` (또는 `liner-gpt-router`)  
3. (선택) Node BFF 동일 키: 셸/` .env` 의 `LINER_API_KEY` (절대 `VITE_` 금지)  
4. 잔액·프로모션은 Liner 콘솔에서 확인. PoC 한도: `PLANOS_CREWAI_MAX_CALLS_PER_RUN=8`

키 없이는 dry-run만 가능 → **실 LLM 응답 없으면 P4 완료 아님**.

## 로컬 검증

```powershell
cd workers/crewai
uv sync
uv run planos-crewai-worker smoke-llm
uv run planos-crewai-worker audit-local
# disposable Supabase + 034 적용 후:
uv run planos-crewai-worker poll
```

## 아직 남은 것

- P4: 키 투입 후 실 LLM E2E (승인·보고서·재접속)
- P5: OpenHands 개발자 직원 (첫 E2E 성공 후)
- `ai_usage_ledger` provider 행: 호스티드 마이그레이션 승인 전 result_json.usage에만 기록
