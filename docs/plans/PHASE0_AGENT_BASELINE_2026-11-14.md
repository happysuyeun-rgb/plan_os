# Phase 0 — AI 직원 실실행 기준선 (2026-11-14)

**기준 main SHA:** `671f6fd88287d34a28dfded6e22aa57b759f5c10` (PR #80 병합)  
**작업 브랜치:** `chore/planos-phase0-ci-agent-baseline-20261114`  
**목적:** 회귀·CI·현황 정합. 실모델 실행·운영 DB 적용·main 병합은 이 문서만으로 승인되지 않음.

## 1. PR #80 후속

| 항목 | 상태 |
|---|---|
| 프로필 아바타 업로드·랜딩·이용 가이드·멤버 아바타 | main에 포함 |
| `033_avatars_storage.sql` | **코드만** 병합. **운영/호스티드 DB 미적용** (승인 전 금지) |
| PM plan disposable E2E 실패 | Playwright 1.58.2 + `ubuntu-latest`→Ubuntu 26.04 에서 Chromium 미지원 |
| CI 조치 | 전 workflow `runs-on: ubuntu-24.04` 고정 |

## 2. 기존 AI 직원 — Mock vs 실실행

| 영역 | 상태 | 근거 |
|---|---|---|
| 카탈로그 `requirements_auditor_v1` | **채용 가능(UI)** · 실행은 Mock | `mockSpecialistRequest.ts`, `aiStaffCatalog.ts` |
| FUTURE PM/UX/정책/마케터/영업 | 표시만 · 채용 불가 | `available: false` |
| 계약 F-A (`agentContracts`) | DB RPC · Mock 약관 · `paidLlmAllowed` 차단 | mig 029 |
| 실행 큐 F-B (`aiRuns`) | `enqueue_ai_run` + **`process_mock_ai_run`** | mig 030 · 유료 LLM 없음 |
| 산출물 F-C (`aiArtifacts`) | 수락→S1 연결 Mock | mig 031 |
| Gemini / generation BFF | 문서 생성 경로 · 유료 기본 차단 | `GeminiProvider`, `generationBff` |
| 브라우저 닫아도 큐 보존 | DB 영속 설계는 있음 · **실모델 워커 없음** | ADR-002 TARGET vs Mock worker |

**금지:** Mock `process_mock_ai_run` 성공을 “실제 AI 실행 성공”으로 UI/문서에 표시하지 않는다.

## 3. Phase 2 첫 실실행 통합 지점 (신규 역할 금지)

1. 기존 프로젝트 선택  
2. `requirements_auditor_v1` 선택 (`SpecialistRequestMockPage` / 카탈로그)  
3. 문서 2+ · digest/manifest (028)  
4. 계약 수락 (029)  
5. `enqueue_ai_run` (030)  
6. **신규:** Mock worker 대신 승인된 ModelGateway 실호출 워커 (미구현)  
7. 스키마·출처 검증 후 artifact (031)  
8. 사용자 승인·반려  

재사용 우선: `agentContracts.ts`, `aiRuns.ts`, `aiArtifacts.ts`, Specialist 요청 UI, mig 028–031.

## 4. 오픈소스 평가 → 실도입 (2026-11-14 지시 변경)

| 도구 | 라이선스(공개 기준) | 결정 |
|---|---|---|
| CrewAI | Apache-2.0 | **실설치** `workers/crewai/` 격리 워커 · mock과 분리 |
| MetaGPT | MIT | 역할/절차 → `roles.py` Agent Definition + auditor crew |
| Liner Router API | 플랫폼 | `linerGateway.ts` + 워커 `llm.py` · 키=`LINER_API_KEY` |
| OpenHands | MIT | **첫 실 LLM E2E 성공 후** P5 |
| Agency Swarm / FreeLLMAPI | — | 필수 의존 금지 |

상세: [CREWAI_REAL_WORKER_POC_2026-11-14.md](./CREWAI_REAL_WORKER_POC_2026-11-14.md). Mock `process_mock_ai_run`은 유지.

## 5. DB

| 마이그레이션 | 용도 | 호스티드 |
|---|---|---|
| 028 | audit manifest 실행 게이트 | 코드 기준 · 호스티드 별도 확인 |
| 029 | agent contracts MVP | 동일 |
| 030 | ai_runs mock worker | 동일 |
| 031 | artifacts → S1 | 동일 |
| 032 | pm_plan ai_suggested | 동일 |
| 033 | avatars storage | **운영 미적용** |

격리 DB에서 033 포함 회귀는 disposable Supabase CI로 검증. 운영 apply는 별도 승인.

## 6. 다음 PR 순서

- **PR-A (본 브랜치):** CI ubuntu-24.04 · Phase 0 문서 · 현황 정합  
- **PR-B:** Agent Definition / Skill Registry (`requirements_auditor_v1`부터)  
- **PR-C:** 기획 검수 실실행 경로 (승인된 모델 키 없으면 Mock 경로 유지·실호출 차단)  
- **PR-D:** PM 위임·중간 투입 확장  

main 병합은 각 PR 검증 보고 후 승인.
