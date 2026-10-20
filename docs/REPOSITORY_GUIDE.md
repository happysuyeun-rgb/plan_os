# PlanOS 3.0 저장소 폴더·문서 활용 가이드

> **확인 기준:** 2026-10-21, GitHub `main`. 실제 파일 존재를 확인한 대표 경로를 기준으로 작성. **모든 하위 파일을 열거한 완전한 디렉터리 트리는 아니다.** 새 폴더/PR 생성 후 이 안내 갱신.
>
> **첫 시작:** [통합 실행계획서](plans/PLANOS_INTEGRATED_EXECUTION_PLAN_2026-10-21.md) → [작업 운영규칙](plans/PLANOS_WORK_EXECUTION_PROTOCOL_2026-10-21.md) → 이 가이드 → [문서 목차](README.md). 구문서는 [archive](archive/README.md)에서 별도 관리.

## 1. 저장소 한눈에 보기

```text
plan_os/
├── README.md                     # 프로젝트 소개 및 첫 진입 링크
├── docs/                         # 기획·실행·품질·설계의 문서 허브
│   ├── README.md                 # 문서 색인
│   ├── REPOSITORY_GUIDE.md       # 지금 읽는 폴더·활용 가이드
│   ├── DOCUMENT_INVENTORY_2026-10-21.md
│   ├── product/                  # 제품·기능·정책
│   ├── ux/                       # 정보구조·화면·흐름
│   ├── engineering/              # 개발 계약·API·데이터·아키텍처
│   ├── plans/                    # 최신 실행계획·작업 운영규칙
│   ├── quality/                  # QA·결함·검수·테스트 계획
│   ├── operations/               # 운영·릴리스·롤백
│   ├── roadmap/                  # 이전/보조 개발계획(최신 계획과 대조)
│   └── archive/                  # 구문서 보관
├── src/                          # React/TypeScript 서비스 구현
│   ├── main.tsx, App.tsx         # 진입점과 화면 라우팅
│   ├── pages/                    # 화면 단위 구현
│   ├── components/               # 재사용 UI 컴포넌트
│   ├── store/                    # Zustand 상태·업무 처리
│   ├── lib/                      # 공통 기능·Supabase 연동
│   │   └── api/                  # 서버/DB 요청 어댑터
│   └── types/                    # 공유 타입
├── supabase/
│   └── migrations/               # 버전별 DB 구조/정책 SQL
├── tests/                        # 단위·계약·통합 테스트
├── scripts/                      # 개발·검사·DB 유틸리티
├── .github/workflows/            # GitHub Actions CI
├── public/                       # 정적 리소스
└── package.json                  # 개발/빌드/테스트 명령
```

`src/`, `supabase/`, `tests/` 등의 표시 경로는 **실제로 확인한 대표 폴더**이며, 상기 트리는 이해를 돕기 위한 축약본이다.

### 별도 사업성 검증·수익화 트랙
- [사업성 검증·Go-to-Market 전략 v1.0](plans/PLANOS_BUSINESS_VALIDATION_STRATEGY_2026-10-21.md) — 실제 고객 수요·경쟁·가격 가설·유료 검증 게이트. 개발 G0~G7 계획과 구분해 V0~V8 추적. 실제 매출/고객 인터뷰는 미수행.

## 2. 일을 할 때 무엇을 열까?

| 질문/작업 | 가장 먼저 볼 곳 | 이어서 확인 |
|---|---|---|
| 다음에 무엇을 개발하나? | [통합 실행계획](plans/PLANOS_INTEGRATED_EXECUTION_PLAN_2026-10-21.md) | [작업 운영규칙](plans/PLANOS_WORK_EXECUTION_PROTOCOL_2026-10-21.md) |
| 이 기능은 무엇을 해야 하나? | [통합 기능정의서](product/FUNCTIONAL_SPEC_V1_2026-10-20.md) | [서비스기획서](product/SERVICE_PLAN_V1_2026-10-20.md), [운영정책](product/SERVICE_OPERATIONS_POLICY_V1_2026-10-20.md) |
| 화면 흐름이나 IA는? | [IA](ux/IA.md), [화면명세](ux/SCREEN_SPEC.md) | [업무 흐름](product/TASK_FLOWS.md) |
| API·데이터 구조는? | [MVP 구현 명세](engineering/MVP_BUILD_READY_SPEC_2026-10-20.md) | [API 계약](engineering/API_CONTRACTS.md), [데이터 모델](engineering/DATA_MODEL.md) |
| 실제 화면을 수정하나? | `src/pages/` | `src/components/`, `src/store/`, `src/lib/` |
| 문서 자동저장/복원 문제인가? | `src/store/documentStore.ts` | `src/pages/DocumentPage.tsx`, `src/lib/api/documents.ts`, [실행계획 G1](plans/PLANOS_INTEGRATED_EXECUTION_PLAN_2026-10-21.md) |
| 업무관리 S1인가? | `src/pages/ProjectTasksPage.tsx` | `src/lib/api/projectTasks.ts`, [S1 QA](quality/S1_TASK_CROSS_AUDIT_2026-10-20.md) |
| 감사자료 선택 S2인가? | `src/pages/AuditSourceSelectionPage.tsx` | `src/lib/api/auditManifests.ts` |
| DB/RLS를 변경하나? | `supabase/migrations/` | [운영정책](product/SERVICE_OPERATIONS_POLICY_V1_2026-10-20.md), 해당 QA·보안 문서 |
| 테스트 실패/배포 문제인가? | `tests/`, `.github/workflows/` | [QA 계획](quality/TEST_PLAN_2026-10-20.md), [릴리스 런북](operations/RELEASE_RUNBOOK_2026-10-20.md) |
| 과거 명세가 필요하나? | [아카이브](archive/README.md) | [문서 인벤토리](DOCUMENT_INVENTORY_2026-10-21.md) |

## 3. 폴더 역할과 수정 원칙

### docs/
- `product/`: **무엇을 왜 만들지**. 실제 구현 완료 여부는 기능정의서의 ID 및 검수 근거와 비교.
- `ux/`: **어떤 화면·동선·상태인지**. 화면에서 가능한 행동과 오류 상태를 명세.
- `engineering/`: **어떤 구조·계약으로 만들지**. TARGET/초안은 현재 DB에 적용된 사실이 아님.
- `plans/`: **언제 무엇을 끝낼지**. 계획서가 다음 작업의 우선 기준이며 완료 판정은 증빙 필수.
- `quality/`: **어떤 결함이 남았고 무엇을 테스트했는지**. 작성만 된 테스트와 실행 PASS를 구분.
- `operations/`: 출시·장애·롤백 단계의 참고 문서. 운영 승인·리허설 없이 출시 완료로 해석 금지.
- `roadmap/`, 이전 `PROGRESS_STATUS.md`: 이전 진행 기록·보조 일정일 수 있으니 최신 계획서와 내용 불일치 시 최신 증빙으로 조정.
- `archive/`: 이전 V1 명세 등 **읽기용**. 새 구현 기준으로 우선 사용 금지.

### src/
- `App.tsx`/진입점: 라우팅·전역 구성.
- `pages/`: 개별 화면 및 사용자 상호작용.
- `components/`: 여러 화면에서 공유할 UI.
- `store/`: 상태와 저장 큐 등 사용자 작업의 수명주기.
- `lib/api/`: DB/RPC 호출과 응답 검증; UI에서 동일 쓰기 로직 중복 구현 지양.
- `types/`: 화면·스토어·API 간 공유 자료형.
- **기능 하나를 바꾸면** 화면 → 상태 → API → DB 계약 → 테스트를 함께 대조.

### supabase/ · tests/ · scripts/ · .github/
- `supabase/migrations/`은 개발 SQL 파일일 뿐 실제 운영 DB 적용 증거가 아님. 번호 중복·적용 순서 검수 필수.
- `tests/`에서 자동 테스트 실행 결과를 확인. PR별 CI 성공은 해당 CI 범위만 의미.
- `scripts/db-push.mjs`·`npm run db:push`는 **DB 변경 가능 명령**이므로 대상 환경을 확인하고 운영 DB에는 승인 없이 실행 금지.
- `.github/workflows/`는 CI 정의. Draft PR에 워크플로가 있어도 **실제 실행 run이 확인되지 않으면 PASS 아님**.

## 4. 개발 시작부터 완료 처리까지

1. **반드시** [통합 실행계획](plans/PLANOS_INTEGRATED_EXECUTION_PLAN_2026-10-21.md)에서 다음 한 작업·P0·누락/불일치 확인.
2. 해당 F-ID, UX 화면, API·DB 계약, 실제 코드의 차이를 적고 수용 기준을 설정.
3. 기능별 브랜치/PR에서 개발. 필요한 파일만 변경하고 운영 DB·배포·유료 호출은 사전 승인.
4. 빌드·테스트·권한·경합·실패 경로 검수 → 결함 수정 → 재검수.
5. 커밋/PR/Actions ID를 실행계획서에 남기고, **실제로 충족한 범위만 `[x]`**. 미검증은 `[ ]`.
6. 노션 업무일지 동기화 → 최신 실행계획서 재확인 → 다음 작업 시작.

## 5. 로컬에서 파일과 개발 상태 찾기

```bash
git switch main
git pull --ff-only origin main
git ls-files docs            # 추적 중인 문서 전체 목록
git ls-files src             # 실제 앱 구현 파일
git ls-files supabase        # SQL/설정 파일
git status                   # 현재 작업 변경 여부
npm ci
npm run build
npm run lint
npm run test:s1
```

**주의:** 먼저 `git status`로 미커밋 변경을 확인하고 브랜치를 전환한다. `npm run lint`는 기존 저장소 전체 오류가 있을 수 있으므로 새 변경에서 생긴 문제와 별개로 기록한다. `npm run db:push`는 자동 실행하지 않는다.

## 6. 현재 개발 상태를 읽는 법

- S1 업무관리/S2 감사자료: **초기 구현 main 병합**, 전체 DB/E2E 수용 완료 아님.
- 문서 저장·복구 P0: **Draft PR #15/#19/#22/#23/#24 관련**, DB 동시성/권한 및 병합 검증 미완료.
- AI 인력사무소 새 기능: 계획서의 **전문가 선택 → 업무 요청 → 승인 Mock** 레인에서 개발 착수 기준.
- 항상 **가장 최신 실행계획서**, PR 상태, 성공한 테스트 근거를 함께 본다. 이 문서의 상태 요약은 2026-10-21 스냅샷이다.

## 7. 유지보수 원칙

새 폴더·중요 문서·마이그레이션을 만들거나 파일을 이동하면 **이 가이드 + docs/README.md 링크 + 실행계획서**를 함께 갱신한다. 중복 파일 발견 시 삭제보다 대체 관계와 참조 검증을 먼저 수행한다. 저장소의 실제 파일 존재와 문서 설명이 다르면 **실제 코드/파일과 검증 결과를 우선해 수정**한다.
