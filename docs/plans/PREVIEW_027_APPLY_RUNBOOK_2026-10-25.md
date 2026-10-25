# Preview 027 AI review 적용 런북 (Gate A-027)

기준: `main` @ `ec3ab6b` (#46 Mock MVP + local server-store CI)  
작성: 2026-10-25 · **이 문서만으로는 호스티드 DB에 쓰지 않는다.**

---

## 목적

`supabase/local_only/027_ai_review_jobs.sql` 스키마를 **PlanOS-Preview** DB에만 올린 뒤, Vercel Preview에서 `VITE_AI_REVIEW_STORE=server`로 검수 job 영속을 검증한다.

운영(ops)·Production·`supabase/migrations/` 승격은 **이 게이트 범위 밖**.

---

## 금지 (위반 시 중단)

| 금지 | 이유 |
|---|---|
| `scripts/apply-027-local-only.mjs`로 Preview/ops 적용 | loopback 전용 · hosted env 거부 |
| `supabase db push` / migrations에 027 편입 | 자동 호스티드 적용 경로 |
| ops / Production SQL 실행 | Gate D · OPS_DB 읽기 전용 계약 |
| 유료 LLM 키를 이 게이트에 묶기 | Wave 2 별도 게이트 |
| 승인 기록 없이 Vercel env를 `server`로 전환 | 스키마 없는 server-store는 런타임 실패 |

실행 SQL 정본: [`supabase/local_only/027_ai_review_jobs.sql`](../../supabase/local_only/027_ai_review_jobs.sql)  
포인터: [`supabase/drafts/027_ai_review_jobs_DRAFT.sql`](../../supabase/drafts/027_ai_review_jobs_DRAFT.sql)

---

## 승인 체크리스트 (적용 전 · 전부 ☑)

- [ ] **명시 승인:** Preview DB에 027 적용 (ops 제외) — 승인자·일시 기록
- [ ] 대상 프로젝트 = **PlanOS-Preview** (ops ref와 분리 — `OPS_DB_READONLY_AUDIT_AND_BACKUP`)
- [ ] Preview **백업 / PITR** 가능 확인
- [ ] 읽기 전용으로 사전 부재 확인 (아래 SQL)
- [ ] 적용 창구 = Supabase SQL Editor 또는 **Preview 전용** allowlist 스크립트 (아직 없음 → 수동)
- [ ] 적용 후 PostgREST 스키마 반영 확인 (`NOTIFY pgrst, 'reload schema'` 또는 대시보드 reload)
- [ ] Vercel Preview env 변경은 **스키마 검증 후**만

---

## 읽기 전용 사전/사후 확인 SQL

Preview SQL Editor에서 **SELECT만** 실행.

```sql
-- 사전: 테이블/함수 부재 기대
select to_regclass('public.ai_review_jobs') as jobs;
select to_regclass('public.ai_review_findings') as findings;
select to_regclass('public.ai_review_finding_tasks') as finding_tasks;
select proname from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname in ('cas_ai_review_job', 'bind_ai_review_finding_task');

-- 사후: 모두 존재
select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'ai_review_jobs'
  order by ordinal_position;
-- 기대 컬럼 포함: source_manifest, insufficient_input, row_version, accepted_finding_task_ids
```

---

## 적용 절차 (승인 후 · 사람 수동)

1. Preview SQL Editor에 `supabase/local_only/027_ai_review_jobs.sql` 전문 붙여넣기 (`ON_ERROR_STOP` 가능하면 사용).
2. 실행 → 에러 시 **즉시 중단** · 부분 적용 상태를 메모.
3. `NOTIFY pgrst, 'reload schema';` (또는 Dashboard API schema reload).
4. 사후 SELECT로 테이블·RPC·RLS 정책 존재 확인.
5. (선택) disposable과 동일 시나리오: editor insert job / finding · CAS bump · viewer read · outsider empty.
6. Vercel Preview env:
   - `VITE_AI_REVIEW_STORE=server`
   - 수락→S1 FK가 필요하면 `VITE_S1_SERVER_TASKS=true`
7. Preview 재배포 후 스모크: `/projects/:id/ai-review` · hire→run→accept→reload · DevTools에 **ops Supabase ref 없음**.

---

## 롤백 / 비활성화

| 단계 | 조치 |
|---|---|
| 즉시 | Vercel Preview env `VITE_AI_REVIEW_STORE` 제거 또는 `browser` → 재배포 (앱은 Mock·localStorage) |
| 스키마 | 테이블 DROP은 **별도 승인** (데이터 손실). 기본은 env 롤백만 |
| ops | 변경 없음이어야 함 — 네트워크/ref 재확인 |

---

## 완료 기준 (Gate A-027 PASS)

- Preview에 `ai_review_*` + CAS/bind RPC 존재
- Preview env `server` (+ 필요 시 S1 server tasks)
- Owner/Editor: Mock 검수 → 수락 → S1 → 새로고침 후 job 유지
- Viewer: 실행 불가 · 조회만
- ops DB·Production 미변경

PASS 후 다음 후보: 유료 LLM 게이트 · AI 채용 UX (Phase E).

---

## 관련 문서

- [`PLANOS_RELEASE_TEST_GATES_2026-10-23.md`](./PLANOS_RELEASE_TEST_GATES_2026-10-23.md) — Gate D 호스티드 027 금지 · 본 런북 = Preview-only 예외 절차
- [`PHASE_A_PREVIEW_AUTO_VS_MANUAL_2026-10-23.md`](./PHASE_A_PREVIEW_AUTO_VS_MANUAL_2026-10-23.md)
- [`DEPLOYMENT_TRANSITION_PLAN_2026-10-22.md`](./DEPLOYMENT_TRANSITION_PLAN_2026-10-22.md)
- [`docs/PROGRESS_STATUS.md`](../PROGRESS_STATUS.md)
