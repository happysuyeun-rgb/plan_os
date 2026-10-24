# PlanOS Phase 0 — P0 원자적 복원·저장/채팅 전환 회귀 기록

- 날짜: 2026-10-16 (KST)
- 대상 저장소: `happysuyeun-rgb/plan_os`
- 수정·검증 브랜치: `fix/planos-version-restore-atomic-20261016` ([Draft PR #17](https://github.com/happysuyeun-rgb/plan_os/pull/17), 기반 [통합 Draft PR #15](https://github.com/happysuyeun-rgb/plan_os/pull/15))
- 추적: [P0 Issue #16](https://github.com/happysuyeun-rgb/plan_os/issues/16)
- **최종 코드 검증 SHA: `3d3e2115b8261386104154ab0d94604702e57ae2`**
- **최종 결론: 해당 SHA의 일회용 로컬 Auth/JWT/PostgREST + Chromium 회귀 PASS; 운영 승인/Phase 0 완료 아님.**

## 1. 결함 선재현 (negative control)

[통합 브랜치 Actions #38908704414](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38908704414) (기존 복원 코드, `6c7b968`): 버전 이력 v4 INSERT 성공 후 별도 문서 PATCH를 강제로 HTTP 503으로 실패시켰다. **버전 이력과 현재 문서 본문이 불일치**했고 브라우저에 처리되지 않은 `Object` 오류까지 발생하여 CI FAILED. 이는 **수정 후보의 실패가 아니라 기존 비원자적 설계의 실제 재현**이다. 테스트는 격리 로컬 DB에서만 진행되었다.

## 2. 결함 수정 — Draft PR #17의 격리 원자적 복원

기존 [PR #17](https://github.com/happysuyeun-rgb/plan_os/pull/17)의 `015_atomic_document_version_restore.sql` 및 앱 UI 수정안 활용:
- 서버측 `restore_document_version` 인증 RPC 내에서 현재 문서 잠금, 복원 이전 본문 스냅샷 보존(필요 시), 새 버전 이력 INSERT, 현재 문서 UPDATE, 작업 UUID 기록을 **한 DB 트랜잭션**에 결합.
- UPDATE 실패 시 전체 롤백. 요청 UUID 재전송 시 중복 이력 방지. viewer/anon/타 문서 이력 복원 거부. 동일 문서의 복원 요청 동시성 직렬화.
- 브라우저 복원 실패는 사용자에게 오류로 안내하며 동일 작업 UUID를 유지해 재시도. **운영 Supabase에는 migration 011 미적용.**

## 3. 추가 결함 발견 및 실제 수정 (C-03)

[첫 신규 E2E #38913646489](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38913646489), 코드 `9278df1`:
- **B-03 PASS:** PRD의 지연 PATCH가 IA 전환 뒤 완료되더라도 서로 다른 문서의 UI/DB 내용이 섞이지 않음.
- **B-04 PASS:** 강제 HTTP 503에서 `저장 실패` 표시, IA 전환/복귀 후 PRD 미저장 초안 유지, 네트워크 회복 후 재편집으로 저장·리로드 성공.
- **C-03 FAILED:** PRD 채팅 요청 중 IA 전환 후 PRD 입력 문구가 IA 화면에 보임. 당시 채팅 입력값은 문서별이 아닌 전역 `input` 하나였음.

[수정 커밋 `49f56db`](https://github.com/happysuyeun-rgb/plan_os/commit/49f56db751bbcb0580cfba1c25ceaaa7b24d8497): `src/store/chatStore.ts`에 `inputByContext` 추가. 문서별 미전송 텍스트를 구분하고, 지연된 PRD 채팅 완료가 다른 문서 입력값을 지우거나 노출하지 않도록 함. [테스트 보완 커밋 `3d3e211`](https://github.com/happysuyeun-rgb/plan_os/commit/3d3e2115b8261386104154ab0d94604702e57ae2): C-03의 **메시지 버블, 활성 IA 채팅 입력창, 로컬 chat_messages의 document_id**를 각각 분리 검증.

## 4. 같은 코드 SHA에 대한 신규 검증 근거

- [Baseline Actions #38914618107](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38914618107): **SUCCESS**, 코드 SHA `3d3e2115b8261386104154ab0d94604702e57ae2` (TypeScript/빌드, lint, 단위 테스트).
- [Chromium Actions #38914617701](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38914617701): **SUCCESS**, 동일 코드 SHA. 일회용 **로컬 Supabase**(인증/JWT/PostgREST/PG 및 테스트용 migration 001~011), Vite 및 실제 Playwright Chromium.
- 실제 로그: **FAULT-01 롤백 PASS** / **실패 해제 후 재시도 PASS** / **IDEMPOTENCY-01 PASS** / **복원 전 수동 스냅샷 없는 원고 보관 PASS** / **AUTHZ-01 PASS** / **CONC-01 PASS**.
- 기존 회귀: **B-01 문서 전환 PASS** / **B-02 빠른 다중 입력 PASS** / **C-01 미저장 초안 + 채팅 PASS** / **B-05 과거 이력 미리보기·복원 PASS**.
- 신규 회귀: **B-03 느린 PRD 저장 중 IA 전환 PASS** / **B-04 503 저장 실패, 초안 보존·재편집 복구 PASS** / **C-03 지연 채팅 중 IA 전환, 타 문서 본문·입력·메시지(DB document_id 포함) 격리 PASS**.
- 실패 재현 #38908704414, 중간 C-03 실패 #38913646489 및 최종 녹색 #38914617701은 **서로 다른 브랜치·코드 SHA 및 테스트 목적**을 가진 별개 실행으로 보존.

## 5. 남은 P0 및 출시 제한

1. **C-10 미해결:** 채팅 메시지 INSERT와 문서 저장 UPDATE 사이 장애는 단일 트랜잭션이 아님. 고아 메시지/중복 제출/결과 불일치에 대한 원자성·멱등성 설계와 장애 주입 E2E 별도 필요.
2. **B-04 범위:** 본 검증은 HTTP 503 후 **탭 전환→재편집을 통한 복구**까지만 증명. 미저장 상태에서 **전체 페이지 새로고침/브라우저 종료** 후 로컬 초안 복구, 복구 버튼, 장기 오프라인 상태는 미검증.
3. **C-03 범위:** PRD→IA 지연 채팅은 검증했으나 프로젝트 자체 전환/첨부파일 경합 및 다른 C-02~10 경우는 별개. 글로벌 `isStreaming`, 미전송 첨부파일 상태의 프로젝트/문서별 소유권은 추가 검토 필요.
4. **B-05 범위:** 원자적 **복원 RPC**의 동시성만 검증. 일반 수동 `createVersion`의 SELECT MAX+1 버전 번호 할당과 복원 경합은 별도 보강 대상.
5. 팀 초대·댓글·알림·휴지통/권한·AI 재생성, 남은 B/C 시나리오와 서버 데이터 보안 점검 미완료. 복원 PR #17을 포함한 **전체 최신 브랜치 결합/릴리스 게이트** 미승인. 특히 의도적 레드 재현이 있는 PR #15의 테스트 코드를 그대로 수정안에 병합하지 않는다.
6. **보안·운영 경계:** 호스팅 PlanOS DB migrations 001~008 상태는 기존 기록 기준이며 009/010/011은 **일회용 CI 로컬에서만 적용**. 본 작업 중 운영 DB 변경, `main` 병합, PR 병합, Vercel/프로덕션 배포, 비용 발생 인프라 생성 **없음**. 최종 적용 시 별도 명시적 승인, 백업/롤백, 사용자 E2E 필요.

**판정:** 버전 복원 결함의 수정 후보는 같은 SHA에서 안정적 **PASS**, B-03/B-04/C-03 핵심 경합도 **PASS**. 그러나 Issue #16은 운영 승인/완전체 회귀 전까지 **OPEN**으로 유지하고 Phase 0 종료를 선언하지 않는다.
