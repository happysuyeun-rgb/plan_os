# PlanOS 3.0 × AI 인력사무소 — 개발 마스터플랜 (정본)

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-10-23 |
| 상태 | **정본 (실행용)**. 이후 진행은 이 문서 + Issue #41 체크리스트로 추적 |
| 기준 코드 | `preview/planos-integrated-20261023` @ `7460e5b` (PR #30⊂#36⊂#42) |
| 제품 정본 | Draft PR #28 서비스기획 v2.0 · PR #40 C04/V6 · Issue #41 PMO |
| 금지 | `main` 병합 · 운영 DB 쓰기 · Production 배포 · 고객 데이터 외부 AI 전송 · 무제한 유료 호출 — **사용자 별도 승인 전 금지** |

> 기존 `PLANOS_INTEGRATED_EXECUTION_PLAN_2026-10-21.md`, `CURSOR_INTEGRATION_EXECUTION_PLAN_*`, `roadmap/IMPLEMENTATION_PLAN.md`, `PROGRESS_STATUS.md`는 **이력·참조**. 일정·우선순위 충돌 시 **본 문서가 우선**한다.

---

## 1. 제품 방향 (불변)

### A. 기존 PlanOS 경로 (유지·강화)

사용자가 AI 직원 채용 없이도: 인터뷰 → 기획 문서 생성 → 채팅 수정 → 직접 편집 → 자동저장·버전·복원 → 프로젝트/업무 관리.

### B. 이중 경로 (배타 아님)

1. 직접 진행  
2. (기본/정식) AI PM 지원  

진행 중 언제든 AI 직원 투입·PM 위임 가능해야 한다.

### C. AI 인력사무소 (TARGET)

직무 탐색 · F/T 성향 · 모델·도구 · 등급 · 단발/전담 · 정식 PM · 1~N 프로젝트 · 교체·해임 · 검수 · 동의 기반 경력·평가 · 권한·예산·데이터 범위.

---

## 2. 단계 개요 (승인된 우선순위)

```mermaid
flowchart LR
  A[PhaseA 기준선통합] --> B[PhaseB 운영기능]
  B --> C[PhaseC 실LLM]
  C --> D[PhaseD 기획검수AI]
  D --> E[PhaseE AIPM_인력사무소]
  E --> F[PhaseF 통합검증_출시]
```

| Phase | 목표 | 사용자 승인 게이트 |
|---|---|---|
| **A** | PR #30→#36→#42 통합, Sonar, Preview, 병합·복구 계획 | **main 병합·운영 DB** |
| **B** | S1 서버 영속·상세·이력, PM↔업무, C04 집계 안정 | 서버 모드 기본값 전환 |
| **C** | Placeholder≠실 LLM, 어댑터·비밀키·예산·이력 | provider·가격·데이터처리 |
| **D** | 첫 전문 AI = **기획 검수 직원** E2E | 고위험 자동적용 범위 |
| **E** | AI PM 실행 vs 사람 PM 구분, 채용·모델·경력·가격 | 과금·경력 공개 |
| **F** | 통합 E2E·출시 런북 | Production 배포 |

---

## 3. CURRENT / TARGET / MOCK / DEPRECATED / UNDECIDED

| 분류 | 대표 |
|---|---|
| **CURRENT** | 문서 CAS/복원/채팅원자성, 게스트 이전, 사람 PM 022~024, C04 RPC 025, Preview `PlanOS-Preview` |
| **TARGET** | 실 LLM 생성, 기획 검수 AI, AI PM worker, 채용·모델·경력·과금, N29 복수 PM |
| **MOCK** | PR #25 역할요청 UI, PR #27 구 F-401 mock, `placeholderContent` 스트림 |
| **DEPRECATED** | drafts/017 (→018), 고정 이메일 E2E, main 기준 “F-402 미구현” 문구(코드는 있음) |
| **UNDECIDED** | DEC/OP 가격·provider·환불·보존, 021 컷오버 시점, `VITE_S1_SERVER_TASKS` 운영 기본값 |

상세 매트릭스: [`PLANOS_FEATURE_IMPLEMENTATION_MATRIX_2026-10-23.md`](./PLANOS_FEATURE_IMPLEMENTATION_MATRIX_2026-10-23.md)

---

## 4. 중요 경로 (Critical path)

1. Phase A 게이트 통과 → (승인) main + 운영 DB 001~026  
2. Phase B S1 서버 기본 경로 안정  
3. Phase C 격리 LLM 어댑터 + 예산  
4. Phase D 검수 AI 세로 슬라이스 (읽기→근거→제안→사람승인→task→재검수)  
5. Phase E AI PM 위임 (사람 PM RPC와 계약 분리)  
6. Phase F 출시

**예상 공수(엔지니어-주, 격리 환경 기준, ±±40%)**

| Phase | 공수 | 비고 |
|---|---|---|
| A | 1~2 | Sonar #30/#36, 병합 런북, Preview 수용 |
| B | 2~3 | S1 상세·이력·권한·플래그 |
| C | 3~5 | 어댑터·BFF·예산; provider 승인 대기 가능 |
| D | 3~4 | 검수 파이프라인·인용·task 연동 |
| E | 6~10 | 채용 UX·계약·경력·AI PM |
| F | 1~2 | 게이트·런북 |

병렬 가능: 문서 정합(#28/#40 동기화), Sonar 테스트 헬퍼, S1 UI 상세(서버 스키마 확정 후), Preview E2E — **운영 DB·유료 키와 무관한 범위만**.

---

## 5. 첫 P0 (즉시 착수)

**A-P0-01** — Phase A Sonar/회귀 차단 해제 착수  
- PR #30: E2E `S4036`/`S7044` 등 테스트 헬퍼 공통화 (보안 등급)  
- PR #36: 중복률은 마이그레이션 재정의 본질 → 측정·게이트 전략을 런북에 명시, 테스트 JS 중복만 추가 제거  
- Preview 사용자 A/B/C는 사용자 검수와 병행  

이어 **A-P0-02** 병합·복구 런북(013~026) 확정 → 사용자 승인 대기.

---

## 6. 관련 문서

| 문서 | 역할 |
|---|---|
| Issue [#41](https://github.com/happysuyeun-rgb/plan_os/issues/41) | PMO 체크리스트 |
| [기능 매트릭스](./PLANOS_FEATURE_IMPLEMENTATION_MATRIX_2026-10-23.md) | F-ID 실상태 |
| [의존성 로드맵](./PLANOS_DEPENDENCY_ROADMAP_2026-10-23.md) | 순서·PR 계보 |
| [스프린트 백로그](./PLANOS_SPRINT_EXECUTION_BACKLOG_2026-10-23.md) | 작업 큐 |
| [릴리스 게이트](./PLANOS_RELEASE_TEST_GATES_2026-10-23.md) | 테스트·병합·출시 |
| [Preview 안내](./PREVIEW_USER_TEST_GUIDE_2026-10-23.md) | 사용자 체험 |
| [배포 전환](./DEPLOYMENT_TRANSITION_PLAN_2026-10-22.md) | G1 운영 적용(확장 필요) |
| V6 감사 | PR #40 브랜치 `docs/quality/PLANOS_SERVICE_DESIGN_CROSS_AUDIT_V6_2026-10-23.md` |
