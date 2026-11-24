# PlanOS 3.0 × AI 인력사무소

> **EXE-THON 제출용 실행 안내 · 2026-11-24 기준**
>
> 혼자 시작해도, 혼자 일할 필요는 없으니까. PlanOS는 프로젝트·기획문서·업무를 한 공간에서 관리하고, 승인된 범위의 업무를 AI 전문 직원에게 위임하는 워크스페이스입니다.
>
> **현재는 개발·검증 단계입니다.** 아래에서 실제 Liner API 호출로 확인한 기능과 Preview에서 아직 완료하지 않은 기능을 구분합니다.

## 심사위원용 빠른 안내

| 항목 | 내용 |
|---|---|
| 핵심 데모 | **AI 시장조사 직원**: Liner 기반 경쟁사·가격·고객 문제 조사 → 출처 포함 보고서 |
| 가장 빠른 재현 | `workers/crewai`의 **`research-local` 명령**. Supabase 없이 Liner 심사용 키만으로 실행 |
| 웹 미리보기 | [PlanOS Preview](https://planos-preview.vercel.app/) — UI 확인용. 실시간 워커 실행은 별도 설정 필요 |
| Liner API 키 | 심사위원이 발급·제공한 키를 로컬 `workers/crewai/.env`의 `LINER_API_KEY`에 설정 |
| 소스코드 범위 | React/Vite 프런트엔드 + Supabase 데이터·권한 + 격리된 Python/CrewAI 워커 |
| 확인된 상태 | Liner 시장조사 **로컬 실호출·격리 E2E 검증**, Preview 큐 등록 검증; 호스티드 워커 완료/정식 출시는 미확인 |

**Liner 실호출을 확인하려면 먼저 아래의 ‘1. Liner API 실제 실행’부터 진행하세요.** 웹 화면만 열거나 Mock을 실행한 것은 실호출 검증이 아닙니다.

## 1. Liner API 실제 실행 — Supabase 불필요

이 경로는 **AI 시장조사 에이전트의 실제 Liner API 호출과 조사 보고서 생성을 재현**합니다. 프로젝트 DB, 계정 가입, Vercel 배포가 필요하지 않습니다.

**준비물:** Git, Python **3.11~3.13**(권장 3.12), [uv](https://docs.astral.sh/uv/), Liner Platform API 키. Python/CrewAI 의존성은 `workers/crewai/pyproject.toml`과 `uv.lock` 기준으로 설치됩니다.

### 1-1. 코드 내려받기 및 의존성 설치

~~~bash
git clone https://github.com/happysuyeun-rgb/plan_os.git
cd plan_os/workers/crewai

uv python install 3.12
uv sync
~~~

Windows PowerShell에서도 같은 명령을 사용합니다. `uv` 명령이 인식되지 않으면 [공식 설치 안내](https://docs.astral.sh/uv/getting-started/installation/)에 따라 설치한 후 새 터미널을 열어 주세요.

### 1-2. 심사용 키 설정

`workers/crewai/.env.example`을 **`workers/crewai/.env`**로 복사합니다. macOS/Linux에서는 `cp .env.example .env`, Windows PowerShell에서는 `Copy-Item .env.example .env`을 사용합니다.

복사한 `.env` 파일에서 **아래 항목만 실제 심사용 키로 설정**합니다.

~~~dotenv
LINER_API_KEY=심사위원이_제공한_실제_Liner_API_키
PLANOS_CREWAI_PROVIDER=liner
PLANOS_CREWAI_DRY_RUN=false
~~~

- 실제 키를 **README, Git 커밋, 스크린샷, 데모 영상, 채팅 메시지**에 입력하거나 노출하지 마세요.
- `.env`는 Git 추적에서 제외됩니다. `VITE_` 접두사가 붙은 변수에 Liner·Gemini·Supabase 서비스 역할 키를 넣지 마세요.
- `PLANOS_LOCAL_API_URL`과 `SUPABASE_SERVICE_ROLE_KEY`는 **이 로컬 조사 명령에는 필요 없습니다**. 환경설정 파일의 기본값/빈칸을 그대로 두어도 됩니다.
- 키가 없거나 `PLANOS_CREWAI_DRY_RUN=true`이면 실호출 없이 **dry-run**으로 끝납니다.

### 1-3. 실제 시장조사 실행

~~~bash
uv run planos-crewai-worker research-local --target "국내 반려동물 예약 서비스 경쟁시장 조사" --region KR --depth standard
~~~

실행하면 Liner 응답을 바탕으로 JSON 형태의 조사 결과가 콘솔에 출력됩니다.

**실호출 여부 확인:** 결과의 `usage.dryRun`이 `false`이고, `report.kind`가 `market_research_report_v1`이며, `report.sources` 또는 `report.rawLinerAnswer`에 실제 조사 정보가 있는지 확인합니다. `report.dryRun: true` 또는 `LINER_DRY_RUN` 표시가 나타나면 실제 실행이 아닙니다. 출처 URL은 형식 검증을 거친 값이므로 중요 내용은 원문과 교차 확인해야 합니다.

**선택 테스트 — Router 연결 확인(별도 API 호출):**

~~~bash
uv run planos-crewai-worker smoke-llm
~~~

**선택 테스트 — 요구사항 검수 에이전트:**

~~~bash
uv run planos-crewai-worker audit-local
~~~

`research-local`은 Liner 시장조사 경로이고, `smoke-llm` 및 `audit-local`은 Liner Router/CrewAI 검증 경로입니다. 모두 실제 키가 있으면 API 사용량이 발생할 수 있습니다. **심층조사**(`--depth deep`)는 사용자가 명시적으로 선택할 때만 이용하며 비용이 더 발생할 수 있습니다.

## 2. Liner API 사용 지점과 에이전트 구조

**시장조사 직원 (`ai_market_researcher_v1`)**은 사용자 조사 범위·국가·완료 기준을 받아 공개 웹 정보를 조사합니다. 현 구현의 실제 호출 지점은 다음과 같습니다.

| API / 구성요소 | 기능 | 소스코드 |
|---|---|---|
| **Search Agent** · `POST /api/v1/agents/search` | 시장 현황·경쟁사·가격·고객 문제 조사, 참고 출처 반환. `stream: false` | [`liner_platform.py`](workers/crewai/src/planos_crewai/liner_platform.py) |
| **Web Search** · `POST /api/v1/tools/search/web` | 보조 검색 결과·출처 URL 수집. `include_knowledge: false` | [`liner_platform.py`](workers/crewai/src/planos_crewai/liner_platform.py) |
| **Deep Research** · `POST /api/v1/agents/deep-research` | 심층조사 요청이 명시된 경우에만 사용 | [`market_researcher.py`](workers/crewai/src/planos_crewai/crews/market_researcher.py) |
| **Liner Router** (OpenAI 호환) | 요구사항 검수 CrewAI / 선택적 조사 요약 | [`llm.py`](workers/crewai/src/planos_crewai/llm.py) |
| **CrewAI Worker** | 승인된 실행 큐 수신, 조사 수행, 결과·실행 상태 기록 | [`worker.py`](workers/crewai/src/planos_crewai/worker.py) |

**엔드포인트 기본 주소:** `https://platform.liner.com/api/v1`. 요청 인증은 서버/워커의 환경변수 `LINER_API_KEY`를 사용합니다. 프런트엔드 번들에는 키를 전달하지 않습니다. AI 기획문서 생성의 Gemini BFF는 **Liner 시장조사와 별도 경로**입니다.

**에이전트 처리 흐름(웹 통합 구조):**

1. 프로젝트 소유자가 조사 대상·완료 기준을 입력하고 **데이터 처리/업무 범위에 동의**합니다.
2. 시스템이 프로젝트 문서 스냅샷(manifest) 및 계약 정보를 확인하고 서버 실행 큐(`ai_runs`)에 등록합니다.
3. 별도 실행 중인 CrewAI 워커가 큐를 받아 **Liner Search Agent → 보조 Web Search → 결과 구조화**를 수행합니다. 심층조사는 선택한 경우에만 사용합니다.
4. 출처·검증 필요 항목이 포함된 보고서(`market_research_report_v1`)를 생성합니다.
5. 사용자가 보고서를 검토·수락하며, 리서치 인사이트를 **미리보기와 확인 단계를 거쳐 PRD 일부 섹션에 반영**할 수 있도록 하는 UI/코드가 있습니다.

이 다섯 단계는 **설계·구현된 통합 흐름**을 설명하며, 현재 Preview에서 1~5단계의 **실 Liner 워커 완료를 전수 검증했다는 뜻은 아닙니다.** 독립 `research-local` 실호출은 별도로 검증했습니다.

### 호출 비용·안전장치

시장조사 워커의 기본 설정은 **최대 4회 호출 / 예상 USD 5의 소프트 한도**(`PLANOS_MARKET_RESEARCH_MAX_CALLS`, `PLANOS_MARKET_RESEARCH_BUDGET_USD`)입니다. 이는 **실제 청구액을 보장하는 결제 상한이 아닙니다**. 검색 오류에는 제한적 재시도가 있고, 자동 반복 심층조사·무단 이메일 발송·외부 게시·임의 파일 수정은 대상 업무에서 제외합니다.

## 3. AI 직원과 제품 범위

| AI 직원 / 기능 | 상태(2026-11-24 기준) |
|---|---|
| **AI 시장조사·리서치** | **실제 Liner 호출** 및 로컬/격리 테스트 증빙. UI 요청·보고서·PRD 반영 코드 있음 |
| **요구사항 검수** | CrewAI/Liner Router 실행 경로 구현, Mock 경로와 분리. 호스티드 실워커 완료 검증은 남음 |
| **AI PM / UX 검토 / 정책 기획** | 기능 일부·역할 카드/설계·Mock 또는 준비 중. 전부 실제 실행 가능하다고 표시하지 않음 |
| **AI 마케터 / 영업사원** | 역할 소개/확장 후보. 자동 게시·발송·실제 성과 기능 미제공 |

PlanOS 기본 워크스페이스에는 프로젝트 생성, 직접 기획/기본 PM 시작 경로 선택, AI 인터뷰, PRD·기능정의서·정책서·화면설계서, 문서 편집·버전, 업무 관리, AI 직원 탐색 화면이 포함됩니다. 기능별 DB/실모델 검증 수준은 다르며 **구현 화면 존재 = 정식 출시 완료**가 아닙니다.

## 4. 웹 UI를 별도로 실행하려면

**심사의 Liner 실호출 확인은 1번의 CLI 경로로 충분합니다.** 아래 웹 UI는 추가로 프런트엔드를 살펴보고 싶은 경우를 위한 안내입니다.

**준비물:** Node.js **22**, npm, 기능을 실제로 사용하려면 설정된 **Supabase 개발/격리 환경** 및 해당 프로젝트의 스키마·인증 구성이 필요합니다.

~~~bash
cd plan_os
npm ci
~~~

루트의 `.env.local.example`을 `.env.local`로 복사하고, 적어도 다음의 **개발용 Supabase** 값을 설정합니다(`VITE_SUPABASE_ANON_KEY`는 공개 클라이언트 키이며 `service_role` 키가 아닙니다).

~~~dotenv
VITE_SUPABASE_URL=개발용_Supabase_프로젝트_URL
VITE_SUPABASE_ANON_KEY=개발용_Supabase_anon_공개키
~~~

그다음 실행합니다.

~~~bash
npm run dev
~~~

기본 Vite 개발 서버의 안내 주소(일반적으로 `http://localhost:5173`)로 접속합니다. **Supabase가 설정되지 않은 상태에서 앱의 인증·저장·실행 기능이 정상 동작한다고 보장하지 않습니다.** 프로젝트 스키마/권한 정책/시드 계정은 테스트 환경 기준으로 구성해야 합니다. 외부 API를 사용하는 Gemini 문서 생성은 별도 서버 전용 `GEMINI_API_KEY` 구성이 필요하며, Liner 시장조사의 필수 조건은 아닙니다.

### UI에서 조사 실행을 연결하는 경우(고급/격리 테스트)

UI는 `/ai-staff` → 프로젝트 선택 → `/projects/:projectId/specialists/market-research`에서 조사 범위와 동의를 받도록 구현되어 있습니다. 보고서 목록은 `/projects/:projectId/research` 경로에 있습니다.

**서버 큐의 `queued`는 작업 완료를 뜻하지 않습니다.** 로컬 격리 Supabase에 필요한 선행 마이그레이션/계약/권한을 구성한 뒤, 별도의 워커를 실행해야 실제로 처리됩니다.

~~~bash
# 저장소 루트에서, 일회용 로컬 Supabase DB임을 확인한 후에만:
node scripts/apply-034-crewai-local-only.mjs
node scripts/apply-035-market-researcher-local-only.mjs

# workers/crewai 디렉터리에서 (로컬 service_role 설정 필요):
uv run planos-crewai-worker poll --limit 3
~~~

위 SQL 스크립트는 **이미 필요한 선행 스키마가 구성된 일회용 로컬 DB용**입니다. 일반 심사위원이 새 프로젝트에 그대로 적용할 수 있는 완전한 DB 설치 스크립트는 아니며, 기존 운영 DB·호스티드 DB에 적용하면 안 됩니다. 통합 테스트는 [워커 README](workers/crewai/README.md)와 [Preview 검증 기록](docs/plans/PREVIEW_027_036_037_APPLY_2026-11-21.md)을 참조하세요.

## 5. 테스트 및 구현 증거

**로컬 정적/단위 테스트(실제 Liner 과금 호출 없이):**

~~~bash
# 저장소 루트
npm ci
node --test tests/market-research-staff.test.mjs tests/crewai-worker-contract.test.mjs
npm run build
npm run lint
~~~

**Python 워커 테스트:**

~~~bash
cd workers/crewai
uv sync --extra dev
uv run pytest
~~~

**실제 Liner 호출을 포함하는 검증은 별도입니다.** `research-local`과 실호출 E2E를 실행할 때 유효한 API 키, 동의, 비용·호출 횟수 확인이 필요합니다. 자동화 테스트 통과만으로 Liner 실호출을 주장하지 않습니다.

관련 검증 증거:
- [PR #83 — Liner 시장조사 직원 구현 및 로컬 실호출/E2E 기록](https://github.com/happysuyeun-rgb/plan_os/pull/83)
- [시장조사 실행·제한·검증 메모](docs/plans/AI_MARKET_RESEARCHER_LINER_2026-11-14.md)
- [Preview 큐/계약/승인 스모크 결과와 미실행 항목](docs/plans/PREVIEW_027_036_037_APPLY_2026-11-21.md)

**현재 검증 범위:** 시장조사 단독 Liner 실호출과 격리 큐 E2E는 기록됨. Preview에서는 계약·승인·실행 큐 등록까지 검증됐지만 **호스티드 워커가 큐를 가져와 Liner를 호출하고 완료하는 전체 경로는 미검증**입니다. 정식 운영 데이터베이스·유료 LLM 게이트·Production 정식 출시는 별도 승인과 검증이 필요합니다.

## 6. 키 관리 및 심사 보안 안내

- `LINER_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 등의 **서버 비밀값은 환경변수로만 전달**합니다. 실키를 소스·README·이슈·PR·테스트 로그·영상에 남기지 마세요.
- `.env` 및 `.env.local` 파일은 [`.gitignore`](.gitignore)에서 제외됩니다. 공개 저장소에는 예시 `.env.example`만 유지합니다.
- `VITE_` 변수는 브라우저 코드에 포함될 수 있으므로 **비밀 키에 사용하면 안 됩니다**. `VITE_SUPABASE_ANON_KEY`는 브라우저 사용을 전제로 한 공개키입니다.
- Liner 키는 `workers/crewai` 내부의 서버 전용 [`liner_platform.py`](workers/crewai/src/planos_crewai/liner_platform.py) / [`llm.py`](workers/crewai/src/planos_crewai/llm.py)에서 읽습니다.
- 공개 저장소의 **전체 Git 이력에 대한 별도 비밀값 스캔 및 실제 계정/키 권한 검증은 제출 전 추가 확인 항목**입니다. 기존 키가 노출되었을 가능성이 확인되면 공급자 측에서 폐기·재발급해야 합니다.
- 심사·데모에는 **가상의 프로젝트 데이터와 공개된 웹 자료만** 사용합니다. 실제 고객·회사 내부 문서 및 개인정보를 포함하지 마세요.

## 7. 문제 해결

| 증상 | 확인할 내용 |
|---|---|
| `LINER_DRY_RUN` / `dryRun: true` | `LINER_API_KEY`가 실제 값인지, `PLANOS_CREWAI_DRY_RUN=false`인지 확인 |
| Liner 401/403/429 | 심사용 키 권한, 사용량·크레딧 한도, 요청 제한 확인 |
| 조사 결과에 출처 없음 | `report.sources`·`unverifiedOrWeakEvidence` 확인. 출처 없는 주장을 검증 완료로 보지 않음 |
| 웹 UI에서 작업이 `queued` 상태 | CrewAI 워커·로컬 Supabase 큐/계약/키 설정 확인. UI만 실행해서는 처리되지 않음 |
| 개발 서버 인증·DB 오류 | `.env.local`의 개발용 Supabase URL·공개키와 DB 스키마·RLS 구성 확인 |
| `uv` 또는 Python 설치 오류 | Python 3.11~3.13 및 uv 설치 확인. `uv python install 3.12` 재확인 |

## 8. 개발 문서와 코드 탐색

- [제품 PRD](docs/product/PRD.md) · [기능정의서](docs/product/FUNCTIONAL_SPEC_V1_2026-10-20.md)
- [저장소 구조 안내](docs/REPOSITORY_GUIDE.md) · [문서 인덱스](docs/README.md)
- [AI 직원 카탈로그](src/lib/aiStaffCatalog.ts) · [시장조사 페이지](src/pages/MarketResearchRequestPage.tsx) · [결과→PRD 반영 코드](src/lib/researchPrdPatch.ts)
- [AI 워커/도구 등록](workers/crewai/README.md) · [역할 정의](workers/crewai/src/planos_crewai/roles.py)

**제출 요약:** PlanOS는 프로젝트 관리 및 문서 작업과 AI 직원 역할을 연결합니다. 이번 Liner API 시연의 핵심은 **승인된 시장조사 범위 내에서 실제 검색 API를 호출하고 출처 포함 보고서를 생성**한다는 점입니다. 실제 실행 여부는 `research-local` 결과와 호출 사용량으로 확인하며, Mock·준비 중 기능·미검증 Preview 실행을 성공한 실사용 기능으로 과장하지 않습니다.
