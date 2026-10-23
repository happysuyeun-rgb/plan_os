# 운영 DB 읽기 전용 점검 · 백업·복구 계획 (2026-10-23)

**상태:** 절차 완성. **운영 접속·쓰기·마이그레이션 적용은 사용자 승인 전 금지.**  
대상 스택 마이그레이션: DEPLOYMENT V1.1 표 순서 1~13 (`013`…`026`). drafts `017`/`021` 적용 금지.

---

## A. 읽기 전용 점검 (승인 후, SQL Editor SELECT만)

### A0. 대상 확인

1. Supabase Dashboard에서 **운영** 프로젝트 ref가 Preview(`PlanOS-Preview` / `fydngfylpzdwvjyuqhdm`)·로컬과 **다른지** 확인.
2. 작업자 계정은 read-only 역할 또는 SQL Editor에서 SELECT만 실행.

### A1. 객체 존재 매트릭스 (결과표를 Issue #41에 붙일 것)

| Mig | 확인 SQL (요지) | 기대 |
|---|---|---|
| 018 | `information_schema.columns` where `content_revision` on `documents` | 1행 |
| 018 | `pg_proc` / `to_regprocedure('public.save_document_content_cas(...)')` | non-null |
| 011 | `to_regclass('public.project_tasks')` | non-null 또는 null(미적용) |
| 020 | `prosrc` of `validate_project_task_change` contains `P4001` | true if 020 |
| 014/026 | `document_versions`에 UPDATE policy 없음; UPDATE GRANT 없음 | append-only |
| 022 | `to_regclass('public.pm_plans')` | non-null if PM |
| 025 | dashboard aggregate RPC 존재 | non-null if C04 |
| 021 draft | `documents_update_editor` policy **존재** | 컷오버 미적용이면 정상 |

예시 (읽기 전용):

```sql
select column_name from information_schema.columns
 where table_schema='public' and table_name='documents' and column_name='content_revision';

select to_regclass('public.project_tasks') as project_tasks,
       to_regclass('public.pm_plans') as pm_plans;

select p.proname
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'
   and p.proname in (
     'save_document_content_cas','validate_project_task_change',
     'create_pm_plan','transition_pm_plan'
   );

select polname from pg_policy
 where polrelid='public.document_versions'::regclass;
```

### A2. 산출물

- 체크표: mig별 `적용됨 / 미적용 / 불명`
- 스크린샷 또는 쿼리 결과 붙여넣기 (비밀·데이터 행 제외)
- **이번 작업에서는 실행하지 않음** — 승인 대기

---

## B. 백업 (mig 적용 **전**, 승인 후)

| 단계 | 내용 | 완료 기록 |
|---|---|---|
| B1 | Supabase 플랜의 PITR/일일 백업 가능 여부 Dashboard에서 확인 | 일시·플랜 |
| B2 | (권장) `pg_dump` 스키마+데이터 → 작업자 로컬 암호화 저장. 비밀번호는 env만 | 경로·시각 (채팅 금지) |
| B3 | 복원 리허설 가능 여부(스테이징) 메모 | optional |

복원 우선순위: **PITR 시점 복원** → 없으면 `pg_dump` 복원.

---

## C. 복구 런북 (요약)

| 실패 지점 | 조치 |
|---|---|
| mig 파일 중간 실패 | `ON_ERROR_STOP` 중단 → 객체 확인 → 같은 파일 재실행 가능 여부 검토 또는 B 백업 복원 |
| 코드만 이상 (DB OK) | Vercel Production 이전 배포 롤백 (승인 후) |
| 020만 문제 | 011 원본 함수 재적용 (응급) |
| 데이터 손상 | PITR / dump 복원 |

상세: `DEPLOYMENT_TRANSITION_PLAN_2026-10-22.md` §7.

---

## D. 승인 요청 묶음 (아직 받지 않음)

1. 운영 DB **read-only** 점검 실행 승인  
2. 백업 수행 + mig 001~026 누락분 적용 승인  
3. main 병합 + Production 배포 방식 확정 승인  
