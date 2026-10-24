# PlanOS 3.0 — Phase 0 C-10 원자적 채팅/문서 저장 실증

**작성:** 2026-10-17 (KST)  
**격리 수정:** [Draft PR #18](https://github.com/happysuyeun-rgb/plan_os/pull/18), `fix/planos-chat-atomic-c10-20261017` (기반 Draft PR #17)  
**검증된 코드 SHA:** `0dfc2595e73f476c43d8673d97bc27a86ccbeb07`  
**안전 조건:** hosted Supabase SQL 적용 없음, main/다른 PR 병합 없음, 배포 없음.

## 1. 기존 실제 장애 재현 — RED

[원래 클라이언트의 격리 Chromium 실행 #38992145695](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38992145695) **FAIL(결함 의도적 검출)**: `chat_messages` 사용자 메시지 INSERT가 먼저 성공한 상태에서 `documents` PATCH에 HTTP 503을 주입. 문서는 수정되지 않았지만 메시지 수가 **4→5**로 증가하고 고아 사용자 메시지 1건이 실제 일회용 DB에 남음. 기존 3단계 독립 호출(사용자 INSERT → 문서 저장 → 어시스턴트 INSERT)의 원자성이 없음을 확인.

## 2. 구현한 수정

- `supabase/migrations/016_atomic_chat_document_edit.sql`: `commit_chat_document_edit(project,document,content,operation_uuid)` authenticated PostgreSQL RPC. 문서 행 잠금 → 현재 서버 내용 조회 → 사용자 메시지 INSERT → 현재 문서 본문 변경 → 어시스턴트 메시지 INSERT → 요청 UUID 기록을 **한 SQL 트랜잭션**으로 수행. 중간 오류시 전부 롤백.
- 트랜잭션마다 프로젝트/문서 일치·프로젝트 소프트 삭제 여부·active owner/editor 권한 확인. 브라우저가 전달한 이전 문서 본문이 아니라 **잠금된 서버 문서 내용**에 메모를 추가.
- 이미 커밋된 동일 UUID 재요청은 이전 메시지 쌍을 반환하며 본문을 재수정하지 않음. 같은 UUID로 요청 대상/본문/사용자 변경 시 거부. 응답 유실에도 멱등성 유지.
- `src/store/documentStore.ts`: 기존 문서별 autosave 직렬화 라인에서 RPC 호출, 이전 미저장 사람 입력은 먼저 저장. 해당 문서 RPC 중에는 에디터를 잠시 읽기전용으로 잠가, 뒤늦은 사람 입력 기반 PATCH가 서버의 채팅 반영을 덮어쓰지 않도록 방지. 다른 문서는 계속 편집 가능.
- `src/store/chatStore.ts`: 프로젝트/문서/사용자 요청별 UUID를 보존, 불확실한 네트워크 응답 후 재시도에 같은 UUID 사용. 성공 후 보존 상태 삭제. 문서별 채팅 입력 분리(C-03)를 유지.
- `src/lib/api/chat.ts`: 분리된 메시지 INSERT 경로 대신 DB RPC 사용. 커밋 후 알림 발송 장애는 이미 완료된 트랜잭션을 실패로 오안내하지 않도록 best-effort로 처리.
- **주의:** 기존 'AI 반영'은 진짜 모델 실행이 아닌 메모 append placeholder이며, 이번 변경은 그 동작의 저장 원자성만 보장.

## 3. 실제 자동화 근거 — GREEN

| 확인 | GitHub Actions | 결과 |
|---|---|---|
| TypeScript·프로덕션 빌드·린트·단위 회귀 | [Baseline #38992737372](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38992737372) | **SUCCESS**, SHA `0dfc259` |
| Playwright Chromium + 일회용 Supabase Auth/JWT/PostgREST/PostgreSQL, migrations 001~012 | [Browser #38992737370](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38992737370) | **SUCCESS**, 같은 SHA |

실제 브라우저 로그에서 아래를 확인:
- **C-10 FAULT PASS:** 문서 UPDATE 자체가 SQL trigger 예외를 내도록 조작하여 사용자 INSERT 이후 DB 전체 롤백. 사용자/어시스턴트 메시지·문서·작업 UUID 기록 전부 변경 없음.
- **C-10 RETRY PASS:** 장애 제거 뒤 같은 입력 재시도. 사용자·어시스턴트 메시지 1쌍, 본문 append 1회, 작업 ID 1개만 영속.
- **C-10 IDEMPOTENCY PASS:** 서버 DB에서 커밋했지만 첫 HTTP 응답만 503으로 바꾼 모호한 실패 재현. 재시도시 채팅 행/본문 중복 생성·되돌리기 없음.
- **C-10 AUTHZ PASS:** viewer, anon, 프로젝트/문서 불일치, 같은 UUID 다른 메시지 재전송 모두 거부. 실제 chat_messages 행 수 불변.
- **C-10 durability PASS:** 브라우저 전체 새로고침 후 에디터와 서버 content 동일.
- 이전 **B-01/B-02/B-03/B-04/B-05 정상·실패 복원 및 C-01/C-03** 격리 브라우저 회귀가 함께 PASS. 원자적 버전 복원 FAULT-01, UUID replay, 원고 보관, 권한·동시성도 PASS.
- 첫 수정 CI [#38992474739](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38992474739) 실패는 채팅 쓰기 경로가 `chat_messages` 직접 INSERT에서 RPC로 바뀐 뒤 **기존 C-03 테스트가 오래된 HTTP 경로를 기다린 결과**. 테스트를 RPC 지연 방식으로 변경한 SHA `0dfc259`에서 전체 PASS. 첫 실패를 제품 결함으로 오인하지 않음.

## 4. 보류·다음 게이트

- **운영 적용/스키마 게이트:** migration 009/010/011/012 실제 hosted DB 적용 금지. 별도 승인, 백업·롤백, 정책 검사 및 전체 사용자 E2E 전까지 PR #18 Draft, #15/#17 미병합.
- **B-04 보류:** 오프라인 상태에서 페이지 새로고침/브라우저 종료 뒤 미저장 초안 복구, 명시적 저장 재시도 UX는 여전히 미검증.
- **C-07 및 첨부파일:** 다른 프로젝트로 이동하는 동안 채팅·첨부 응답이 지연되는 경우, 전역 pending attachments 소유권 및 스트리밍 경합은 별도 회귀 필요.
- **다중 클라이언트 충돌:** 한 탭 내 document autosave와 RPC는 직렬화하지만, 다른 기기/브라우저에서 동시에 일반 문서 PATCH를 하면 최신 채팅 내용을 뒤늦은 PATCH가 덮어쓸 가능성까지 해결한 것은 아님. If-Match/버전 검사 또는 optimistic concurrency 필요.
- **DB 직접 쓰기 방어:** 앱 채팅 경로를 RPC로 전환했지만 기존 chat_messages 직접 INSERT 정책/권한을 폐기한 것은 아님. 클라이언트 직접 assistant 메시지 위조 및 활동·알림 본문 신뢰성은 별도 보안 결함으로 유지.
- **기타 Phase 0:** 수동 버전 번호 MAX+1과 복원 동시성, 초대·댓글·알림·휴지통·재생성 UI, 기타 B/C·CSEC 미완료. C-10 통과를 Phase 0 종료로 간주 금지.

**판정:** C-10 해당 실패/재시도/권한 및 연관 회귀는 격리 테스트 기준 **PASS**, **릴리스·운영 반영 HOLD**.
