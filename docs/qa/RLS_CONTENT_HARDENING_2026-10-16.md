# PlanOS — RLS 내용·알림·이력 권한 보완 검증

**최초 작성일:** 2026-10-16  
**최종 수정일:** 2026-10-16  
**문서 버전:** v1.0  
**진행 상태:** migration 010 제안 작성 / 격리 Supabase Auth+JWT+REST CI 실행 중 / 운영 미적용  
**변경 브랜치:** `fix/planos-rls-content-hardening-20261016` · [Draft PR #14](https://github.com/happysuyeun-rgb/plan_os/pull/14) (Draft PR #13 선행)

## 1. 실제 소스 대조 및 문제

| 대상 | 기존 SQL/실제 앱 호출 | 정적 위험 / 기능상 버그 | migration 010 보완 |
|---|---|---|---|
| `project_comments` | `project_comments_update`는 프로젝트 접근만 검사, UI는 author/owner 삭제·멤버 스레드 해결/재개 | 타인 본문·작성자·프로젝트/스레드 메타데이터 변경 가능성 | `guard_project_comment_update`로 귀속 필드 불변, 본문 작성자, 삭제 작성자·소유자, 루트 해결/재개 규칙 검증 |
| 댓글 soft delete | `deleteComment()`는 `body:''` 및 `deleted_at` 수정, 기존 `body` CHECK는 빈 글 금지 | 앱 삭제 시 CHECK 실패 가능성 | 살아 있는 글만 길이 1~4000 제한; 삭제 글은 빈 글 허용 |
| `comment_reactions` | `FOR ALL USING`은 프로젝트 접근만 검사, `WITH CHECK`만 본인 user_id | 다른 사람의 reaction UPDATE/DELETE 가능성 | INSERT/UPDATE/DELETE 각각 자신의 행만 |
| `comment_participant_status` | `FOR ALL USING`은 프로젝트 접근만 검사 | 다른 사람의 완료 상태 UPDATE/DELETE 가능성 | 자신의 행 INSERT/UPDATE/DELETE만 허용 |
| `user_notifications` | 프로젝트 멤버 actor만 INSERT, recipient 검사 없음; recipient는 전체 행 UPDATE 가능 | 타 프로젝트 사용자에게 알림 삽입·자기 알림 제목·본문 조작 가능성 | recipient는 같은 프로젝트 owner/활성 멤버, document_id 프로젝트 일치; 트리거는 `read_at`만 수정 허용 |
| `document_versions` | editor/owner가 지난 스냅샷 UPDATE 가능 | 변조 가능한 이력 | UPDATE policy 제거 + authenticated/anon UPDATE 권한 철회; 신규 버전 INSERT 유지 |

**중요 범위 제한:** 해당 SQL을 실제 운영 DB에서 적용하거나 기존 데이터 행을 조회/수정하지 않음. 현재 SQL은 제안이며 **운영 취약점 악용 여부가 아니라 정책 설계 점검과 격리 환경 검증**이다.

## 2. 격리 API 테스트 시나리오 (적용 후 판정 기입)

테스트 파일: `tests/rls/test_local_supabase_content.mjs`; 실제 localhost GoTrue/Auth→JWT→PostgREST 호출. 합성 사용자/문서로만 실행.

| ID | 테스트 | 기대 결과 | 상태 |
|---|---|---|---|
| CSEC-01 | editor가 owner의 댓글 본문/작성자명 변경 | 거부·원본 유지 | CI 대기 |
| CSEC-02 | owner는 자기 댓글 본문 수정, viewer는 루트 스레드 해결, editor는 재개 | 허용 | CI 대기 |
| CSEC-03 | 댓글 author 및 owner가 각각 소프트 삭제(`body:''`) | 정상 삭제, 삭제된 글 수정 거부 | CI 대기 |
| CSEC-04 | editor가 owner 반응 수정/삭제 및 owner user_id로 reaction 등록 | 거부 | CI 대기 |
| CSEC-05 | editor 자신의 반응 삭제·등록 | 허용 | CI 대기 |
| CSEC-06 | editor가 owner의 참여 완료 상태 수정/삭제·타인 명의 INSERT | 거부 | CI 대기 |
| CSEC-07 | editor 자신의 참여 완료 상태 수정 | 허용 | CI 대기 |
| CSEC-08 | editor가 외부인/pending/다른 프로젝트 owner에게 알림 발송 | 거부 | CI 대기 |
| CSEC-09 | actor 위조·타 프로젝트 문서 연결 알림 INSERT | 거부 | CI 대기 |
| CSEC-10 | 활성 구성원/owner에게 정상 알림 INSERT | 허용 | CI 대기 |
| CSEC-11 | 수신자가 알림 읽음만 변경 / 제목·본문 변경·읽음 해제 | 읽음만 허용 | CI 대기 |
| CSEC-12 | editor 버전 추가, editor/owner 과거 버전 UPDATE, viewer 버전 추가 | 새 버전만 허용, 과거 수정 거부 | CI 대기 |

## 3. 미포함·후속 검토가 필요한 안전성 문제

- **실제 UI 회귀:** `CommentThreadCard`의 댓글 삭제·스레드 해결/재개, viewer 반응/완료, 알림 읽음과 버전 생성·복원을 실제 브라우저에서 검증하지 않았다.
- **알림 본문/타입 스푸핑:** notification INSERT는 현재 클라이언트 `notify.ts`에서 직접 수행하므로, 정상 프로젝트 멤버가 title/body/actor_name/type을 조작할 수 있다. 이 migration은 recipient 격리와 수신자 UPDATE 불변성부터 적용한다. 서버 신뢰 이벤트·허용 타입 검증은 별도 설계가 필요하다.
- **프로젝트 간 연관 ID:** 댓글 `document_id` 및 `parent_id`가 실제 `project_id`와 일치하는지 FK만으로 강제되지 않는다. 별도 복합 FK 또는 트리거/서버 검증 필요.
- **감사 로그:** `project_activities_insert`는 `user_id` 일치 제약이 없어 클라이언트 이벤트 위조 위험이 남는다. 후속 보안 PR로 분리.
- **문서 버전 번호 경합:** 클라이언트 조회→최댓값+1→INSERT 패턴은 동시 요청 시 unique 충돌 가능성. append-only 변경과 별개로 idempotent 버전 RPC가 필요하다.
- **프로젝트 soft-delete:** `get_project_role`이 owner에게는 deleted_at을 확인하지만 active 멤버 경로는 확인하지 않는다. 소프트 삭제된 프로젝트의 접근 차단 규칙 재검토 필요.
- **DB 권한 경계:** `SECURITY DEFINER` 검색 경로·EXECUTE grant 경고(현업 Supabase Advisor)는 별도 감사 대상으로 유지.
- **릴리스 게이트:** 격리 Auth/REST CI PASS + 실제 UI 회귀 + 이전 데이터/제약 무손상 검토 + 백업/롤백 + **운영 변경 별도 승인**.

## 4. 롤백 및 의존성

- migration 010은 **009 이후** 적용하는 것을 전제로 한다. SQL 테스트 파일은 오직 일회용 DB에서만 실행.
- 실제 운영 적용 전에는 대상 테이블 기존 데이터의 `body` 제약·사용 중인 commenter/notification 기능의 의미, 적용 전후 정책 diff, 백업 및 되돌리기 SQL을 별도 검증해야 한다.
- 출시 정책 변경 시 댓글 해결권한(viewer 포함), 삭제 가능자(author/owner), notification recipient 범위, 과거 버전 이력 불변성을 기획·권한 문서에도 반영.
- **Draft PR #13·#14 둘 다 미병합·미배포.**

## 변경 이력
| 날짜 | 버전 | 내용 | 상태 |
|---|---|---|---|
| 2026-10-16 | v1.0 | migration 010 변경안·현재 앱 호출·권한 거부/허용 12개 테스트 및 후속 위험 최초 작성 | 통합 CI 대기 |
