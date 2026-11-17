# PlanOS — 미구현 개발 착수 계획 (2026-11-17)

기준 SHA: `c7d7ab1` (로컬 dirty: Gemini/CrewAI Mock 제거·문서·gitignore 정리 중)  
범위: Preview(`fydngfylpzdwvjyuqhdm`) 실데이터 + 무과금 OSS 우선  
금지: Gate C 유료 LLM 자동 과금 · 운영 DB 마이그레이션 · main 무단 merge · customer 데이터 외부 유료 전송

관련: [FREE_OPEN_SOURCE_CONNECTIONS](../engineering/FREE_OPEN_SOURCE_CONNECTIONS_2026-11-17.md) · [REMAINING_DEV_CHECKLIST](./REMAINING_DEV_CHECKLIST_2026-10-25.md) · Issue #32

---

## 0. 착수 전 게이트 (이 PR 묶음에서 먼저)

| ID | 작업 | 완료 기준 | 승인 |
|----|------|-----------|------|
| G0-1 | dirty Mock→실경로 변경을 feature 브랜치로 커밋 | `git status` clean on feature branch | 사용자 커밋 지시 |
| G0-2 | Preview env: `GEMINI_API_KEY`, worker allowlist, Liner 키 | Vercel READY + `/api/ai/generate` `mode=gemini` | 키는 이미 투입됨 — 회귀만 |
| G0-3 | E2E/픽스처가 Preview/실 CTA와 불일치하면 스킵·수정 목록화 | 실패 원인 = “픽스처 잔존” vs “실버그” 구분 | 없음 |

**다음 코드 한 방(권장):** G0-1 후 **Slice 1**부터.

---

## 1. 슬라이스 순서 (한 번에 하나)

### Slice 1 — E2E·픽스처를 실 CTA에 맞춤  
**F/TF/N:** QA 게이트 (기능 ID 없음, 회귀 보호)  
**목표:** Specialist/카탈로그/PM 초안이 Mock CTA·fixture-only를 더 이상 기대하지 않게 한다.  
**코드 예상:** Playwright/E2E 셀렉터, `data-testid`, fixture seed vs Preview seed 분리.  
**수락:** Chromium E2E PASS 또는 “Preview-only skip + 이유” 문서화.  
**롤백:** E2E만 되돌림, 앱 동작 무영향.  
**OSS:** 해당 없음.  
**진행:** CTA 매트릭스 → [SLICE1_E2E_CTA_MATRIX_2026-11-17](./SLICE1_E2E_CTA_MATRIX_2026-11-17.md). Mock 버튼은 `VITE_ALLOW_MOCK_AI_RUN`(F-B/F-C) 또는 fixtureMode만.

### Slice 2 — DDL 027 초안 확정 (적용은 별 승인)  
**F/TF/N:** F-401/F-402 주변 계약 · STAFF DDL TARGET  
**목표:** `supabase/drafts` 027 스키마를 “적용 가능한 초안”으로 고정. **Preview/운영에 apply 금지** until 명시 승인.  
**코드 예상:** draft SQL 리뷰, RLS 스케치, migration 번호 충돌 체크.  
**수락:** 초안 리뷰 코멘트 반영 + “apply 체크리스트” 문서.  
**롤백:** draft만 삭제/수정.  
**OSS:** 해당 없음.

### Slice 3 — F-105 LocalStorage → Preview/서버 경로  
**F/TF/N:** F-105 · 관련 TF는 FUNCTIONAL_SPEC 대조  
**목표:** 브라우저 LS에만 있던 상태를 Preview JWT+RLS 경로로 이전(또는 이중쓰기 후 cutover).  
**수락:** 시크릿 창·다른 브라우저에서 동일 사용자 데이터 재현.  
**롤백:** feature flag로 LS fallback.  
**OSS:** 해당 없음.

### Slice 4 — 초대 메일: mock → 무료/무과금 경로만  
**F/TF/N:** 초대 플로우 (PERMISSIONS / member invite)  
**목표:** mock 초대 UI를 실제 발송 또는 “발송 대기 큐+매뉴얼”로. **유료 SMTP면 보류.**  
**수락:** Preview에서 owner 초대 → DB row + (무료 티어면) 메일 또는 명확한 “대기” 상태.  
**롤백:** mock 라벨 복귀.  
**OSS/비용:** 무료 티어만; 아니면 큐만.

### Slice 5 — AI PM 실경로 확장 (CrewAI 줄기만)  
**F/TF/N:** F-401 draft → F-402 owner approve → S1 link (Issue #32)  
**목표:** PM 초안(Gemini BFF) 이후 **실행 큐**를 Specialist와 같은 CrewAI worker 패턴으로 확장. MetaGPT/Agency/OpenHands **설치 금지**.  
**수락:** owner 승인 ≠ 자동 유료 실행; `plan.approved`와 execution/consent 상태 분리 유지; Mock 라벨 없음.  
**롤백:** Gemini draft-only로 축소.  
**OSS:** CrewAI + 기존 Liner/Gemini 크레딧 캡.

### Slice 6 — N29 / F-801 (PlanOS first)  
**F/TF/N:** N29 · F-801  
**목표:** 스펙·화면 매트릭스 기준으로 최소 실경로 1개. OpenClaw 끼워 넣지 않음.  
**수락:** C/N acceptance 항목 PASS 목록.  
**롤백:** feature flag off.  
**OSS:** Phase 4 후보와 분리.

---

## 2. Phase 4 (착수 계획에는 넣되 **지금 코딩 안 함**)

| 후보 | 조건 | 비고 |
|------|------|------|
| OpenHands | 샌드박스 + 승인 UI + 무과금/로컬 모델 | Phase 4 문서만 |
| OpenClaw | OpenHands 이후 · 도구 권한 화이트리스트 | 더 나중 |

---

## 3. PR 쪼개기 규칙

1. 슬라이스 = PR 1개 (또는 draft PR 1개).  
2. 문서(F/TF/N 정정)는 **같은 PR**에서 계약이 바뀌면 함께.  
3. DDL apply · main merge · 운영 배포 · 결제/유료 provider = **사용자 명시 승인 후**.  
4. “연결됨” OSS 표 갱신은 코드 연결 PR과 동기 ([FREE_OPEN_SOURCE_CONNECTIONS](../engineering/FREE_OPEN_SOURCE_CONNECTIONS_2026-11-17.md) §7).

---

## 4. 슬라이스별 최소 테스트 매트릭스

| Slice | lint/build | 실 JWT/RLS | Chromium | 비고 |
|-------|------------|------------|----------|------|
| 1 | PASS | NOT RUN ok | PASS 또는 skip 문서 | Preview seed |
| 2 | N/A SQL review | NOT RUN (apply 전) | N/A | drafts only |
| 3 | PASS | PASS Preview | PASS | LS fallback flag |
| 4 | PASS | PASS | PASS | 유료 SMTP면 FAIL→보류 |
| 5 | PASS | PASS | PASS | consent≠execution |
| 6 | PASS | PASS | PASS | OpenClaw 없음 |

보고 시 각 항목 PASS/FAIL/NOT RUN + SHA + workflow URL.

---

## 5. 완료 보고 템플릿 (슬라이스마다)

- source SHA + branch/PR  
- F-ID / TF-ID / N-ID  
- 변경 요약 + 증거  
- 테스트 매트릭스  
- 수정·잔여 P0/P1/P2  
- 사용자 승인 필요 항목  
- **다음 코드 한 방**

문서만 쓰고 “done” 금지.

---

## 6. 즉시 다음 한 방

1. 현재 dirty 변경을 feature 브랜치에 커밋 (사용자 지시 시).  
2. **Slice 1** E2E/픽스처 정렬 착수.  
3. Slice 2~6은 1 완료 후 순차.

제외 확정: MetaGPT 런타임, Agency Swarm, FreeLLMAPI 제품 경로, OpenHands/OpenClaw 조기 설치, Gate C 자동 과금.
