# S1 업무 관리 교차 검수 — 2026-10-20

**검수 범위:** PR #20의 UI, Supabase PostgREST adapter, SQL migration 011, 서비스 운영정책과 CI. **개발 DB 적용/브라우저 E2E는 아직 하지 않음.**

| ID | 심각도 | 결함·불일치 | 조치·현재 상태 |
|---|---|---|---|
| S1-01 | P0 | SQL assignee 정책이 project_members를 직접 SELECT하여 기존 재귀 RLS와 충돌 가능 | 보안 정의 함수 is_valid_task_assignee로 교체; 격리 RLS 검증 전까지 보류 |
| S1-02 | P0 | Supabase task API만 존재하고 업무 UI는 localStorage에만 저장 | VITE_S1_SERVER_TASKS=true 개발 환경에서만 서버 CRUD 및 버전 비교 연결; 기본값 local-only 유지 |
| S1-03 | P0 | 작업 상태/버전 제약이 JS에만 있으면 직접 API 조작 가능 | 서버 트리거 불변 필드·상태 전이·버전 증가 보강; DB 재현 미검증 |
| S1-04 | P0 | 0 rows UPDATE는 충돌 외 접근거부/삭제일 수도 있음 | API는 TaskConflictError로 안전한 메시지만 노출; 구체 원인 추정 금지 |
| S1-05 | P0 | 클라이언트 full-list replace는 여러 기기의 업데이트를 덮어씀 | 서버 모드에 단건 INSERT/UPDATE version CAS 도입; 로컬 모드는 데모만 |
| S1-06 | P1 | owner-only 완료 상태 재오픈/사유 정책과 현재 done terminal이 불일치 | 첫 MVP에서는 done 재오픈 불가를 채택. 이후 owner 재오픈은 별도 감사 사건으로 구현 |
| S1-07 | P0 | 멤버 제거/권한 변경 이후 업데이트 권한과 UI 캐시 불일치 가능 | RLS 재검증 필수, 프런트 캐시만 보안으로 간주하지 않음 |
| S1-08 | P1 | AI 담당자 및 acceptance criteria, 이벤트/감사기록, 생성 멱등성 부재 | S1 후속 구현 필요. AI 할당은 실행 승인 아님 |
| S1-09 | P1 | 전체 repo lint는 레거시 오류 다수. CI에서 S1만 강제 | S1 changed-file lint 필수 / repo 전체 lint 별도 비차단 기록 |
| S1-10 | P0 | SQL 실제 실행, 동시 수정, owner/editor/viewer/outsider RLS 테스트 부재 | 운영 마이그레이션 금지. 격리 개발 DB 후 PASS 필요 |
| S1-11 | P1 | 서버 모드 flag가 운영 배포 시 켜질 위험 | 개발 환경 내에서만 사용. 실제 운영 배포 시 별도 구성 검토 필수 |
| S1-12 | P1 | 기존 localStorage 데이터의 서버 이전·중복 제거 방식 미정 | 자동 마이그레이션 금지, 데이터 보전 방식 결정 후 별도 작업 |

## 다음 구현 차례
1. migration 011을 **격리 DB**에만 적용하여 function/RLS/트리거/동시수정 테스트 및 실패 원인 수정.
2. 사람 업무 수락기준, 생성 멱등성, 변경 이벤트·차단 시각·soft-delete 복원 권한을 DB/API로 구현.
3. 실제 브라우저에서 server-mode 업무 CRUD/회원 권한/재조회·중복·동시 수정 회귀 테스트.
4. 전체 레거시 lint 문제 분리 처리하고 PR #20 검증 후 병합 여부 결정.

**완료 판정:** 코드 작성/CI 통과와 배포/운영 적합 판정은 별개이다.
