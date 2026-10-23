# 배포 전환 계획 — PlanOS G1 통합 브랜치 (PR #30)

작성일: 2026-10-22  
**갱신:** 2026-10-23 — PM(022~024)·C04(025)·026 및 Preview는  
[`PLANOS_MASTER_DEVELOPMENT_PLAN_2026-10-23.md`](./PLANOS_MASTER_DEVELOPMENT_PLAN_2026-10-23.md) ·  
[`PLANOS_RELEASE_TEST_GATES_2026-10-23.md`](./PLANOS_RELEASE_TEST_GATES_2026-10-23.md) 정본을 따른다.  
대상 브랜치: `feat/planos-g1-integration-stage-a-20261021` (+ 스택 tip `preview/planos-integrated-20261023`)  
상태: **계획만 작성. 운영 DB 적용·main 병합·Vercel Production 배포는 사용자 승인 전 실행하지 않는다.**

### 2026-10-23 / V1.1 — 운영 적용 전체 순서 (승인 후, §3과 단일 표로 정합)

아래가 **유일한 적용 순서**다. §3 표와 이 표가 어긋나면 **이 표(V1.1)가 우선**한다.

| 순서 | 마이그레이션 | 대역 |
|---|---|---|
| 1 | `013_fix_project_members_select_recursion.sql` | G1 |
| 2 | `014_harden_comments_notifications_versions.sql` | G1 |
| 3 | `015_atomic_document_version_restore.sql` | G1 |
| 4 | `016_atomic_chat_document_edit.sql` | G1 |
| 5 | `018_document_revision_cas.sql` | G1 |
| 6 | `019_harden_can_edit_null_check.sql` | G1 |
| 7 | `011_project_tasks.sql` (**운영 미적용인 경우에만**) | S1 |
| 8 | `020_task_conflict_sqlstate.sql` | S1 |
| 9 | `022_pm_plan_review_loop.sql` | 사람 PM |
| 10 | `023_pm_plan_integrity_hardening.sql` | 사람 PM |
| 11 | `024_pm_plan_final_integrity.sql` | 사람 PM |
| 12 | `025_dashboard_aggregation_rpcs.sql` | C04 |
| 13 | `026_reassert_document_versions_append_only.sql` | 무결성 |

`supabase/drafts/*` (017, 021)는 계속 **적용 금지**.  
Preview Vercel 프로젝트(`planos-preview`)는 Git disconnect 상태 — **main 자동배포와 무관**.

**병합 vs DB (V1.1):** 운영에서는 **위 표 적용·검증 → 그다음** main에 PR **#30 → #36 → #42** 순 병합. “코드 먼저 병합 후 DB”는 금지.

## 1. 확인된 현황 (저장소 기준, 변경 없음)

| 항목 | 확인 결과 | 비고 |
|---|---|---|
| 운영 Supabase 마이그레이션 적용 상태 | **미확인** | 운영 DB에 접속하지 않았다. 적용 여부는 §2의 사전 점검 절차로 배포 승인 후 확인한다. 이 저장소는 `schema_migrations` 테이블에 의존하지 않고 마이그레이션 파일을 psql로 직접 적용하는 방식이라, 적용 여부는 객체 존재 여부로 확인해야 한다. |
| Vercel 자동 배포 | **저장소만으로는 확정 불가** | `vercel.json`이 없고 GitHub Actions에 배포 워크플로가 없다. Vercel 프로젝트가 GitHub 저장소와 연동돼 있으면 main 병합 시 자동 배포될 수 있으므로, 병합 승인 전에 Vercel 대시보드(Settings → Git)에서 연동·자동 배포 설정을 확인할 것. |
| 코드 ↔ DB 의존성 | **DB가 코드보다 먼저** | PR #30 코드는 `documents.content_revision` 컬럼과 `save_document_content_cas` RPC(마이그레이션 018)를 전제로 한다. 코드가 먼저 배포되면 운영 DB에서 문서 읽기/쓰기가 깨진다. §3의 순서를 반드시 지킨다. |

## 2. 배포 전 사전 점검 (운영 DB, 읽기 전용)

배포 승인이 나면 아래를 먼저 실행해 현재 적용 상태를 확정한다. 쓰기 작업은 하지 않는다.

1. 대상 프로젝트가 운영 프로젝트인지 대시보드에서 확인 (로컬/스테이징 링크와 혼동 금지).
2. 아래 객체 존재 여부를 SQL Editor(읽기 전용 SELECT)로 확인한다.

   - `public.documents.content_revision` 컬럼 — 없으면 018 미적용
   - 함수 `public.save_document_content_cas` — 없으면 018 미적용
   - 함수 `public.validate_project_task_change` 본문에 `P4001` 포함 여부 — 없으면 020 미적용 (011 자체가 없으면 `public.project_tasks` 테이블도 없다)
   - 정책 `documents_update_editor` 존재 여부 — 021 컷오버 draft는 **이번 배포에서 적용하지 않으므로 남아 있어야 정상**

3. `select table_name from information_schema.tables where table_schema='public'`로 011(project_tasks)·012(audit_source_manifests) 적용 여부도 확인한다. 011 파일 상단 주석은 "운영 검토 전 적용 금지"로 돼 있어 미적용일 수 있다.

## 3. 적용 순서 (승인 후, 운영 DB)

운영에 이미 적용된 마이그레이션은 건너뛰고, 누락분만 **문서 상단 V1.1 전체 표(순서 1~13)** 를 지킨다.  
(구 §3이 013~020만 나열해 022~026과 표가 둘로 갈라져 있던 모순은 V1.1에서 해소.)

적용 금지:

- `supabase/drafts/017_document_revision_cas_DRAFT.sql` — 격리된 초안. 어떤 경우에도 운영에 적용하지 않는다 (018과 중복·충돌).
- `supabase/drafts/021_cutover_deny_direct_document_update_DRAFT.sql` — 직접 UPDATE 컷오버. 구버전 클라이언트 확인 전까지 적용 금지.

각 파일은 `psql -v ON_ERROR_STOP=1`로 하나씩 적용하고, 실패 시 즉시 중단한다. 적용 직후 §2의 확인 쿼리를 다시 실행해 의도한 상태가 됐는지 검증한다.

## 4. DB 백업

마이그레이션을 하나라도 적용하기 전에 아래 둘 중 하나를 완료하고 보관 위치를 기록한다.

- Supabase 대시보드의 백업/PITR 상태 확인 (플랜에 따라 자동 백업 유무가 다르다), 또는
- `pg_dump`로 스키마+데이터 전체 덤프를 배포 작업자 로컬에 저장 (운영 비밀번호는 채팅·커밋에 남기지 않는다, 환경변수로만 전달).

## 5. 코드 배포 (DB 확인 후에만)

1. DB §3 적용이 검증된 뒤에 main 병합 승인을 받는다.
2. Vercel이 GitHub 연동 자동 배포면 병합 즉시 배포가 시작되므로, §1의 대시보드 확인을 병합 전에 마친다. 자동 배포가 아니면 병합 후 대시보드에서 수동으로 배포를 시작한다.
3. 배포 후 검증:
   - 로그인 → 프로젝트 열기 → 문서 탭 표시 (읽기 경로)
   - 문서 수정 후 자동저장 성공 표시, 오래된 탭에서 저장 시 충돌 안내 (CAS 경로)
   - 업무 탭에서 업무 상태 변경 1회 (020 경로)
   - 브라우저 콘솔·네트워크에 4xx/5xx 반복이 없는지 확인

## 6. 기존 클라이언트 호환성

| 조합 | 결과 |
|---|---|
| 신 코드 + 구 DB (018 없음) | **깨짐.** `content_revision` 조회 실패로 문서 기능이 동작하지 않는다. → §3을 먼저 적용하는 이유. |
| 구 코드 + 신 DB (018~020 적용 후) | 문서: 무조건 UPDATE가 트리거로 revision을 전진시키므로 CAS를 쓰는 신 클라이언트와 섞여도 탐지 가능 상태 유지. 업무: 구 클라이언트의 version 필터 방식은 020 이후에도 동일하게 동작. 충돌 시 에러 코드만 P4001로 바뀌며 결과(거부·원본 보존)는 같다. |
| 021 컷오버를 섞는 경우 | 금지 (§3). 구 코드의 직접 UPDATE가 0행 처리돼 문서 저장이 조용히 실패하므로, 모든 클라이언트가 신 코드임이 확인된 뒤 별도 배포로만 진행한다. |

## 7. 오류 발생 시 복구

| 상황 | 복구 방법 |
|---|---|
| 마이그레이션 적용 중 실패 | `ON_ERROR_STOP=1`로 중단된 파일까지만 적용된 상태다. 각 파일은 자체 트랜잭션 단위가 아니므로, 실패 지점의 부분 적용 여부를 객체 확인 후 같은 파일을 재실행하거나(파일들은 `create or replace`·`if exists` 중심이라 재실행 안전성을 파일 단위로 먼저 검토), §4 백업에서 복원한다. |
| 적용 후 문서 기능 이상 | 코드 배포 전이면 Vercel에서 이전 배포로 롤백할 필요가 없다 — DB만 되돌린다: 018의 `content_revision` 컬럼과 CAS RPC는 구 코드가 참조하지 않으므로 남겨둬도 무해하다. 급하면 컬럼/RPC를 drop 하지 말고 코드 롤백을 먼저 검토한다. |
| 적용 후 업무 기능 이상 | 020은 함수 본문 재정의뿐이므로, 011 원본 함수 정의를 다시 `create or replace`하면 즉시 원상 복구된다 (errcode가 40001로 돌아가나 기능 자체는 복구; PostgREST 지연 위험은 되살아나므로 응급 조치로만). |
| 데이터 손상 의심 | §4 백업으로 복원. Supabase 플랜에 PITR이 있으면 시점 복원을 우선 검토한다. |

## 8. 승인 게이트 (전부 별도 승인 필요)

1. 운영 DB 읽기 점검(§2) 승인
2. 운영 DB 백업(§4) + 마이그레이션 적용(§3) 승인
3. main 병합 승인 (+ Vercel 배포 방식 확인)
4. (후속 별도 건) 021 컷오버 채택 승인

## 9. 이번 작업에서 하지 않은 것

- 운영 Supabase 접속·변경, main 병합, Vercel 배포를 실행하지 않았다.
- 021 컷오버는 draft와 격리 리허설까지만 존재하며 정식 마이그레이션이 아니다.
