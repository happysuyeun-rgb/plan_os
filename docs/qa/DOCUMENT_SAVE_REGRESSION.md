# PlanOS — 문서 저장·버전 복원·재생성 회귀 체크

**최초 작성일:** 2026-10-16  
**최종 수정일:** 2026-10-16  
**문서 버전:** v1.3  
**진행 상태:** 17개 단위 테스트·격리 Chromium B-01/B-02/C-01 회귀 PASS / 나머지 브라우저·운영 DB QA 미완료  
**대상 브랜치:** `fix/planos-document-autosave-safety-20261016` (PR #9), `fix/planos-chat-document-write-20261016` (PR #11, PR #9 기반)  
**원칙:** 합성 계정과 일회용 로컬 Supabase만 사용. 운영 Plan OS Supabase는 2026-10-16 `ACTIVE_HEALTHY`, 실제 적용은 migrations 001~008이며 009·010은 미적용, 호스팅 개발 브랜치는 0개. 운영 데이터/배포 변경 금지.

## 확인된 자동 검증
- `npm run test:unit`: 저장/버전/재생성 11개 + 채팅 문서 병합/충돌 6개 = **17개 단위 테스트**. 최신 [PR #11 CI #38846816370](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38846816370)에서 TypeScript/build/lint/unit 모두 PASS.
- PR #9 코드 HEAD `abf15fcb9331b6d8675c9cd95edeb1a9644caa03`의 [GitHub Actions #38845602357](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38845602357)에서 `npm ci`, `npm run build`(TS 검사 포함), `npm run lint`, `npm run test:unit` **모두 PASS**. 중간 실패는 경합 테스트 동기화/상태 콜백 기대값을 보정해 해결.
- **주의:** 이 단위 테스트는 서버 실 DB/브라우저 실제 저장/버전 복원의 성공을 보장하지 않는다.

## 신규 검증 실측 — 2026-10-16
- 통합 테스트 전용 [Draft PR #15](https://github.com/happysuyeun-rgb/plan_os/pull/15)의 [Chromium Actions #38867219334](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867219334), code SHA `e933ea9647bd169ec675c1c6ad9061343f14a901`: **B-01, B-02, C-01 PASS**. Playwright로 실제 로그인/문서 수정·문서 탭 변경·채팅 요청·리로드 실행, 일회용 PostgREST의 최종 PRD/기능명세서 `content`까지 검증. 이 결과는 **운영 DB 검증이 아님**.
- 추가로 문서 입력마다 댓글 스레드를 다시 요청하는 [DocumentPage](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-chat-document-write-20261016/src/pages/DocumentPage.tsx) dependency 문제를 발견하고 ID 기반 effect로 보완했으며, [commentStore](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-chat-document-write-20261016/src/store/commentStore.ts)에 낡은 응답 격리를 적용함. [PR #11 CI #38867723560](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867723560) npm ci/TS/build/lint/17 unit 테스트 **SUCCESS**.
- 위 댓글 중복조회 회귀를 직접 검사하는 B-02 강화 테스트는 PR #15에서 추가해 **CI 결과 확인 중**. 원래 통과한 B-01/B-02/C-01과 실행 SHA를 구분한다.

## 브라우저 실증 시나리오 (B-01/B-02 PASS, 그 외 미실행)

| ID | 상황/조작 | 기대 결과 | 상태 |
|---|---|---|---|
| B-01 | PRD 문서 수정 직후 2초 내 기능명세서 탭 전환, 두 문서 편집 | PRD·기능명세서가 각각 자신의 입력을 저장, 새로고침 후 유지 | **격리 Chromium PASS** |
| B-02 | 동일 문서 빠르게 5회 편집, 2초 경과 | 마지막 값 저장, 새로고침 후 유지 | **격리 Chromium PASS** |
| B-03 | 저장 요청이 느릴 때 다른 문서/프로젝트 이동 | 이전 응답이 현재 화면/다른 프로젝트 내용을 덮어쓰지 않음 | 미실행 |
| B-04 | 저장 실패/오프라인 → 다른 탭 → 복귀 → 다시 저장 | 미저장 본문 유지, 오류 표시와 수동/재입력 복구 가능 | 미실행 |
| B-05 | 수정 후 곧바로 과거 버전 선택·복원 | 기존 미저장 문서 저장 처리 후 복원, 최종 서버 본문 = 복원본 | 미실행 |
| B-06 | 자동저장 전 AI 단일 재생성 | 옛 저장 요청이 새 결과를 덮어쓰지 않음 | 미실행 |
| B-07 | 자동저장 전 AI 연쇄 재생성 | 대상 문서가 각각 순서 있게 갱신되고 사람의 신규 편집이 유실되지 않음 | 미실행 |
| B-08 | 재생성 호출 중 사용자 재입력 | 재생성 완료 후 후속 편집이 최신 값으로 저장됨. 덮어쓰기 위험 없음 | 미실행 |
| B-09 | 재생성 실패/계약 오류 중 수정 내용 보존 | 에러 후에도 원래 편집 가능, 무단 완료 메시지 없음 | 미실행 |
| B-10 | 기존 문서 버전 목록·원본 돌아가기·댓글 링크 | 기존 deep-link와 version read-only 동작 정상 | 미실행 |
| B-11 | owner 휴지통 이동·복원 / editor 타인 복원 | owner 성공, 비허용 접근 거부; 데이터/버전 유지 | 미실행 |
| B-12 | viewer 문서 열기·재생성/복원 접근 | viewer는 읽기만 가능, 서버 권한 재검사 | 미실행 |

## PR #11 채팅 문서 쓰기 회귀 시나리오 (C-01 PASS, 그 외 미실행)

| ID | 상황/조작 | 기대 결과 | 상태 |
|---|---|---|---|
| C-01 | PRD의 저장 대기 중 채팅 편집 요청 | 미저장 본문 뒤에 채팅 변경이 붙고 새로고침 후 둘 다 유지 | **격리 Chromium PASS** |
| C-02 | 느린 문서 자동저장 중 채팅 요청 | 같은 문서 요청이 순서대로 처리되며 DB 덮어쓰기 없음 | 미실행 |
| C-03 | 채팅 요청 중 IA로 탭 이동 | PRD에만 변경, IA 본문/채팅 기록 오염 없음 | 미실행 |
| C-04 | 채팅 저장 중 사용자가 추가 편집 | 최신 사용자 입력과 채팅 내용이 함께 남고 상태가 저장됨으로 바뀜 | 미실행 |
| C-05 | 문서 조회/저장 네트워크 오류 | 채팅 오류 토스트, 미저장 초안 유지, '반영 완료' 허위 알림 없음 | 미실행 |
| C-06 | 과거 버전 보기/읽기 전용 상태에서 채팅 시도 | 채팅 전송 차단, 서버 문서 변경 없음 | 미실행 |
| C-07 | 다른 프로젝트로 이동한 뒤 이전 채팅 요청 응답 도착 | 현재 프로젝트 내용·메시지 목록 변조 없음 | 미실행 |
| C-08 | owner/editor/viewer 각 역할로 채팅 편집 시도 | 권한 없는 역할은 UI와 RLS 모두 거부, 실제 DB 검증 | 미실행 |
| C-09 | 채팅 업데이트 직후 단일·연쇄 재생성/버전 복원 | 명시된 작업 순서대로 처리, 데이터 유실/중복 없음 | 미실행 |
| C-10 | 채팅 메시지 생성 성공 뒤 문서 저장 실패 및 재전송 | 고아 메시지·중복 메모·수락 오류 검토, 원자성/멱등성 정책 필요 | 미실행/설계 필요 |

**제품 경계:** 현재 'AI 채팅'은 메시지를 문서에 첨부하는 **placeholder** 구현이다. LLM 모델 응답·실제 도구 실행은 이번 CI에서 검증되지 않는다.

## 안전 점검과 남은 직접 수정 경로
- [PR #11](https://github.com/happysuyeun-rgb/plan_os/pull/11)에서 `chat.ts`의 직접 DB 문서 UPDATE와 활성 탭 재저장 경로를 제거하고 `documentStore.applyChatEdit` → `createDocumentAutosave`로 연결했다. [Issue #10](https://github.com/happysuyeun-rgb/plan_os/issues/10)은 **브라우저/RLS 테스트 전 미종결**.
- `src/store/versionStore.ts`의 문서 버전 저장/복원에는 DB 트랜잭션·동시 버전 번호 충돌 가능성이 남아 있다. 단위 테스트만으로 해결됐다고 간주하지 않는다.
- `src/pages/DocumentPage.tsx`는 `activeVersionId`·`activeDoc?.content`의 effect 기반 UI 동기화가 있다. 패널/버전 변경 중 화면이 이전 콘텐츠로 되돌아가는 회귀를 브라우저에서 확인해야 한다.
- 개발 DB의 RLS(특히 댓글·문서 버전·viewer/owner 권한)는 격리된 테스트 프로젝트/계정 확보 전 검증할 수 없다.

## PR #9 병합 차단 조건
1. [x] PR #11 코드 HEAD의 npm ci/build/lint/17개 unit CI 통과 ([Actions #38867723560](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867723560)).
2. [ ] B-01/B-02의 브라우저·격리 DB 실증은 확보; **B-03~12 미완료**.
3. [x] 채팅 직접 UPDATE 제거·문서별 큐 연결 및 C-01 실증([PR #11](https://github.com/happysuyeun-rgb/plan_os/pull/11)). [ ] C-02~10 브라우저·DB 검증, 메시지/문서 원자성·멱등성 해결.
4. [x] 일회용 로컬 Supabase Auth/JWT/PostgREST에서 migration 009/010 권한 검증 [PASS](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38855748722). [ ] 브라우저 버전 복원·권한 변경·운영 반영 검증.
5. [ ] 버전 복원/재생성 실패 때 사용자에게 안전한 에러 안내·재시도 제공.
6. [ ] 문서 변경/프로젝트 전환/휴지통 복원 등 기존 주요 사용자 흐름 회귀 없음.
7. [ ] PR #8 기반 및 main 의존성 확인, 검토 후 병합; 운영 DB/배포는 별도 승인.

## 기록표 (실행 시 작성)
| 날짜 | 환경·브랜치 SHA | 시나리오 | 실제 결과·증빙 링크 | PASS/FAIL | 대응 |
|---|---|---|---|---|---|
| 2026-10-16 | PR #9 | B-01~B-12 | 안전한 브라우저·DB 환경 미확보 | NOT RUN | QA 환경 준비 필요 |

## 변경 이력
| 날짜 | 버전 | 변경 | 상태 |
|---|---|---|---|
| 2026-10-16 | v1.0 | 문서 저장·버전·재생성·권한 회귀 12개와 병합 차단 조건 최초 작성 | 브라우저/DB 검증 미실행 |
| 2026-10-16 | v1.1 | 최종 코드 커밋 CI 11개 유닛테스트 PASS 증빙과 Issue #10 채팅 문서 쓰기 누락 연결 | 브라우저/DB 검증 미실행 |
| 2026-10-16 | v1.2 | PR #11 채팅 큐 통합, 6개 신규 단위 테스트·전체 17개 CI PASS, C-01~10 회귀 및 원자성 차단 명세 | 브라우저/DB 검증 미실행 |
| 2026-10-16 | v1.3 | 활성 Supabase 상태 정정, 통합 Playwright B-01/B-02/C-01 및 PostgREST 최종 내용 PASS, 댓글 fetch 중복/오래된 응답 수정·CI 기록 | 나머지 브라우저 QA/메시지 원자성 미완료 |
