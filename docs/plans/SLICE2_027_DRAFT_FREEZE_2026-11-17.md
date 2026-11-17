# Slice 2 — DDL 027 초안 확정 (apply 금지) · 2026-11-17

부모: [UNIMPLEMENTED_KICKOFF_PLAN](./UNIMPLEMENTED_KICKOFF_PLAN_2026-11-17.md)  
런북: [PREVIEW_027_APPLY_RUNBOOK](./PREVIEW_027_APPLY_RUNBOOK_2026-10-25.md)  
보류: [DEFERRED_GATES_REMAINING_IMPL](./DEFERRED_GATES_REMAINING_IMPL_2026-11-08.md)

## 동결 정본

| 항목 | 값 |
|------|-----|
| Executable SQL | `supabase/local_only/027_ai_review_jobs.sql` |
| Draft pointer | `supabase/drafts/027_ai_review_jobs_DRAFT.sql` |
| SHA256 | `a426460752c875f57e90d4d2736b668c54f5fafd7e18387960ceb81a1f6e0457` |
| Size | 10270 bytes |
| `supabase/migrations/027_*` | **없음** (의도적 — 026 다음 028) |
| Local apply | `scripts/apply-027-local-only.mjs` (loopback only) |

## 스키마 ↔ 앱 계약 (리뷰 요약)

| 객체 | 역할 | 앱 참조 |
|------|------|---------|
| `ai_review_jobs` | job + `row_version` CAS + manifest | `serverReviewJobStore.ts` |
| `ai_review_findings` | finding rows | insert/select |
| `ai_review_finding_tasks` | finding↔S1 task idempotent | bind RPC |
| `cas_ai_review_job` | version bump · `P4001` conflict | RPC |
| `bind_ai_review_finding_task` | on conflict do nothing | RPC |
| RLS | member read · editor write · no client DELETE | `can_access` / `can_edit` |

## Apply 체크리스트 (아직 실행하지 않음)

**Slice 2 완료 = 초안 동결만. 아래는 사용자 승인 후 Gate A-027.**

- [ ] 사용자 명시 승인: Preview DB에 027 적용 (ops 제외)
- [ ] Preview 백업/PITR 확인
- [ ] 읽기 전용 사전 SELECT (`to_regclass` null 기대)
- [ ] SQL Editor에 **local_only** 전문 수동 적용 (apply-027-local-only.mjs로 hosted 금지)
- [ ] `NOTIFY pgrst, 'reload schema'`
- [ ] 사후 SELECT + CAS smoke
- [ ] 그 다음에만 Vercel `VITE_AI_REVIEW_STORE=server`
- [ ] ops / Production / `migrations/` 승격 = 별도 게이트

## 롤백

1. env를 `browser`로 되돌림 (스키마 DROP 기본 안 함)
2. SQL 내용 변경 시 SHA256·본 문서·DRAFT pointer를 **같은 PR**에서 갱신

## 테스트

| 항목 | 결과 |
|------|------|
| 정적 계약 `tests/slice2-027-draft-contract.test.mjs` | 이 PR에서 실행 |
| disposable `apply-027-local-only` | NOT RUN unless local stack up |
| Preview/ops apply | **NOT RUN / 금지** |

## 다음 슬라이스

Slice 3 — F-105 LocalStorage → Preview/서버 (027 apply와 무관하게 진행 가능; server-store는 027 승인 후 완전 영속).
