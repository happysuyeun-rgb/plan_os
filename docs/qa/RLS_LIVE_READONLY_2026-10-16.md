# PlanOS — 활성화된 Supabase 실제 RLS 읽기 전용 감사

**최초 작성일:** 2026-10-16  
**최종 수정일:** 2026-10-16  
**문서 버전:** v1.2  
**진행 상태:** 실제 운영 DB READ ONLY 진단, 격리 PostgreSQL 17 SQL 테스트·격리 로컬 Supabase Auth/JWT/REST 통합 테스트 PASS / 브라우저·운영 반영 미진행  
**프로젝트:** Plan OS (`ggviusdmxalsflyybamm`)  
**연결:** [Issue #12](https://github.com/happysuyeun-rgb/plan_os/issues/12) · [RLS 수정 제안](../../supabase/migrations/009_fix_project_members_select_recursion.sql) · [기존 기술 감사](../engineering/BASELINE_AUDIT.md)

## 1. 실제 조회 확인 (운영 데이터 미수정)
- Supabase Plan OS 상태: **ACTIVE_HEALTHY** (이전 INACTIVE 기록은 과거 이력).
- 적용 마이그레이션 목록: **001~008 확인**. `009`는 GitHub 초안일 뿐 실제 DB에는 적용하지 않음.
- 개발 DB 브랜치: **0개**. 따라서 DML/정책 수정 및 가짜 사용자 fixture 작성은 금지.
- `public`의 기존 테이블 **12개 모두 RLS 활성화** 확인. RLS가 켜졌다고 행위별 접근 통제가 안전하다는 뜻은 아님.
- 시스템 뷰 `pg_policies` / `pg_proc` / `pg_roles` / `pg_class`를 SELECT로 조사. 원본 고객 데이터·비밀번호·비밀키는 조회하지 않음.

## 2. 실제 재현 — project_members 무한 재귀

**진단 SQL** (읽기 전용 트랜잭션, 역할 변경은 트랜잭션 내부에 한정):

```sql
BEGIN READ ONLY;
SET LOCAL ROLE authenticated;
SELECT count(*) AS visible_members FROM public.project_members;
ROLLBACK;
```

**실행 결과:**

```text
ERROR 42P17: infinite recursion detected in policy for relation "project_members"
```

**정확한 원인:** 적용된 `project_members` SELECT 정책 **`"멤버 조회"`**의 `EXISTS (SELECT ... FROM project_members pm ...)`가 같은 테이블의 RLS를 다시 요구한다. 데이터 행이 없어도 정책 재작성 시 오류가 발생한다.

**무손상 검증:** `BEGIN READ ONLY; SET LOCAL ROLE authenticated; SELECT can_access_project('0000...') ...; ROLLBACK;`는 존재하지 않는 프로젝트에 대해 **false / null** 응답. `get_project_role`, `can_access_project`, `can_edit_project_content`은 `postgres` 소유 SECURITY DEFINER 함수이고 해당 소유자는 `BYPASSRLS` 권한을 갖는 것으로 확인됨. 따라서 helper를 통한 비재귀 SELECT 정책 제안이 타당함.

**제안 마이그레이션 009 (미실행):**

```sql
drop policy if exists "멤버 조회" on public.project_members;
create policy "멤버 조회"
  on public.project_members
  for select
  using (
    auth.uid() = user_id
    or public.can_access_project(project_id)
  );
```

**범위:** 해당 SELECT 정책만 교체하며, 기존 정책에 있던 **초대 대기자의 자기 행 조회(auth.uid() = user_id)**를 보존한다. 댓글/알림/함수 EXECUTE/grants는 별도 보안 PR로 분리한다. 실제 배포 전 아래 역할·초대 검증을 통과해야 한다.

## 2.1. 일회용 PostgreSQL 17 실증 — 자동 CI 검증 완료 (2026-10-16)
- **환경:** GitHub Actions [#38849011220](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38849011220). GitHub 호스팅 러너의 **일회용 PostgreSQL 17 서비스 컨테이너**; Plan OS Supabase와 연결되지 않음. 실제 고객 데이터/자격증명 없음.
- **기반:** [bootstrap](../../tests/rls/bootstrap_postgres.sql)의 `auth.uid()` 및 DB 역할을 최소 에뮬레이션 → **실제 GitHub 마이그레이션 001~008 적용** → [합성 계정/프로젝트](../../tests/rls/seed_members.sql) 생성.
- **Before:** 인증된 역할로 `project_members` SELECT 시 migration 006의 **동일한 무한 재귀 오류** 발생. CI가 원인 문자열을 확인함.
- **After:** [009 정책](../../supabase/migrations/009_fix_project_members_select_recursion.sql) 적용 → SELECT 재귀 오류 제거. [역할별 SQL 테스트](../../tests/rls/test_member_select_009.sql) 통과.
- **검증된 역할:** 프로젝트 owner/editor/viewer는 해당 프로젝트의 구성원 목록 조회; 서로 다른 프로젝트는 격리; `pending`은 자신의 초대 행 **한 개만** 조회, 프로젝트 문서 접근은 불허; 타 프로젝트 소유자·회원·완전 외부인·`anon`은 권한 없는 프로젝트의 멤버 목록 조회 불가.
- **실측 결론:** 해당 정책의 SQL 의미와 가장 중요한 접근 제약이 **실제 PostgreSQL 17에서 통과**. CI run `38849011220`의 `success` 확인.
- **유효성 한계:** 이것은 Supabase Auth/JWT·실제 프로젝트 계정의 E2E가 아님. `auth.uid()`는 CI에서 만든 동등 역할 테스트용 함수이며 실제 Supabase 통합/회원 초대·프로젝트 삭제/복원 흐름은 미검증. 정책 전반의 안전성·상용 배포 승인으로 해석 금지.

## 2.2. 일회용 실제 Supabase Auth/JWT/PostgREST API 통합 테스트 성공 (2026-10-16)
- **최종 성공 증빙:** GitHub Actions [#38852999398](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38852999398) `success`, 검증한 코드 commit `5ee72bf460e8dd398ac769e1a523e6874ca0b7c3`.
- **환경:** GitHub-hosted runner의 일회용 Docker 기반 `supabase/setup-cli@v3` + Supabase CLI `2.84.2`로 시작한 **로컬 Auth(GoTrue), Kong, PostgREST, PostgreSQL**. 프로젝트 링크, Supabase hosted access token, 운영 DB URL·비밀번호·데이터를 일절 사용하지 않음.
- **검증 방식:** 로컬 DB에 이 저장소의 migrations **001~009**를 실제 적용. 로컬 Auth Admin API에 일회용 테스트 사용자를 생성하고 비밀번호 로그인으로 **실제 사용자 JWT**를 발급. `public.handle_new_user` 트리거로 생성된 사용자 정보와 연결된 테스트용 프로젝트·멤버·문서를 심은 뒤, 각 JWT를 사용해 실제 `/rest/v1/project_members` 및 `/rest/v1/documents`를 조회.
- **PASS 검증:** owner/editor/viewer는 소속 프로젝트의 멤버 3명 및 문서 1개 조회 가능·다른 프로젝트 조회 0개; pending 사용자는 본인 초대 행 1개만 조회 가능·문서 및 다른 멤버 접근 불허; 타 프로젝트 owner/editor, outsider, `anon`은 무권한 프로젝트 멤버/문서 조회 불가. viewer의 문서 PATCH를 시도했으나 실 DB 내용이 수정되지 않음.
- **실패·수정 이력:** 최초 [#38852770669](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38852770669)는 **테스트 기대값 오류**(다른 프로젝트의 owner를 `project_members`의 멤버 행으로 잘못 계산, 실제 owner는 `projects.user_id`)로 실패. 기대값을 실제 스키마에 맞춰 수정한 후 위 최종 CI PASS.
- **검증 아티팩트:** [local Auth 통합 테스트 JS](../../tests/rls/test_local_supabase_auth.mjs), [합성 데이터 SQL](../../tests/rls/seed_auth_rest.sql), [일회용 전체 스택 CI](../../.github/workflows/rls-auth-integration.yml).
- **아직 미실행:** 실제 운영 Supabase 정책 009 적용/운영에서 JWT 재검증, 프로젝트 멤버 초대 메일 수신·수락, 소유자 멤버 역할 변경·삭제, 프로젝트 soft-delete/복원, 실제 웹 브라우저 UI, 기타 댓글·반응·알림·버전 정책 보안 테스트. **테스트 성공 = 운영 배포 승인 아님**.

## 3. 실제 시스템 정책 조회로 확인한 추가 보안 검토 항목

| 위험 | 실제 정책 정의에서 확인된 조건 | 판정 | 대응 |
|---|---|---|---|
| 댓글 UPDATE | `project_comments_update` USING/with_check가 `can_access_project(project_id)`만 요구 | **넓은 권한의 SQL 사실 확인** / 사용자 간 오남용은 별도 테스트 필요 | 작성자 수정/타인 해결권한·컬럼 접근 구분 |
| 반응 UPDATE/DELETE | `comment_reactions_write` FOR ALL USING은 프로젝트 접근만, WITH CHECK는 user_id 검사 | 기존 행에 대한 소유자 조건 없음 | UPDATE/DELETE 기존 행의 user_id도 본인 검사 |
| 참여 상태 UPDATE/DELETE | `comment_participant_status_write`도 FOR ALL USING에 본인 조건 없음 | 소유자 행위 테스트 필요 | 같은 방식 수정 |
| 댓글 INSERT | `can_access_project` 및 `user_id=auth.uid()` | viewer 댓글 가능성이 있음; 현행 프런트 viewer 댓글 권한과 일치하지만 신규 목표 정책과 상충 | 제품 정책 확정 후 RLS/PRD 일치 |
| 알림 INSERT | `actor_id=auth.uid()` + project 접근만 | 수신자 `user_id`의 프로젝트 멤버십 검사 없음 | cross-project recipient 및 actor spoof 테스트 |
| 활동 INSERT | `project_activities_insert`는 프로젝트 접근만 확인 | 이벤트 작성자·유형 위조 여지 | 서버 이벤트/actor 검증 |
| 버전 UPDATE | `document_versions_update`는 editor까지 허용 | 과거 버전 불변성 목표와 충돌 | append-only 설계 검토 |
| 생성 실행 | `generation_runs_access` FOR ALL은 `can_edit_project_content` | 상태/완료 단계 직접 조작 가능성 | 현재 문서 생성과 새 서버 run 분리 |

**주의:** PostgreSQL GRANT + RLS + 함수 실행 권한의 결합 효과를 고려해야 한다. 위 정책 구성 사실을 실제 사용자 간 공격/침해 성공으로 단정하지 않는다. **유일한 직접 실패 재현은 `project_members` SELECT 42P17이다.**

## 4. Supabase Security Advisor (읽기 전용)
- **Function Search Path Mutable:** `public.set_updated_at()` (1건) — [공식 점검/보완 가이드](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- **Anon Can Execute SECURITY DEFINER Function:** `can_access_project`, `can_edit_project_content`, `get_project_role`, `handle_new_user` (4건) — [공식 가이드](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- **Authenticated Can Execute SECURITY DEFINER Function:** 동일 4건 (4건) — [공식 가이드](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- **Leaked Password Protection Disabled:** Auth 설정 경고 (1건) — [공식 가이드](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

**보안 경고의 의미:** EXECUTE grant 노출은 확인됐으나 함수들이 `auth.uid()`로 내부 권한을 확인하므로 grant 존재만으로 정보 유출을 단정하지 않는다. 트리거 함수 `handle_new_user()`도 일반 RPC 호출 성공을 입증한 것은 아니다. 필요한 함수·역할별 접근 방식, 트리거 영향과 revocation 회귀를 검토한 후 별도 PR로 개선한다.

## 5. 다음 브라우저·초대·운영 정책 검증 계획 (일부 완료)
1. [x] 일회용 PostgreSQL 17에서 SQL 역할 검증 PASS. [x] 추가로 일회용 **로컬 Supabase Auth·PostgREST**를 실행해 실제 JWT API 조회/PATCH 권한 검증 PASS. **운영 DB에서 `db push` 절대 금지**.
2. 테스트 계정: 소유자 A, 활성 editor B, 활성 viewer C, pending 초대 D, 외부인 E, 다른 프로젝트 소유자 F. 테스트 프로젝트 2개와 각 2~3개의 fixture 멤버 행 생성.
3. 각 사용자 JWT로 프로젝트 목록·`project_members` SELECT 및 권한 없는 타 프로젝트 읽기 시도. SELECT 재귀 없어야 하고 역할/초대 상태대로 행 분리.
4. owner가 멤버 초대/취소/역할 변경, editor/viewer가 금지된 변경 시도, 프로젝트 soft-delete 및 복원 후 멤버 조회 검증.
5. 댓글 작성/수정/삭제, 타인 반응/참여 상태·알림 위조, 과거 버전 UPDATE를 허용/거부 매트릭스로 테스트. 테스트 계정별 실제 JWT 및 `auth.uid()` 검증 필수.
6. 시스템 뷰 `pg_policies` 전후 diff·데이터 무손상, 브라우저 팀/초대 화면 회귀 결과 확인.
7. 오류 시 rollback 절차: 격리 DB에서 `009` 정책을 제거하고 승인된 이전 동작 정책/전체 schema migration 상태를 별도로 복원. **재귀 정책을 운영에 재적용하는 방법은 긴급 복구안으로 권장하지 않음.**
8. 테스트·제품 정책 승인 뒤에만 별도 사용자 확인을 거쳐 운영 DB 마이그레이션.

## 6. 완료 정의 및 현재 상태
- [x] Plan OS 활성화 확인
- [x] DB 적용 마이그레이션 001~008 조회
- [x] 테이블 RLS·정책·SECURITY DEFINER·Advisor 읽기 전용 확인
- [x] `project_members` 42P17 읽기 전용 실제 재현
- [x] SQL 패치 009 GitHub 초안 작성
- [x] 일회용 **PostgreSQL 17 CI** 준비, 합성 fixture와 역할별 테스트 및 009 적용 확인 ([실행 #38849011220](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38849011220))
- [x] **격리 로컬 Supabase Auth/JWT/PostgREST** 사용자 JWT, owner/editor/viewer/pending/outsider/anon 조회 격리·viewer PATCH 검증 ([CI #38852999398](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38852999398))
- [ ] 실제 초대 이메일/수락·역할변경·삭제/복원·웹 브라우저 사용자 흐름 검증
- [ ] 브라우저 사용자 회귀
- [ ] 운영 변경/데이터 백업·롤백 계획 승인 및 실행

## 변경 이력
| 날짜 | 버전 | 변경 내용 | 상태 |
|---|---|---|---|
| 2026-10-16 | v1.0 | 활성 DB read-only 실증·42P17 발견·Advisor 및 정책 점검·009 수정 제안/게이트 기록 | 개발 DB/운영 적용 전 |
| 2026-10-16 | v1.1 | 009 초대 대기 자기 행 조회 보존, 일회용 PostgreSQL 17에서 001~008 재귀 재현/009 적용/권한별 SQL CI PASS 확인 | Supabase JWT·브라우저/운영 적용 전 |
| 2026-10-16 | v1.2 | 실제 로컬 Supabase Auth password login/JWT/PostgREST 역할별 권한 테스트 성공, CI 실패 수정 이력·브라우저 잔여 범위 기록 | 브라우저/운영 적용 전 |
