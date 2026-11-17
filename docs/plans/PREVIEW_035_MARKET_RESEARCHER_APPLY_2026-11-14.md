# Preview 035 시장조사 계약 적용 메모 (2026-11-14)

대상: **PlanOS-Preview만** (`fydngfylpzdwvjyuqhdm`) · ops/Production 금지  
프론트: `planos-preview` ← `main` @ `c7d7ab1` 수동 배포 완료 (2026-11-14)

## 적용 기록 (2026-11-14)

Preview DB에 아래를 **순서대로** 적용함 (ops `Plan OS` 미변경):

1. `029_agent_contracts_mvp.sql` PASS  
2. `030_ai_runs_mock_worker.sql` PASS  
3. `031_ai_artifacts_accept_s1.sql` PASS  
4. `034_crewai_worker_rpcs.sql` PASS  
5. `035_market_researcher_agent.sql` PASS  
6. `NOTIFY pgrst, 'reload schema'` 실행  

검증: `create_market_research_contract_draft`, `claim_crewai_ai_run`, `enqueue_ai_run` 존재.

## 참고 (loopback 스크립트는 호스티드 거부)

`scripts/apply-035-*-local-only.mjs`는 loopback만 허용한다. Preview 적용은 CLI
`supabase db query --remote=fydngfylpzdwvjyuqhdm` 로 수행했다.

확인 SQL:

```sql
select to_regprocedure(
  'public.create_market_research_contract_draft(uuid,text,text,uuid,bigint,uuid,text,text,text,text,timestamptz)'
);
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'public.agent_contracts'::regclass
   and conname like '%agent_slug%';
```

## 워커

Preview에서 큐에 넣은 뒤 완료하려면 `LINER_API_KEY` + service role로 **loopback이 아닌** Preview API를 허용한 워커가 필요하다.  
현재 워커 기본값은 loopback-only → Preview 실완료는 별도 호스팅/승인 후.
