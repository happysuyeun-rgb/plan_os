# PlanOS 진행 스냅샷 — 2026-11-02

**기준 tip:** GitHub `main` @ `70ca7c5` (#64 병합)  
**정책 유지:** 이중진입 유지 · 호스티드 027 / 유료 LLM / Production = **명시 승인 전 금지**  
**범위:** 코드·CI·PR 실측. 문서만 있는 항목은 “설계됨”으로만 표기.

---

## 1. 진행률 (대략)

| 기준 | 진행률 | 설명 |
|---|---|---|
| **첫 전문가 Mock 수직** (`requirements_auditor_v1`) | **약 80~85%** | 채용 Mock → S2 → 서버 계약(F-A) → Mock worker(F-B) → 보고서 수락·S1(F-C) 로컬/CI 경로 완료 |
| **PlanOS 전체 → Production** | **약 40~45%** | Phase A~D Mock·기반은 main에 많음. 운영 DB·유료 LLM·Preview 전수·출시·AI PM/인력사무소 본구현은 미완 |

> 진행률은 체크리스트·매트릭스·최근 병합 PR을 합산한 **운영용 추정**이다. 제품 완료·출시 완료를 의미하지 않는다.

---

## 2. 오늘까지 끝난 핵심 작업 (2026-10-25 이후 → 2026-11-02)

### 2-A. main 병합 완료 (증거)

| PR | 제목 | 병합일(UTC) | 요지 |
|---|---|---|---|
| [#61](https://github.com/happysuyeun-rgb/plan_os/pull/61) | feat(s2): F-201~202 manifest digest 재검증 게이트 | 2026-11-02 | S2 서버 digest 재검증·stale 복구 |
| [#62](https://github.com/happysuyeun-rgb/plan_os/pull/62) | feat(fa): requirements_auditor_v1 서버 계약·동의 (F-A) | 2026-11-02 | 계약 초안·명시 동의·owner 승인/철회·RLS |
| [#63](https://github.com/happysuyeun-rgb/plan_os/pull/63) | feat(fb): Mock worker 큐·실행 이력 (F-B) | 2026-11-02 | `ai_runs` 큐·Mock worker·mock usage ledger |
| [#64](https://github.com/happysuyeun-rgb/plan_os/pull/64) | feat(fc): Mock 보고서 수락·S1 연결 (F-C) | 2026-11-02 | artifact publish/accept/reject·S1 task 링크 |

### 2-B. 수직 한 줄 요약

로컬 disposable Supabase + Playwright CI 기준으로:

1. S2 문서 manifest 저장·재검증  
2. owner 서버 계약 draft → consent accept  
3. Mock worker enqueue/process → succeeded + mock 사용량  
4. 보고서 publish → 사람 수락 → S1 `project_tasks` 연결  

유료 LLM·실공급사 과금·Production 배포는 **포함하지 않음**.

### 2-C. 그 이전(이미 main) 참고

- Phase A~D Mock MVP (#45·#46 등)
- S3 채용 Mock · `/ai-review` 핸드오프 · staffing brief (#49~#56 등)
- 이중진입·카탈로그·사람 PM 병행 안내 Mock

상세 역사는 [`../PROGRESS_STATUS.md`](../PROGRESS_STATUS.md) 및 [`REMAINING_DEV_CHECKLIST_2026-10-25.md`](./REMAINING_DEV_CHECKLIST_2026-10-25.md) 참고.

---

## 3. 앞으로 남은 일 (우선순위)

### P1 — 바로 이어서 가능한 코드 (DB 과금·027 없이)

| 항목 | 상태 | 비고 |
|---|---|---|
| **F-105** AI 담당 지정 UI Mock | OPEN [#58](https://github.com/happysuyeun-rgb/plan_os/pull/58) | 문서 정렬 [#59](https://github.com/happysuyeun-rgb/plan_os/pull/59) |
| **F-402** 사람 PM 승인·반려·수정요청 루프 | OPEN [#60](https://github.com/happysuyeun-rgb/plan_os/pull/60) | 서버 CAS·상태머신 |
| placeholder 환경 프로젝트 생성 로컬 가드 | 미착수 | 로컬 E2E 단절 해소 |
| 전체 `npm run lint` / 번들 분할 | 미착수 | 품질·유지보수 |

### P1 — 정책·설계 확정 후 (지금 Production 금지에 가깝)

- F-303 예산 한도·원장 (실과금 연결 금지 유지)
- Mock 너머 실 worker/취소·재시도·사용량 고도화
- 유료 LLM 연결 (Gate C-LLM 런북 + **명시 승인**)
- `ai_suggested` PM 계획 경로

### P0/출시 — 명시 승인 후

- Preview 호스티드에 027 적용 (Gate A-027)
- Preview E2E 전수
- 운영 009/010≡013/014 **읽기 전용** 확인
- Production 배포

### P2 / 후순위

- AI 인력사무소 풀스펙 (복수 직무·경력·마켓)
- N29 복수 프로젝트 PM 대시보드
- 문서 Draft PR 정리 (#26·#28·#40)

---

## 4. 추천 다음 1순위

1. **#58 F-105** 또는 **#60 F-402** — CI 맞춰 머지 (Mock/브라우저, 출시 게이트와 무관)  
2. 그다음 품질(lint·로컬 가드)  
3. Preview 027 / 유료 LLM / Production은 **승인 카드 이후**

---

## 5. 관련 문서

- [남은 개발 체크리스트 (10/25, 본 스냅샷으로 보정)](./REMAINING_DEV_CHECKLIST_2026-10-25.md)
- [기능 구현 매트릭스](./PLANOS_FEATURE_IMPLEMENTATION_MATRIX_2026-10-23.md)
- [스프린트 백로그](./PLANOS_SPRINT_EXECUTION_BACKLOG_2026-10-23.md)
- [전체 진행 현황](../PROGRESS_STATUS.md)
- Gate 런북: [Preview 027](./PREVIEW_027_APPLY_RUNBOOK_2026-10-25.md) · [유료 LLM](./PAID_LLM_ENABLE_RUNBOOK_2026-10-25.md)
