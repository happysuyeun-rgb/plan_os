# PlanOS 3.0 — 전체 개발 진행 현황

**최초 작성일:** 2026-10-14  
**최종 수정일:** 2026-10-16  
**문서 버전:** v3.4  
**진행 상태:** 운영 중인 관리 문서 (개발 완료를 의미하지 않음)

> 기준: GitHub에서 실제 확인한 커밋·PR·Issue만 완료 근거로 인정. 이 문서는 개발 브랜치의 초안이며 main에 아직 병합되지 않았다.

## 전체 로드맵
| 단계 | 진행 상태 | 완료한 것 | 미완료·다음 확인 |
|---|---|---|---|
| 0. 기술 기준선 | **진행 중** | 저장소 212개 항목 목록 확인, SQL 8개 정적 감사, CI 실행·실패 원인 확인, 린트 부분 수정 PR #8 | CI 성공 증빙 확보, 남은 lint 경고 1건·운영 DB 적용 상태, RLS 재현/개선, PR #9 브라우저 회귀 검증 |
| 1. 기획·아키텍처 | **부분 착수(초안)** | 통합 PRD·TF-01~30·IA·화면 기능명세·권한 정책·AI 아키텍처·데이터 모델·API 계약 초안 8개 작성 | 8개 초안 검토·승인, 정책 결정, 실제 워커/큐 선정, 상세 SQL/OpenAPI/보안/QA 설계 및 검증 |
| 2. 프로젝트·업무 기반 | **미착수** | 없음 | 업무 상태/CRUD/워크스페이스/호환성 |
| 3. 통제된 AI 실행 | **미착수** | 없음 | 서버 모델, 큐/워커, 승인, 예산, 복구 |
| 4. AI PM 통합 | **미착수** | 없음 | 계획→위임→실행→검증→브리핑 |
| 5. AI 인력사무소 MVP | **미착수** | 없음 | 프로필·추천·면담·계약·킥오프 |
| 6. 협업·운영 안정화 | **미착수** | 없음 | 승인함·알림·취소·보안·회귀 |
| 7. 제한 파일럿 | **미착수** | 없음 | 사용자 검증·원가·장애 대응 |

## Phase 0 코드·환경 추가 점검 (2026-10-16)
- **Supabase 프로젝트 발견:** Plan OS 프로젝트의 상태는 `INACTIVE`; 개발 브랜치는 **0개**로 조회됨. `list_migrations`는 DB 연결 시간 초과로 실패해 실제 적용 이력 미확인. 운영 DB 재활성화/마이그레이션/브랜치 생성은 하지 않음.
- **문서 자동저장 위험 보완 브랜치:** [Draft PR #9](https://github.com/happysuyeun-rgb/plan_os/pull/9) (`fix/planos-document-autosave-safety-20261016`, 기반 PR #8): 2초 전역 저장 타이머를 문서별 스냅샷/순차 쓰기로 교체, 문서 전환 중 편집 버퍼 보존, 저장 오류 상태 및 단위 테스트 4개 추가.
- **검증:** [GitHub Actions #38844552645](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38844552645) **SUCCESS**; `npm ci`·TypeScript/build·lint·`npm run test:unit` 전부 통과. 로컬 Node 22 단위 테스트도 4/4 통과.
- **계속 차단:** 브라우저에서 문서 전환/이전 버전 복원·재생성·프로젝트 전환 중 동시 저장 회귀 미실행, 개발 DB RLS 미실행. PR #9는 Draft이며 PR #8 기반으로, **main 병합이나 배포 금지**.

## Phase 0 자동저장·복원 경합 검증 보완 (2026-10-16)
- **별도 수정 Draft PR:** [PR #9](https://github.com/happysuyeun-rgb/plan_os/pull/9)에서 문서 자동저장뿐 아니라 **명시적 버전 복원·단일 AI 재생성·연쇄 재생성**을 문서별 쓰기 대기열로 통합. 기존 편집을 보존하고, 복원/재생성 중 새 입력이 들어오면 이후 편집을 먼저 잃지 않도록 쓰기 순서를 예약함.
- **CI 실측:** 코드 커밋 `abf15fcb9331b6d8675c9cd95edeb1a9644caa03`의 [Actions #38845602357](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38845602357)에서 의존성 설치·TS/빌드·lint·**유닛테스트 11개 PASS**. 중간 실패 CI는 테스트 동기화/기대값 수정 후 재검증함.
- **QA 명세:** [문서 저장 회귀 체크리스트 B-01~12](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-document-autosave-safety-20261016/docs/qa/DOCUMENT_SAVE_REGRESSION.md)를 코드 PR 브랜치에 추가. 브라우저·격리 DB 실증은 **미실행**.
- **새 P0 발견:** `src/lib/api/chat.ts`의 문서 직접 UPDATE가 큐를 우회함. [Issue #10](https://github.com/happysuyeun-rgb/plan_os/issues/10)으로 후속 격리. 버전 복원 중간 실패·동시 version_number 충돌·DocumentPage activeVersion 동기화도 테스트 대기.
- **결론:** PR #9는 **Draft/미병합**, UI·실 DB 검증 전까지 배포/승인 금지. 기존 Plan OS Supabase DB는 INACTIVE, 개발 브랜치 없음.

## Phase 0 채팅 편집 직접 쓰기 제거 (2026-10-16)
- **P0 Issue #10 코드 대응:** [Draft PR #11](https://github.com/happysuyeun-rgb/plan_os/pull/11) (`fix/planos-chat-document-write-20261016`, 기반 Draft PR #9)에서 `src/lib/api/chat.ts`의 `documents.content` 직접 SELECT/UPDATE를 제거하고 `documentStore.applyChatEdit` → 문서별 autosave queue로 연결.
- **화면·대화 격리:** ChatPanel의 중복 `onDocumentUpdate` 저장 제거, 다른 문서·프로젝트 및 과거 버전 상태 보호, 느린 채팅 응답의 다른 문서 메시지 목록 오염 방지, 전송 오류 토스트, 같은 요청의 중복 전송/낡은 로딩 상태 방지. 채팅·버전 목록 재조회는 문서 ID가 바뀔 때만 하도록 수정.
- **실제 CI 통과:** 새 `tests/chatDocumentEdit.test.mjs` 6개 + 기존 11개 = 총 **17개**. 코드 커밋 `108048f4acfb7244c019bb5a8d16c313a3cad4c0`의 [GitHub Actions #38847021222](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38847021222)에서 `npm ci`, TypeScript/빌드, ESLint, **17/17 단위 테스트 PASS(실패 0)** 확인.
- **QA:** [PR #11 브랜치의 회귀 시나리오 C-01~10](https://github.com/happysuyeun-rgb/plan_os/blob/fix/planos-chat-document-write-20261016/docs/qa/DOCUMENT_SAVE_REGRESSION.md) 작성, 브라우저/격리 DB 미실행. **채팅은 여전히 placeholder**, 실제 LLM 호출 아님.
- **남은 차단:** 채팅 메시지 INSERT 성공 후 문서 쓰기 실패 시 멱등성/원자성, 이중 편집 브라우저 검증, 서버 RLS 실증. PR #11 Draft/미병합, Issue #10은 실제 QA 통과 전 열어 둠.

## 제품 정의 현황
- [데이터 모델 v0.2](engineering/DATA_MODEL.md): 실제 001~008 SQL 정적 확인 기반 CURRENT/ TARGET 구분, 신규 AI 엔터티와 기존 generation_runs 분리. DDL·운영 적용 없음.
- [API 계약 v0.2](engineering/API_CONTRACTS.md): TARGET 23개 API와 인증/권한/예산/멱등성/실패 규칙. 서버 구현·테스트 전.

- [권한·승인 정책 v0.2](product/PERMISSIONS_POLICY.md): owner/editor/viewer/outsider/AI 역할, R0~R3 도구 등급, 12개 권한 테스트 계획. **실제 RLS 검증 전**.
- [AI 실행 아키텍처 v0.2](engineering/ARCHITECTURE.md): 영속 워커·ModelGateway·승인·예산·증빙·복구 설계. **구현/공급자 선정 전**.
- [화면별 기능명세 v0.2](ux/SCREEN_SPEC.md): MVP 9개 핵심 화면의 입력/행동/검증/예외/수용 조건, 나머지 14개 화면 통합 전략 작성. 검토 전·미구현.
- [IA 및 화면 목록 v0.2](ux/IA.md): CURRENT 11개 라우트, TARGET 23개 화면 후보, TF 연결·기존 DocumentPage 딥링크 보존 전략. 실제 구현/화면 QA는 미완료.
- [사용자 업무 흐름 TF-01~30 v0.2](product/TASK_FLOWS.md) 작성(브랜치), 검토 전. 진입/행동/산출/실패/권한 정의 및 화면/API/DB 1차 매핑 작성, 1:1 테스트 매핑 미완료.
- [통합 서비스 기획서(PRD v0.2)](product/PRD.md) 작성 완료(브랜치), 검토/승인 전. 목표 제품 범위 정의이지 구현 완료가 아님.
- 기존 `docs/TECH_SPEC.md`는 V1 구현 참조로 보존.

## 작업별 증빙
| 구분 | 항목 | 상태 | 증빙 |
|---|---|---|---|
| 문서 | 기준선 감사 초안 | **부분 작성 / 감사 미완료** | [감사 문서](engineering/BASELINE_AUDIT.md) |
| 문서 | 개발 실행계획 | **브랜치 작성 완료 / 미병합** | [실행계획](roadmap/IMPLEMENTATION_PLAN.md) |
| 문서 | 진행 현황표 | **브랜치 작성 완료 / 미병합** | [이 문서](PROGRESS_STATUS.md) |
| CI | build/lint 워크플로 | **PR #5 미병합; CI 성공 근거는 PR #8 최신 브랜치** | [PR #5](https://github.com/happysuyeun-rgb/plan_os/pull/5) / [성공 실행](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38680673570) |
| 감사 | DB/RLS 정적 감사 | **SQL 8개 검토 완료 / 실제 권한 검증 미완료** | [Issue #2](https://github.com/happysuyeun-rgb/plan_os/issues/2) |
| 품질 | 빌드/테스트/배포 환경 검증 | **PR #9 단위 테스트+CI 통과 / 브라우저·DB 회귀 및 배포 환경 미완료** | [PR #9](https://github.com/happysuyeun-rgb/plan_os/pull/9) / [Actions #38844552645](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38844552645) / [Issue #3](https://github.com/happysuyeun-rgb/plan_os/issues/3) |
| 설계 | 서버 AI 실행/승인/비용 ADR | **아키텍처 v0.2 초안 작성 / 선정·승인 미완료** | [설계 초안](engineering/ARCHITECTURE.md) / [Issue #4](https://github.com/happysuyeun-rgb/plan_os/issues/4) |
| 코드 | 린트 수정 PR #8 | **CI 성공 / 회귀 미검증** | [PR #8](https://github.com/happysuyeun-rgb/plan_os/pull/8) |
| 보안 | RLS 위험 재현·수정 | **정적 위험 발견 / DB 재현 미완료** | [Issue #7](https://github.com/happysuyeun-rgb/plan_os/issues/7) |
| 모델 | FreeLLMAPI 검토 | **외부 문서 검토 완료 / 설치·성능 시험 미착수** | [실행계획](roadmap/IMPLEMENTATION_PLAN.md) |

## 상태 정의
- **완료:** 정의된 수용 기준과 검증을 통과했고 증빙 링크가 있음.
- **브랜치 작성 완료:** GitHub 브랜치에 반영되었으나 PR 미병합. 출시·운영 반영과 구분.
- **진행 중:** 일부 결과가 있으나 완료 조건 미충족.
- **미완료/미착수:** 아직 구현·검증되지 않음.
- **보류:** 의존성·결정·승인 대기. 사유와 해제 조건 명시.
- **차단:** 실제 진행 불가능한 장애. 원인·담당·해결 방법 명시.

## 업데이트 규칙 (모든 향후 작업에 적용)
1. 작업 시작 시 이 문서의 전체 로드맵과 대상 작업 상태를 확인한다.
2. 작업 후 **완료/진행 중/미완료/보류/차단**을 명확히 구분하고 근거를 남긴다.
3. 모든 문서에 최초 작성일·최종 수정일·버전·진행 상태를 기재한다.
4. 수정할 때 최초 작성일은 유지하고 **최종 수정일을 실제 수정 날짜**로 바꾼다. 중요한 수정은 변경 이력에 날짜·내용·근거를 추가하고 버전을 올린다.
5. 코드 작성·PR 생성·CI 통과·병합·운영 반영은 **서로 다른 상태**로 기록한다.
6. 추정 진행률을 임의의 백분율로 표현하지 않는다. 단계별 수용 기준 통과 수를 근거로 산정한다.
7. 작업 보고 시 항상 **전체 계획 / 이번에 완료 / 아직 미완료 / 다음 순서 / 검증·위험**을 포함한다.
8. GitHub 작업에 대한 완료 보고 전에 이 현황표와 문서 인덱스를 같은 브랜치에서 갱신한다.

## 최신 점검 결과 (2026-10-16 — 단일 최신 스냅샷)
- **코드 안전성 추가:** PR #9 자동저장·복원·재생성 직렬화 11개 단위 테스트 CI 통과. PR #11에서 채팅 직접 DB 쓰기를 별도 autosave 경로로 통합하고 테스트 6개를 추가. **둘 다 Draft/미병합**; 브라우저/RLS·메시지 원자성 미검증.
- **제품/설계:** PRD, TF-01~30, IA, SCREEN_SPEC, PERMISSIONS_POLICY, ARCHITECTURE, DATA_MODEL, API_CONTRACTS **8개 v0.2 보완 초안 작성**. 모두 검토/승인 전·미구현. [12개 문서 감사](quality/DOCUMENT_REVIEW_2026-10-16.md)에서 P0~P2 누락/모순 기록.
- **로드맵:** [개발 실행계획 v1.4](roadmap/IMPLEMENTATION_PLAN.md)에 실제 문서 상태·Phase 3 내부 최소 계약 선행·Phase 5 고객 UI 확장 관계 반영. Phase 0은 미완료이며 Phase 1은 선행 초안 작성 상태.
- **CI 검증 완료 범위:** [PR #8 Actions #38680673570](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38680673570), 커밋 `152e33968a90eea9e23dc58c63e4ba1beedc6dc4`에서 npm ci/build/lint **SUCCESS(ESLint 0 errors, 1 warning)**. 이 검증은 **PR #8 브랜치만**의 증빙이며 main/PR #5가 통과하거나 브라우저 E2E가 통과했다는 뜻이 아님.
- **미완료 P0 검증:** 댓글 deep-link, DocumentPage 버전 전환·저장, documentStore 전역 debounce 타이머·문서 전환 데이터 덮어쓰기 위험, ScreenListTable/WireframeSlideView 입력 경합, 프로젝트 복원/모달. 자동 테스트·브라우저 회귀를 아직 실행하지 않음.
- **RLS 정적 위험:** `006` project_members 조회 자기참조, 댓글 작성자·반응 본인 행 변경 제약, 알림 recipient, 활동 위조, 과거 버전 수정·generation_runs 상태 조작. 운영 취약점 확정이 아닌 **개발 DB 재현 필요** 항목. SQL 001~008 정적 검토만 완료.
- **배포·데이터:** 실제 Supabase 적용 마이그레이션, 운영 환경 분리/설정, 모델 API 계약·원가, 서버 AI 워커 동작 확인 미완료. `main` 병합/운영 DB 수정/배포 없음.
- **문서 정합성 보완 완료:** 로드맵·CI 최신 상태, Phase 3 계약 순서, 데이터 유니크 키, 산출물 수락 화면 제안, TF 추적성, API 미완성 구간 표기. [12개 문서 감사 v1.1](quality/DOCUMENT_REVIEW_2026-10-16.md)에 증빙·잔여 항목 정리.
- **다음 순서:** (1) 문서 감사 DQ-04/07~10 실질 차단 사항과 제품 정책 확인 (2) 격리 DB RLS 검증·기존 기능 회귀 (3) 첫 PM+전문 AI 1명/도구 1종 수직 슬라이스의 서버 API/SQL 계약 확정.
- **과거 기록 보존:** 이전 CI 실패·중간 수정 내역은 아래 **변경 이력**과 [기술 감사](engineering/BASELINE_AUDIT.md)에만 기록한다. 이를 최신 상태로 해석하지 않는다.

## 변경 이력
| 날짜 | 버전 | 내용 | 근거 |
|---|---|---|---|
| 2026-10-14 | v1.0 | 전체 로드맵, 완료/미완료 상태, 증빙·보고 규칙 최초 작성 | PR #1, PR #5, Issues #2–4 |
| 2026-10-14 | v1.1 | 중복 준비도 문서를 실행계획에 통합·삭제, 문서 인덱스 간소화 | PR #1 |
| 2026-10-14 | v1.2 | 저장소 전체 목록 확인 및 CI 실패 원인 기록 | CI run 38517379376 |
| 2026-10-14 | v1.3 | 완료 후 후속 실행 규칙 및 린트 수정 Issue #6 추가 | Issue #6 |
| 2026-10-14 | v1.4 | SQL 8개 정적 검토 및 보안 재현 작업 Issue #7 등록 | Issue #7 |
| 2026-10-14 | v1.5 | 린트 1차 수정 PR #8 생성, 검증·잔여 오류 미완료 명시 | PR #8 |
| 2026-10-14 | v1.6 | 프로젝트 API 린트 오류 수정 및 복원 회귀 검증 필요 기록 | PR #8 |
| 2026-10-15 | v1.7 | 완료·미검증 상태 재정리, FreeLLMAPI 검토 반영, CI/RLS/ADR 우선순위 일치 | PR #8, Issues #6/#7 |
| 2026-10-15 | v1.8 | 모달 2종 effect 오류 수정 PR #8 추가, CI·회귀 검증 미완료 기록 | PR #8 |
| 2026-10-15 | v1.9 | 화면 목록·와이어프레임 effect 수정, PR #8 CI 파일 추가 및 실행 미확인 기록 | PR #8 |
| 2026-10-15 | v2.0 | 실제 CI 오류 3건 확인, DocumentPage 상태 갱신 수정, 남은 회귀 위험 기록 | PR #8, Actions #38679535956 |
| 2026-10-16 | v2.1 | 최신 CI 성공(0 errors, 1 warning) 확인, 회귀 테스트 미완료 구분 | Actions #38680673570 |
| 2026-10-16 | v2.2 | 통합 서비스 PRD v0.1 작성, Phase 1 초안 착수 | PR #1 |
| 2026-10-16 | v2.3 | TF-01~30 업무 흐름 초안 작성 및 인덱스 연결 | PR #1 |
| 2026-10-16 | v2.4 | CURRENT 라우트 대조 및 IA/화면 목록 v0.1 작성 | PR #1 |
| 2026-10-16 | v2.5 | 핵심 9개 화면 기능명세 v0.1 및 14개 화면 통합 전략 작성 | PR #1 |
| 2026-10-16 | v2.6 | 권한/승인 매트릭스 및 AI 실행 아키텍처 ADR v0.2 초안 작성 | PR #1 |
| 2026-10-16 | v2.7 | CURRENT SQL 대조 데이터 모델·TARGET API 23개 계약 초안 작성 | PR #1 |
| 2026-10-16 | v2.8 | 12개 문서 교차감사, CI 최신 스냅샷 통일, Phase 3 계약 선행과 P0 결정/검증 누락 반영 | [문서 품질 감사](quality/DOCUMENT_REVIEW_2026-10-16.md) |
| 2026-10-16 | v2.9 | PRD·TF·IA·SCREEN·PERMISSIONS·ARCH·DATA·API 문서 v0.2 정합성 보완 및 감사 해결/미해결 구분 | [문서 감사 v1.1](quality/DOCUMENT_REVIEW_2026-10-16.md) |
| 2026-10-16 | v3.0 | 문서 감사 재검산: CI·아키텍처·TF 매핑의 최신 상태 표현 정리 | [문서 감사 v1.1](quality/DOCUMENT_REVIEW_2026-10-16.md) |
| 2026-10-16 | v3.1 | Supabase Plan OS 비활성/개발 브랜치 없음·마이그레이션 조회 실패, PR #9 자동저장 코드 수정 및 CI/단위 테스트 성공 기록 | [PR #9](https://github.com/happysuyeun-rgb/plan_os/pull/9) / [Actions #38844552645](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38844552645) |
| 2026-10-16 | v3.2 | 버전 복원·AI 재생성 문서별 쓰기 직렬화, 11개 테스트 CI 성공, QA B-01~12/Issue #10 경합 위험 기록 | [Actions #38845602357](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38845602357) / [Issue #10](https://github.com/happysuyeun-rgb/plan_os/issues/10) |
| 2026-10-16 | v3.3 | PR #11 채팅 직접 DB 쓰기 제거, 문서별 저장 큐 연동 및 6개 신규 테스트, 브라우저 QA/C-01~10·원자성 미완료 기록 | [PR #11](https://github.com/happysuyeun-rgb/plan_os/pull/11) / [Issue #10](https://github.com/happysuyeun-rgb/plan_os/issues/10) |
| 2026-10-16 | v3.4 | PR #11 CI #38847021222 실측 build/lint·17개 단위 테스트 성공 기록 | [Actions #38847021222](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38847021222) |

## 연속 실행 원칙
- 업무 종료 시 **완료 → 검증 → 미완료 → 다음 작업 → 바로 실행 가능 여부 → 사용자 승인 필요 사항**을 보고한다.
- 권한과 도구가 허용하고 운영 위험이 없는 후속 작업은 추가 지시를 기다리지 않고 이어서 수행한다. 실제 도구 호출 없이 백그라운드 진행을 주장하지 않는다.
- 운영 DB/배포/결제/PR 병합 등 영향 큰 변경은 별도 승인 이후에만 진행한다.
- 현재 다음 작업: [Issue #10](https://github.com/happysuyeun-rgb/plan_os/issues/10) 채팅 문서 직접 쓰기 경합 안전화 → PR #9 브라우저 B-01~12 QA → Plan OS 격리 개발 DB 확보 후 [Issue #7 RLS 재현](https://github.com/happysuyeun-rgb/plan_os/issues/7).

## 바로 다음 작업
1. [PR #9](https://github.com/happysuyeun-rgb/plan_os/pull/9): 자동저장·복원·재생성 단위 테스트 11개/CI 통과. [Issue #10](https://github.com/happysuyeun-rgb/plan_os/issues/10) 채팅 문서 직접 쓰기 경합 및 B-01~12 실제 브라우저 회귀 검증 전까지 Draft 유지.
2. [Issue #7](https://github.com/happysuyeun-rgb/plan_os/issues/7): 현재 Plan OS DB 비활성·개발 브랜치 없음. 별도 격리 DB와 역할 계정 확보 후 RLS 재현 및 수정 PR.
3. [Issue #2](https://github.com/happysuyeun-rgb/plan_os/issues/2): SQL 정적 감사 이후 실제 적용 상태 및 권한 검증 마무리.
4. [Issue #3](https://github.com/happysuyeun-rgb/plan_os/issues/3): CI 재검증 및 회귀 기준선.
5. [Issue #4](https://github.com/happysuyeun-rgb/plan_os/issues/4): AI 실행 아키텍처 ADR.
