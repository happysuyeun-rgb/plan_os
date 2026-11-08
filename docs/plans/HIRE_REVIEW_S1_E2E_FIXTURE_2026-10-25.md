# 채용 → 검수 → finding 수락 → S1 E2E fixture

작성일: 2026-10-25  
기준 tip: `main` @ `7066b85` (#55 병합)  
정책: **이중진입 유지** · 호스티드 027 / 유료 LLM / Production = **명시 승인 전 금지**

이 문서는 Mock 수직 슬라이스(채용 요청 → `/ai-review` 핸드오프 → finding 수락 → S1 업무)의 **재현 fixture·자동화 매핑**이다.  
사람 PM(`/plans`) 경로를 대체하지 않는다.

---

## 1. 한 줄 경로

```
/specialists (카탈로그 1종)
  → /specialists/request (초안·모의 계약 검토)
  → /ai-review (세션 핸드오프 + staffBrief)
  → Mock 검수 run → finding 수락
  → S1 업무 생성 (/tasks)
```

병행: `/plans` (사람 PM) — `DualEntryLaneNotice`로 고지.

---

## 2. 브라우저 fixture ID (S3 Chromium)

로컬 Vite(`http://127.0.0.1:5173`) + `planos-local-dev-user` 세션.  
워크플로: `.github/workflows/s3-browser-e2e.yml` · 스크립트 `tests/s3-browser-e2e.mjs`

| fixture projectId | 기대 |
|---|---|
| `fixture-owner` | owner 초안·모의 검토·`/ai-review` 핸드오프 · hire 이미 투입됨 |
| `fixture-viewer` | 소유자만 작성 가능 안내 · 초안 CTA 없음 |
| `fixture-deleted` | 접근 불가/삭제 안내 |
| `fixture-missing` | 접근 불가 안내 |
| (미인증) `fixture-owner` | `/login?redirect=` |

### 핸드오프 입력 샘플 (owner happy path)

| 필드 | 값 |
|---|---|
| 역할 | `requirements_auditor_v1` · 요구사항 검수 전문가 |
| 업무 | `기획 요구사항 문서의 누락 항목을 검토해 주세요.` (≥10자) |
| 완료 기준 | `누락과 근거를 보고서로 정리` (≥5자) |
| 계약 UI | `review_only` · 예상 비용 **산정 불가** · 최대 청구 **미정** (₩0 날조 금지) |

핸드오프 후 `/ai-review`에서:

- `data-testid="ai-review-specialist-handoff"` 표시
- hire 버튼 문구 `투입됨 (Mock)`
- reload 시 세션 핸드오프 배너는 **소멸**(세션 전용; job 저장과 별개)

---

## 3. AI 검수 → S1 (disposable local)

워크플로: `.github/workflows/ai-review-local-e2e.yml` · `tests/e2e/browser_ai_review.mjs`  
환경: 일회용 local Supabase · `VITE_AI_REVIEW_STORE=server` · `VITE_S1_SERVER_TASKS=true`  
시드: `tests/e2e/seed_ai_review.sql`

| 단계 | 기대 |
|---|---|
| unpaid banner | `ai-review-unpaid-preview` · 유료 LLM/계약/결제 UI 없음 |
| AC-01 문서 최소 선택 | 미만이면 run 차단 |
| owner hire → run → accept | finding 수락 시 S1 업무 생성 |
| reload | SERVER_027 저장 job 유지 |
| viewer | hire/run disabled |
| editor | hire hydrate TOCTOU 대비 후 run 가능 |
| 타 프로젝트 | 외국 job 비노출 |

**통합 Playwright (2026-10-26):** `tests/mock-integrated-journey-e2e.mjs`  
- `PLANOS_LOCAL_SUPABASE_DIR` 있으면 disposable seed로 **단일 브라우저** 여정:  
  프로젝트 진입 → `/plans` DualEntry → 카탈로그 → 요청 → 세션 핸드오프(reload 소멸) → hire/run → finding 수락 → S1 taskId → F-105 agent 지정(LS) → 목록 → reload 유지 · viewer hire 차단.  
- 사람 PM **승인 CAS 루프**는 본 스크립트에서 **BLOCKED** (정본: `tests/e2e/browser_pm_plan_loop.mjs`).  
- fixture-only 모드(S3)는 카탈로그~핸드오프만; 문서 없는 run은 BLOCKED(가짜 문서 삽입 금지).  
CI: `.github/workflows/ai-review-local-e2e.yml` 스텝 `Playwright Mock integrated journey E2E`.

---

## 4. 단위·계약 테스트 (자동화 매트릭스)

| 구간 | 테스트 |
|---|---|
| 카탈로그 1종 Mock | `tests/ai-staff-catalog-mock.test.mjs` |
| S3 접근·라우트 | `tests/s3-specialist-access-contract.test.mjs` |
| 세션 핸드오프 | `tests/specialist-review-handoff.test.mjs` |
| staffBrief → finding | `tests/mock-staff-brief-review.test.mjs` |
| 병행 고지 UX | `tests/dual-entry-lane-notice.test.mjs` |
| 진행 중 AI 투입 안내 | `tests/mid-project-ai-staffing-notice.test.mjs` |

로컬 스모크:

```bash
node --test ./tests/ai-staff-catalog-mock.test.mjs ./tests/specialist-review-handoff.test.mjs ./tests/mock-staff-brief-review.test.mjs ./tests/dual-entry-lane-notice.test.mjs
```

---

## 5. 수동 E2E (로컬 Mock · 한 줄로 이어 붙이기)

전제: `npm run dev`, 로그인된 owner, **실프로젝트** 또는 로컬 fixture 프로젝트.

1. `/projects/:id/specialists` — 카드 1종 · 결제/채용 확정 CTA 없음  
2. 「이 역할로 업무 요청 Mock」→ `/specialists/request`  
3. 업무·완료 기준 입력 → 초안 미리보기 → 모의 계약 검토 체크 → 검토  
4. 「AI 기획 검수로 이어가기」→ `/ai-review` · 핸드오프 배너·brief 확인  
5. 문서 유형 ≥ 최소 개수 선택 → Mock 검수 실행  
6. finding 수락 → S1 업무 ID/보드에 반영 확인 (`/tasks`)  
7. 병행: `/plans`에서 `DualEntryLaneNotice`로 AI 검수 링크가 보이는지 확인 (대체 아님)

실패 시 기록: 단계 번호 · `data-testid` · 콘솔/네트워크 · store mode(`ai-review-store-mode`).

---

## 6. 명시적 비범위

- F-302 실계약 · F-303 예산 원장 · 유료 LLM  
- Preview 호스티드 027 적용 후 전수 E2E (Gate A-027)  
- Production  
- AI PM이 사람 PM(`/plans`)을 대체하는 UX  
- **F-105 AI 담당 Mock**(`assignee kind=agent`) — 업무 메타데이터일 뿐이며 채용·검수 **실행과 동일시하지 않음**. 통합 E2E는 accept로 생긴 **실 taskId**에 kind만 연결한다.

---

## 7. 2026-10-26 통합 E2E 검증 결과 (PR #59)

실행: `npm run test:e2e:mock-integrated` (requires `PLANOS_LOCAL_SUPABASE_DIR` + Vite :5173 + 027 local_only)  
CI: `ai-review-local-e2e.yml` → artifact `mock-integrated-e2e` / `results.json`.

| 단계 | 판정 | 비고 |
|---|---|---|
| A1 프로젝트 진입 | PASS* | `seed_ai_review.sql` projectId (*CI disposable) |
| A2 PM DualEntry | PASS* | `/plans` |
| A2 PM 승인 루프 | BLOCKED | `browser_pm_plan_loop.mjs` (본 journey 비범위) |
| A3~A4 카탈로그·핸드오프 | PASS* | 세션 handoff ≠ SERVER job |
| A5~A6 run·수락→S1 | PASS* | findingId·taskId 로그 연결 |
| A7~A9 F-105·목록·reload | PASS* | LS `v2:{userId}:{projectId}` |
| B viewer | PASS* | hire disabled |
| placeholder 생성 가드 | PASS | 단위 `placeholder-project-create-guard.test.mjs` |
| fixture-only (문서 없음) | BLOCKED A5+ | 가짜 문서 삽입 금지 |

\* disposable CI 성공 시 `results.json` status=PASS로 확정.

---

## 8. 관련 PR

| PR | 내용 |
|---|---|
| #49 | `/specialists/request` 채용 Mock |
| #50 | → `/ai-review` 세션 핸드오프 |
| #51 | staffing brief → Mock 검수 job |
| #53 | 대시보드·생성 “진행 중 AI 투입” 안내 |
| #54 | `/specialists` 1종 카탈로그 |
| #55 | `/plans`↔`/ai-review` 병행 고지 |
