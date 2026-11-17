# PlanOS — 직무 AI 오픈소스·무료 연결 대장 (2026-11-17)

> **목적:** Cursor 지시문(직무별 AI 에이전트 OSS 통합)에서 **연결하기로 검토한 목록**과 **지금 실제 연결 상태**·**나중에 붙일 것**·**무과금 도입 원칙**을 한곳에 둔다.  
> **기준 코드:** `main` @ `c7d7ab1` (지시문 기준선 `671f6fd`=#80 이후 #81~#83 CrewAI/Liner/시장조사 포함).  
> **환경:** 로컬 Vite + Preview DB `fydngfylpzdwvjyuqhdm` + `planos-preview`. **ops DB·Gate C 유료 LLM 미연결.**  
> **주의:** “무료/프리티어 API” ≠ “오픈소스 라이브러리”. 둘을 섞어 쓰지 않는다.

---

## 1. 지시문 후보 전체 매트릭스 (연결된 것 / 미연결 / 나중에)

지시문 §3 후보 + Phase 0/CrewAI PoC 결정을 기준으로 한다. **모든 프레임워크를 동시에 설치하지 않는다.**

| 후보 | 라이선스(공개 기준) | 지시문에서의 역할 | **현재 상태** | **나중에?** | 무과금 관점 |
|------|---------------------|-------------------|---------------|-------------|-------------|
| **CrewAI** | Apache-2.0 | 1순위 PoC · 직무 협업 워커 | ✅ **연결됨** `workers/crewai/` · Preview 큐 poll | 유지·직무 확장 | 라이브러리 무료. 호출 모델은 Liner/Gemini 크레딧 |
| **MetaGPT** | MIT | 역할/절차 참고 (코드 미설치) | ✅ **참고만** `roles.py` Agent Definition | 패키지 설치는 **하지 않음** (의도) | 비용 0 · 중복 엔진 회피 |
| **Liner Router/Search** | 플랫폼 ToS (OSS 아님) | 워커 LLM·시장조사 | ✅ **연결됨** (크레딧 키) | 유지 | **유료 전환 금지** · 크레딧 소진 시 dry-run/차단 |
| **Google Gemini** | API (OSS 아님) | 문서 BFF·PM 초안 | ✅ **연결됨** AI Studio 키 | 유지 | Gate C paid 경로와 분리 · 무료 쿼터만 |
| **Agency Swarm** | 검토 대상 | 위임·조직형 협업 참고 | ❌ **미연결** · Phase 0: **필수 의존 금지** | 필요할 때만 패턴 참고 (설치 비권장) | 추가 엔진=복잡도↑ · 기본 제외 |
| **OpenHands** | MIT | 개발자 코드 실행 | ❌ **미연결** · **P5/Phase 4 후순위** | ✅ 나중에 (샌드박스 전제) | 샌드박스·명시 승인 전 GitHub 쓰기 금지 |
| **OpenClaw** | 검토 대상 | 도구/외부 작업 | ❌ **미연결** · Phase 4 | ✅ 나중에 (권한 최소) | **로컬/서버/배포 무제한 권한 금지** |
| **Microsoft Agent Framework** | 검토 대상 | 승인·체크포인트 대안 | ❌ **미연결** | △ ADR-002로 충분하면 **스킵** | 중복 오케스트레이션 회피 |
| **FreeLLMAPI** | 실험용 | 로컬 무료 라우터 | ❌ **미연결** · 운영 필수 금지 | △ 로컬 실험만 (Gate) | 프로덕션 공급자 채택 금지 |
| **PlanOS TS 오케스트레이션** | 자체 | 계약·큐·산출물 | ✅ **본체** `agentContracts` / `aiRuns` / `aiArtifacts` | 유지 (모든 OSS의 상위) | 과금 없음 |

### 앱·인프라 OSS (지시문 후보 밖이지만 실연결)

| 구성 | 상태 |
|------|------|
| React / Vite / TS / Tailwind / Zustand / RRD / marked / lucide | ✅ |
| `@supabase/supabase-js` + Preview 호스티드 PG/Auth | ✅ (SDK OSS · 호스팅은 프로젝트 쿼터) |
| Supabase CLI disposable Docker | 가능 · 현재 앱은 Preview URL |
| Vercel `planos-preview` | ✅ 호스팅 (상용) |

---

## 2. “많이 빠진 것처럼 보이는” 이유 (요약)

1. **지시문이 ‘전부 설치’가 아니라 ‘평가 후 선택’** — CrewAI 1순위, MetaGPT는 미설치 참고, Agency/FreeLLMAPI는 필수 금지, OpenHands/OpenClaw는 Phase 4.  
2. **이미 연결된 것:** CrewAI + Liner + Gemini + PlanOS 큐/계약.  
3. **직무 UI 5종 FUTURE**는 OSS 미설치가 아니라 **역할 실경로 미구현**.  
4. **Mock 레인 병행** (`process_mock_ai_run`, Mock 검수) 때문에 “전부 실 OSS 실행”처럼 안 보임.  
5. **무과금 원칙** 때문에 유료 ModelGateway·ops·무제한 도구 권한을 열지 않음.

---

## 3. 무과금(과금되지 않는) 구현·도입 원칙

개발·Preview에서 OSS/모델을 더 붙일 때 **반드시** 지킨다.

| # | 원칙 |
|---|------|
| G1 | **Gate C-LLM / `PLANOS_AI_ALLOW_PAID` / `PLANOS_LLM_API_KEY` 사용 금지** (별도 승인 전). |
| G2 | LLM은 **이미 확보한 무료·크레딧 경로만**: Gemini AI Studio, Liner 크레딧. 새 유료 벤더 기본값 추가 금지. |
| G3 | 크레딧 소진·429 시 **자동 유료 fallback 금지**. `DRY_RUN`/실패/재시도만. |
| G4 | OSS 엔진 추가 시 **Python 워커 격리** (`workers/*`). 프론트·VITE에 시크릿 금지. |
| G5 | OpenHands/OpenClaw는 **샌드박스 + 명시 승인** 전: git push, 배포, 외부 발송, 임의 파일 쓰기 금지. |
| G6 | FreeLLMAPI는 **로컬 전용 실험**; Preview/ops 필수 의존 금지; ModelGateway 어댑터로만. |
| G7 | ops DB (`ggvius…`)·Production 결제·실과금 SMTP 미사용. |
| G8 | 새 의존성 도입 PR에 **라이선스 + 예상 비용(무료/크레딧/유료) 한 줄** 필수. |

효율적 연결 순서(진행 상황 보며 도입):

```text
지금 유지: PlanOS 큐 + CrewAI + (Gemini|Liner 크레딧)
    → PR-B Skill Registry (추가 OSS 없이)
    → 직무 확장 = CrewAI crew 추가 (새 프레임워크 X)
    → (선택) FreeLLMAPI 로컬 어댑터 실험
    → Phase 4: OpenHands → OpenClaw (샌드박스·승인)
    → Agency / MS Agent Framework: ADR로 부족할 때만 재평가
```

**효율 판단:** 지금은 **CrewAI 한 줄기를 깊게** 가는 편이 Agency/MS AF/OpenClaw를 동시에 넣는 것보다 맞다. MetaGPT 패키지 설치는 이득 대비 중복이 큼.

---

## 4. 직무 × 엔진 맵 (지시문 §4 대비)

| AI 직원 (지시) | 카탈로그 ID | 실행 엔진(현재) | 나중 후보(무과금) |
|----------------|-------------|-----------------|-------------------|
| 기획 검수 | `requirements_auditor_v1` | CrewAI + Liner | Gemini 폴백 검토(크레딧) |
| 시장조사 | `ai_market_researcher_v1` | CrewAI + Liner Search/Web | — |
| AI PM | `ai_pm_planner_v1` | UI 준비 중 · PM 초안은 Gemini | CrewAI PM crew (Slice 5) |
| 서비스 기획 | (정의/문서 생성) | Gemini 문서 파이프라인 | MetaGPT 절차 참고만 |
| UX/UI | `ux_flow_reviewer_v1` | 준비 중 | CrewAI skill → 이후 OpenClaw 제한 도구 |
| 프론트 개발 | (developer 계열) | 미연결 | **OpenHands** (Phase 4) |
| QA | auditor에 근접 | CrewAI auditor | 확장 crew |
| 마케터/영업 FUTURE | `#38` `#37` | 표시만 | 후순위 · 발송 자동화 금지 |

---

## 5. 현재 런타임 연결 상세 (실물)

| 계층 | 연결 |
|------|------|
| UI→계약→큐 | `agentContracts` · `enqueueForCrewAiWorker` · Preview DB |
| 워커 | `uv run planos-crewai-worker poll` · `PLANOS_CREWAI_ALLOW_PREVIEW=1` |
| 문서/초안 | `GEMINI_API_KEY` → BFF / `api/ai/generate.ts` |
| Mock | `process_mock_ai_run` = E2E fixture만 · 실성공으로 표시 금지 |

키 위치(값 금지): `.env.local` (Gemini·Supabase), Vercel Secret (Gemini), `workers/crewai/.env` (Liner·service role).

---

## 6. 구현 계획에 넣을 OSS 체크리스트 (착수 Slice와 정합)

미완료 착수 계획과 맞춰 **과금 없이** 진행할 때:

| Slice | OSS/엔진 | 무과금 조건 |
|-------|----------|-------------|
| 1 E2E 정합 | 기존 CrewAI/Mock fixture | 추가 API 비용 0 |
| 2 검수 027 서버 | PlanOS DB only | Gemini findings는 크레딧만 |
| 3 F-105 DB | PlanOS only | — |
| 4 초대 메일 | (OSS 아님) | 유료 SMTP면 **보류** 또는 무료 티어만 |
| 5 AI PM 실경로 | **CrewAI 확장** (새 프레임워크 X) | Liner/Gemini 크레딧 캡 |
| 6 N29/F-801 | PlanOS first | OpenClaw 끼워 넣지 않음 |
| Phase 4 | OpenHands → OpenClaw | 샌드박스 + 승인 + 과금 0 경로만 |

---

## 7. 문서·코드 갱신 시

1. 후보를 설치/연결하면 이 표의 **현재 상태** 열을 같은 PR에서 고친다.  
2. “연결 예정”을 “연결됨”으로 올리려면: 라이선스 · 무과금 경로 · Mock과 구분 라벨 · 테스트 PASS가 필요.  
3. 관련: [UNIMPLEMENTED_KICKOFF_PLAN](../plans/UNIMPLEMENTED_KICKOFF_PLAN_2026-11-17.md) · [PHASE0_AGENT_BASELINE](../plans/PHASE0_AGENT_BASELINE_2026-11-14.md) · [CREWAI_REAL_WORKER_POC](../plans/CREWAI_REAL_WORKER_POC_2026-11-14.md) · [REMAINING_DEV_CHECKLIST](../plans/REMAINING_DEV_CHECKLIST_2026-10-25.md) · [IMPLEMENTATION_PLAN FreeLLMAPI](../roadmap/IMPLEMENTATION_PLAN.md)

---

## 8. 한줄 결론

지시문의 OSS 목록 중 **지금 실연결은 CrewAI(+ Liner/Gemini 크레딧)와 PlanOS 자체 큐**이고, MetaGPT는 참고만, Agency/FreeLLMAPI는 제외·실험, OpenHands/OpenClaw는 **나중에·샌드박스·무과금**으로 남긴다. 진행 상황을 보며 붙일 때도 **새 유료 벤더·Gate C·무제한 도구 권한 없이** CrewAI 줄기를 먼저 확장하는 것이 효율적이다.
