# PlanOS B/C/D 정렬 감사 (2026-10-24)

**범위:** GitHub 실측 · PR #45 · 정본 문서 일치 · P0/P1 누락.  
**금지 준수:** 운영 DB 쓰기 · 027 운영 적용 · 유료 LLM · main 병합 · Production — **미실행**.

## P0 결과

| # | 항목 | 판정 | 조치 |
|---|---|---|---|
| 1 | 운영 009·010 | **파일명 없음** → 후속 **013/014**가 보안·RLS 역할 승계. 운영 쓰기 없이 문서 정정 | 문서에 재번호 명시 |
| 2 | PR #44 vs #45 | #44 foundation OPEN · #45가 **정본 후속**. 중복 병합 금지 | 로드맵에 계보 표기 |
| 3 | Vite BFF vs Preview API | 계약 문서 + `api/ai/generate.ts` + `vercel.json` `/api` 제외 | 유지 |
| 4 | Owner/Editor/Viewer | `ai.review.*` + UI 게이트 | 단위 테스트 |
| 5 | S1 플래그 OFF/ON | 목록·상세·AI accept 동일 분기 | `s1-flag-paths.test.mjs` |

## P1 결과

| # | 항목 | 판정 |
|---|---|---|
| 영속 어댑터 | 브라우저 `BROWSER_LOCAL_V1` 코드완료 · 027 DRAFT만 |
| 인용 | offset=quote · revision |
| 멱등·CAS | finding→task · putCas |
| 재검수 연결 | `parentReviewJobId` · `sourceTaskId` (코드+027 초안) |
| 재접속 | listByProject + UI reload |
| 유료 차단 | BFF `allowPaidCalls: false` |

## 제품 이중 경로

| 경로 | 코드 | 상태 |
|---|---|---|
| 직접 진행 (문서·채팅·버전) | DocumentPage 등 | 유지 |
| 사람 PM | PmPlan* · 022~024 | main 병합 |
| Mock 기획 검수 직원 | `/ai-review` | PR #45 |
| AI PM / 채용(E) | — | **미구현** (문서만) |

기존 사람 PM·문서 기능을 Mock으로 대체하지 않음.
