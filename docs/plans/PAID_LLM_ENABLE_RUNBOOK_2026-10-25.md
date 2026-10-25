# 유료 LLM 활성화 런북 (Gate C-LLM)

기준: `main` @ `6d36ef1` (#47 Gate A-027 런북 포함)  
작성: 2026-10-25 · **이 문서만으로는 키 주입·유료 호출을 켜지 않는다.**

---

## 목적

문서 생성 BFF(`POST /api/ai/generate`)가 `mode: 'paid'` 로 실 provider를 호출할 수 있게 하기 **전**에 필요한 승인·한도·롤백을 고정한다.

현재 코드 강제값:

- `generationHttp.ts`: **항상** `allowPaidCalls: false` (클라이언트 플래그 무시)
- `budget.ts`: 토큰/비용 캡 기본 **0** → paid 거부
- 응답 `mode`: 승인 전 **`placeholder`만**

---

## 027 / DB와의 관계

| 항목 | 의존 |
|---|---|
| Placeholder / Mock 문서 생성 | DB 불필요 |
| AI 기획 검수 Mock (`/ai-review`) | DB 불필요 (browser store) |
| Preview `VITE_AI_REVIEW_STORE=server` | **Gate A-027** (별도, 막바지 가능) |
| 유료 LLM | **이 게이트** — 027과 **독립**. 개발 중에도 placeholder로 진행 가능 |

호스티드 027 적용을 맨 뒤로 미뤄도 **이 게이트 준비·코드 작업은 진행 가능**.

---

## 금지 (위반 시 중단)

| 금지 | 이유 |
|---|---|
| 승인 없이 `allowPaidCalls: true` 하드코딩 제거 | 과금·유출 |
| 브라우저/`VITE_*`에 `PLANOS_LLM_API_KEY` 노출 | secrets 계약 |
| 캡 0인 채 paid 경로만 열기 | budget 무력화 |
| ops/Production에 키 선배포 | Preview 검증 전 |
| 이 게이트에 027 Preview 적용을 묶기 | 일정·위험 분리 |

---

## 승인 체크리스트 (활성화 전 · 전부 ☑)

- [ ] **명시 승인:** Preview(또는 지정 env)에서 유료 LLM 허용 — 승인자·일시
- [ ] 월간 한도: `PLANOS_AI_MONTHLY_TOKEN_CAP` · `PLANOS_AI_MONTHLY_COST_CAP_USD` **> 0**
- [ ] 서버 시크릿만: `PLANOS_LLM_API_KEY` (± `PLANOS_LLM_BASE_URL`) — Vercel/서버 env, 클라이언트 금지
- [ ] Preview 스모크 계획: 1회 유료 호출 · attempt 로그 · 예산 차단 시나리오
- [ ] 롤백: HTTP 강제 `allowPaidCalls: false` 복구 + 키/캡 제거 순서 합의
- [ ] (권고) Preview Authentication ON · 운영 ref 미사용

---

## 활성화 절차 (승인 후)

1. Preview 서버 env에 키·캡 설정 (값이 로그에 찍히지 않게).
2. 코드 변경 PR (별도): `generationHttp`가 **승인된 runtime만** paid를 허용하도록 게이트  
   - 예: env `PLANOS_AI_ALLOW_PAID=true` **그리고** 캡>0 **그리고** 키 존재일 때만 `allowPaidCalls` 서버 측 true  
   - 클라이언트 `allowPaidCalls`는 계속 무시
3. Preview 배포 → `POST /api/ai/generate` 응답 `mode` / `providerId` / budget 필드 확인
4. 캡을 낮춰 `budget_blocked` 경로 1회 확인
5. 이상 없으면 한도만 운영값으로 상향 (Production은 **별도 Gate E**)

---

## 롤백

1. 서버 env `PLANOS_AI_ALLOW_PAID` 제거 또는 false · 캡을 0으로
2. 필요 시 키 회전/삭제
3. 코드가 강제 false면 재배포로 placeholder 복귀

---

## 완료 기준 (Gate C-LLM PASS · Preview)

- Placeholder 경로는 회귀 없이 유지
- 승인 env에서만 paid 성공 1회 + 예산 차단 1회
- 브라우저 번들에 키 없음 (정적 분석/네트워크)
- Production·ops 키 미배포

---

## 관련 코드·문서

- `src/server/ai/generationHttp.ts` · `generationBff.ts` · `budget.ts` · `secrets.ts`
- [`AI_BFF_RUNTIME_CONTRACT_2026-10-24.md`](../engineering/AI_BFF_RUNTIME_CONTRACT_2026-10-24.md)
- [`PREVIEW_027_APPLY_RUNBOOK_2026-10-25.md`](./PREVIEW_027_APPLY_RUNBOOK_2026-10-25.md) — DB 영속(막바지)
- [`PLANOS_RELEASE_TEST_GATES_2026-10-23.md`](./PLANOS_RELEASE_TEST_GATES_2026-10-23.md)
