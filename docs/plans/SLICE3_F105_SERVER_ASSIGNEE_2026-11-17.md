# Slice 3 — F-105 assignee LS → 서버 이중쓰기 · 2026-11-17

부모: [UNIMPLEMENTED_KICKOFF_PLAN](./UNIMPLEMENTED_KICKOFF_PLAN_2026-11-17.md)  
스펙: FUNCTIONAL_SPEC F-105 (CURRENT Mock LS → TARGET DB `assignee_kind`)

## 구현 요약

| 경로 | 동작 |
|------|------|
| 기본 | `localStorage` user+project 스코프 (기존 F105-02) |
| 옵트인 | `VITE_F105_SERVER_ASSIGNEE=true` + `VITE_S1_SERVER_TASKS=true` |
| SQL | `supabase/local_only/036_task_assignee_kind.sql` (migrations 아님) |
| 폴백 | 컬럼 부재 시 assigneeId만 패치 + LS 유지 |

AI 지정 ≠ 채용·실행·과금. 허용 role: `requirements_auditor_v1`만.

## Apply 체크리스트 (미실행)

- [ ] disposable에 036 적용 후 플래그 on → 시크릿 창 동일 kind
- [ ] Preview 036 적용 = **별도 사용자 승인** (Slice 2와 동일 금지 규칙)
- [ ] ops/Production 금지

## 롤백

1. env에서 `VITE_F105_SERVER_ASSIGNEE` 제거 → LS only  
2. 컬럼 DROP은 별도 승인

## 테스트

| 항목 | 기대 |
|------|------|
| `tests/s1-f105-ai-assignee-mock.test.mjs` | PASS (LS + UI 계약) |
| `tests/slice3-f105-server-assignee-contract.test.mjs` | PASS (정적) |
| Preview JWT 이중쓰기 | NOT RUN until 036 approved |
