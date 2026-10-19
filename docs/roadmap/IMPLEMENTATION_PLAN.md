# PlanOS 3.0 — 단계별 개발 실행계획

**최초 작성일:** 2026-10-14  
**최종 수정일:** 2026-10-19  
**문서 버전:** v2.1  
**진행 상태:** 잔여 기간 재산정 유지 / Phase 0 로컬 Supabase Auth/JWT/REST 009·010 권한 CI 통과, 브라우저·기타 데이터 정합성/운영 승인 대기  

## 원칙
- 기존 로그인·프로젝트·문서·버전·협업 기능을 보호한다.
- 모든 구현은 별도 브랜치 → 검증 → PR → 승인 후 병합 순서로 진행한다.
- 운영 Supabase DB, 결제, 배포 설정은 별도 승인 없이 변경하지 않는다.
- '완료'는 코드 작성이 아닌 수용 기준 및 검증 결과로 판정한다.
- 예상 기간은 1인 개발 및 AI 보조 기준의 **잠정 작업일**이며 확정 납기가 아니다.

## 단계별 계획

| 단계 | 예상 작업일 | 주요 작업 | 완료 조건 | 선행 조건 | 상태 |
|---|---:|---|---|---|---|
| 0. 기술 기준선 | **잔여 5–10일** | 저장소/SQL 8개 정적 감사, RLS 권한 재현·수정 계획, 배포·환경, CI 린트, 회귀 기준 | CI 통과 + 권한 재현/대응 판정 + KEEP/MODIFY/NEW + 증빙 | 없음 | 진행 중 |
| 1. 기획·아키텍처 확정 | **잔여 3–6일** | PRD·30 TF·IA·화면명세·권한/아키텍처·API/DB **초안 작성**; 정책 확정·보안/QA·워커 선택은 남음 | E2E·권한·모델·비용·승인 정책 및 테스트 계약 승인 | Phase 0 통과(문서 초안은 선행 가능) | **초안 부분 착수 / 확정 미완료** |
| 2. 프로젝트·업무 기반 | 5–8일 | 프로젝트 워크스페이스, task 상태·종속성, 기존 URL 유지 | 기존 문서 회귀 + task CRUD 테스트 | Phase 1 | 예정 |
| 3. 통제된 실제 AI 실행 | 8–15일 | **내부 최소 AI 역할·계약·capability·예산/승인 선행** 후 서버 모델 호출, 큐/워커, 실패 복구, 모델별 기능 검증 | 실제 산출물 + 중단/재시도·테넌트 격리·비용상한 테스트 | Phase 2 및 권한 차단 해소 | 예정 |
| 4. AI PM 수직 통합 | 6–10일 | 계획→위임→실행→검증→승인→브리핑 | PM + 전문 에이전트 1명 E2E 통과 | Phase 3 | 예정 |
| 5. AI 인력사무소 MVP | 6–10일 | **Phase 3 내부 최소 계약을 고객용 UX로 확장**: 역할 프로필·추천·면담·조건 검토·계약·킥오프 | 채용→업무 착수 연결 테스트 | Phase 4 | 예정 |
| 6. 협업·운영 안정화 | 5–10일 | 공동 편집, 승인함, 활동 로그, 알림, 취소/복구 | 회귀·보안·비용 테스트 | Phase 5 | 예정 |
| 7. 제한 파일럿 | 5–10일 | 관측성, 지원·장애 대응, 사용자 검증, 수정 | 파일럿 수용 기준 + 원가 검증 | Phase 6 | 예정 |

**기존 추정:** 42–75 작업일(초기 전체 기간). **2026-10-16 재산정 잔여 추정:** **43–79 작업일**(전담 개발 1명+AI 보조, 주 5일 기준 약 9~16주; 신규 결함/외부 승인 대기 별도). Phase 0 5~10일, Phase 1 기획 초안 승인 3~6일, Phase 2 5~8일, Phase 3 8~15일, Phase 4 6~10일, Phase 5 6~10일, Phase 6 5~10일, Phase 7 5~10일. 이 추정은 개발 일정 가정이지 제품 완성도 %, 납기 약속이 아니다.

## 2026-10-16 B-05 실제 복원 검증 후 다음 단계
- **B-05 저장된 현재 버전 정상 경로 PASS:** [격리 Chromium #38869950232](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38869950232), Vite→실제 로컬 GoTrue Auth/JWT→PostgREST→DB로 명시적 v1/v2 저장, v1 읽기전용 확인, v3 복원, 원본 스냅샷 2건 유지 및 리로드 문서 일치 확인. 현재 소스 17개 unit CI [#38869950358](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38869950358) 성공.
- **새 P0 우선순위:** [Issue #16](https://github.com/happysuyeun-rgb/plan_os/issues/16) 복원 2개 DB 작업 비원자성, 미저장 최신 원고 보존 및 동시 버전 번호 경합 → 재현(실패 주입)·서버 트랜잭션/멱등성·되돌리기 QA. 기존 C-03 채팅/문서 이동, B-03/B-04 느린 저장/오프라인, 역할·초대/댓글/알림/휴지통 E2E는 그대로 P0.
- **잔여 수:** B/C 22개 중 B-01/B-02/B-05 **정상 경로**/C-01 4개 확인, 다른 18개 미실행. 원자성·오류 복구를 포함한 'B-05 전체 완료'와 정상 경로의 성공은 구분한다.
- **일정:** Phase 0 잔여 **5~10 작업일**, 제품 전체 **43~79 작업일** 잠정 유지. 새 P0 결함 수정 범위에 따라 상향 가능. 종료/운영 반영은 사용자 사전 승인 후.

## 2026-10-16 누락 점검 후 Phase 0 다음 실행 순서
- **완료 실증:** [Chromium #38867796404](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867796404) B-01 PRD→기능명세서 빠른 전환, B-02 동일 문서 5회 연속 편집, C-01 미저장 초안과 채팅 요청 병합, 일회용 DB 최종 내용, 문서 입력 중 댓글 GET 0회 **PASS**. [PR #11](https://github.com/happysuyeun-rgb/plan_os/pull/11) 댓글 의존 변경/낡은 응답 가드 및 CI [#38867723560](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38867723560) 성공.
- **다음 P0 순서:** (1) B-05 과거 버전 복원과 버전 기록 (2) C-03 채팅 응답이 늦는 동안 문서/프로젝트 전환 (3) B-03/04 느린 저장·네트워크 실패 복구 (4) B-06~09 재생성과 신규 사람 입력 (5) 실제 팀 초대/역할 변경/댓글/알림/휴지통/복원 사용자 흐름 (6) 채팅 서버 원자성/버전 경합·soft-delete RLS/스푸핑 보안.
- **잔여 커버리지:** 기존 B-01~12/C-01~10 = 22개 중 **격리 브라우저 3개 PASS, 19개 미실행**. 위 시나리오별 결함 수정·재검증 시간은 아직 확정 불가.
- **일정은 보수 유지:** Phase 0 **5~10 전담 작업일**, 전체 **43~79 작업일**. 로그인·기본 화면 및 저장 일부 테스트 성공만으로 검증·릴리스 완료 아님.
- **경계:** 운영 Supabase 마이그레이션 `001~008` 그대로, `009/010` 격리 전용, main/배포/유료 인프라 미변경, Draft PR #15 및 소스 PR 미병합.

## 2026-10-16 통합 브랜치 및 브라우저 검증 단계 진입
- **테스트 전용 [Draft PR #15](https://github.com/happysuyeun-rgb/plan_os/pull/15)**: 문서/채팅 PR #9·#11과 보안 PR #13·#14를 두 부모 통합 커밋으로 결합(운영 main 미변경).
- **격리 CI 3종 통과:** 앱 npm ci/TS/build/lint/17 유닛 [#38855752421](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38855752421); RLS 42P17 before/009 after [#38855752463](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38855752463); 실제 로컬 Supabase Auth/JWT/REST 001~010 [#38855748722](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38855748722).
- **최초 실제 브라우저 스모크 통과:** Playwright Chromium [#38856198235](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38856198235)에서 임시 로그인·프로젝트/PRD 조회 및 리로드 SUCCESS. **전체 브라우저 QA 완료가 아닌 Phase 0 부분 진척**.
- **남은 중요 경로:** 브라우저 B-01~12/C-01~10 및 owner/editor/viewer 초대/댓글/알림·버전·휴지통·복원 회귀, 채팅/문서 원자성, 기타 RLS/참조 무결성, 백업·롤백·병합 승인.
- **잔여 추정:** Phase 0 5~10 작업일, 전체 43~79 작업일 보수적으로 유지. QA 단계에 진입했지만 결함을 확인하기 전 일정을 인위적으로 줄이지 않음.

## 2026-10-16 Phase 0 업데이트 — 격리 Supabase SQL·Auth·REST 권한 보완 진척
- **009:** [Draft PR #13](https://github.com/happysuyeun-rgb/plan_os/pull/13)의 `project_members` 재귀 제거·pending 본인 초대 행 유지, 일회용 PostgreSQL 17 [#38849011220](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38849011220) + 로컬 Supabase Auth/JWT/REST [#38852999398](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38852999398) 테스트 PASS.
- **010:** 별도 [Draft PR #14](https://github.com/happysuyeun-rgb/plan_os/pull/14)에서 댓글 소유권/soft-delete, 반응·참여 본인 행, 알림 actor·recipient/읽음, 문서 버전 과거 수정 차단. 실제 Auth/JWT/REST [#38854258418](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38854258418) CSEC-01~12 성공.
- **남은 P0:** 실제 웹 UI 초대·팀·삭제/복원·댓글/알림/버전 회귀, 저장/채팅 PR #9/#11 브라우저 B-01~12/C-01~10, 메시지/문서 저장 원자성, activity 알림 payload/프로젝트 참조 무결성 정책, 백업/롤백·보안 승인.
- **기간:** Phase 0 잔여 5~10 작업일, 전체 43~79 작업일(전담 개발자+AI 보조 기준) **잠정 유지**. 009/010 격리 테스트는 완료했지만 실제 UI/운영 이행 및 신규 결함 가능성이 있어 무리하게 기간을 단축하지 않음.
- **운영 변경:** 운영 Plan OS DB는 migrations 001~008 상태로 조회됐으며 009·010은 **미적용**. `main` 병합·배포도 미실행.

## 2026-10-16 남은 Phase 0 세부 일정 (잠정)
| 업무 | 남은 작업일 | 검증/차단 기준 |
|---|---:|---|
| 격리 테스트 환경 | 0.5~1.5 | **일회용 PostgreSQL 17 CI 완료**, 실제 Supabase Auth/JWT 검증 환경은 별개 |
| RLS 재귀 정책·역할별 테스트 | 1~2 | **migration 009 PostgreSQL 17 CI 통과**, Supabase JWT/초대·삭제/복원 미확인 |
| 다른 댓글/반응/알림/버전 권한 | 1~2 | 원치 않는 타인 데이터 수정 차단, 별도 PR |
| PR #9/#11 브라우저 B-01~12, C-01~10 회귀 | 1.5~3 | 실제 앱에서 데이터 유실·잘못 저장 없음 |
| 메시지 INSERT↔문서 저장 원자성/멱등성 | 1~2 | 실패·재시도 시 고아 메시지/중복 내용 없음 |
| CI·QA 보완/리뷰·릴리스 게이트 | 0.5~1.5 | 통과 증빙·백업·롤백·명시적 승인 |

**세부 단순 합계:** 약 5.5~12 작업일(일부 중첩 가능). **Phase 0 총 잔여 계획:** 5~10 작업일, 단 별도 Supabase 검증 환경 구축과 실제 발견 결함에 따라 상향 가능. 작업일은 전담 기준이며 주말·승인 대기·과금 승인 시간을 포함하지 않음.

**새 검증 실적:** [PR #13](https://github.com/happysuyeun-rgb/plan_os/pull/13)에서 `009`가 초대 대기자의 자기 행 조회를 보존하도록 수정. GitHub Actions [#38849011220](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38849011220) 임시 PostgreSQL 17 환경에서 실제 migrations 001~008 적용 후 재귀 재현, 009 적용, 소유자·편집자·열람자·초대 대기자·타 프로젝트·외부인·anon SQL 권한 테스트 **SUCCESS**. **운영 Supabase에는 미적용**.

## 현재 진행 정합성 (2026-10-16)
- PR #8 [CI #38680673570](https://github.com/happysuyeun-rgb/plan_os/actions/runs/38680673570)에서 build/lint **통과(0 errors, 1 warning)** 확인. 이전 lint 실패는 이력이며 회귀·RLS 테스트는 미완료.
- Phase 1 제품·설계 **8개 문서 초안 선행 작성**. Phase 0 미통과이므로 Phase 1 확정/Phase 2 구현 착수로 간주하지 않음.
- **의존성 정리:** Phase 3에는 내부 최소 AI 역할·계약·승인·예산 정보가 필요함. Phase 5는 그 기반을 고객용 인력사무소 탐색/면담/계약 UX로 확장함. 계약 전체를 Phase 5까지 미루지 않음.
- 미확정 주요 정책: 첫 전문 AI 실제 작업 1종, 승인 위임, R2 도구, 과금·환불/보존, 워커/큐·모델 공급자 선정.
- 자세한 P0 차단 이슈는 [문서 정합성 감사](../quality/DOCUMENT_REVIEW_2026-10-16.md)에 기록.

## 2026-10-19 Phase 1 P1-1 설계 산출물·남은 게이트
- **선행 기획 작업 완료(문서 범위):** [첫 전문 AI 업무 선정·수용 기준](../product/FIRST_SPECIALIST_AI_MVP_2026-10-19.md) — 후보 3종 비교, `requirements_auditor_v1` 권고, 문서 읽기만 허용한 최소 수직 슬라이스, PM/전문 AI/서버 검증기 역할·12개 AC·FR/TF/API/DB 연결 작성.
- **아직 미완료:** D-01 실제 제품 선택/사용자 승인, 실제 검사 정확성 fixture/사용자 평가, D-05 권한 정책, 비용·유료 공급자·보존, 워커·큐 제품 ADR, API/SQL/Threat Model/QA Plan/Release Runbook, Phase 0 차단.
- **다음 순서:** (1) P1-2 최소 계약/권한·실행/비용 정책 (2) P1-3 1회 사용자 여정 UX (3) P1-4 워커/ModelGateway 기술 ADR (4) P1-5/6 검증 가능한 API/DB·QA → P1-7 교차 검수. 설계 문서 작성만으로 Phase 1 전체 DONE 처리 금지.
- **추정:** 종전 Phase 1 잔여 3~6 전담 작업일/전체 43~79 작업일은 초기 잠정치이며 이번 문서 작성으로 자동 단축하지 않는다.

## 2026-10-19 Phase 1 P1-2 정책 초안·P1-1 재검수
- **설계/정합성 [x]:** [교차 감사 AUD-01~12](../quality/PHASE1_CROSS_AUDIT_2026-10-19.md) 후 PM 유료 계획 생성 전 **owner의 계약·데이터 처리·PM 모델 호출 예산 동의** 조건을 PRD·TF·ARCH·SCREEN·PERMISSIONS·DATA_MODEL·API와 맞춤.
- **P1-2 문서 초안 [x]:** [MVP 계약·승인·비용 정책안](../product/MVP_CONTRACT_APPROVAL_COST_POLICY_2026-10-19.md) — 계약 범위/권한·R0/R1 도구 제한·R2/R3 차단, 실비/청구/예산 구분, 실패·재시도·취소·정산, 고지/보존, POL-01~12 **시나리오 정의**.
- **D-01/P1-2 확정 [ ]:** 첫 전문 AI 최종 선택, 공급자 약관·실제 비용, 기본 한도/가격·무료 체험·환불·보존·결제/법적 정책 승인. 정해지지 않은 숫자나 출고 시기를 단정하지 않는다.
- **다음:** P1-3 UX_FLOWS → P1-4 워커/ModelGateway/원장 ADR → P1-5 API/OpenAPI·DB/RLS → P1-6 Threat Model/TEST_PLAN/Runbook → P1-7 최종 대조. Phase 0 완료 및 사용자 운영 승인 전 Phase 2 코드/DB 실투입 금지.
- **기간:** 기존 3~6 Phase 1 전담 작업일·43~79 전체 개발 작업일은 10/16 잠정치. 정책 승인·실제 검증에 따라 재산정 필요, 이 문서 진척만으로 일정 단축하지 않는다.

## 구현 전 필수 결정 및 누락 사항 (기존 준비도 문서 통합)
| ID | 결정할 사항 | 통과 기준 |
|---|---|---|
| R-01 | MVP 범위를 PM + 실제 실행 가능한 전문 역할 1~2개로 제한 | 한 개 실제 E2E 루프 검증 |
| R-02 | 기존 DB·URL·문서 호환성 | 기존 프로젝트 및 문서 회귀 통과 |
| R-03 | 서버 큐·워커·스케줄·복구 방식 | 로그아웃·재시도·취소·중복 방지 검증 |
| R-04 | 모델 비용 예약·정산·상한·환불 | 중복 과금·무단 초과 비용 방지 |
| R-05 | 작업별 품질 기준 및 결과 출처 | 검증된 산출물과 단순 실행 성공 구분 |
| R-06 | 프롬프트 인젝션·비밀 유출·테넌트 격리 위협 모델 | 권한 우회 실패 테스트 |
| R-07 | 개발·스테이징·운영 환경 분리 | 운영 데이터 없이 E2E 검증 |
| R-08 | 장애·지원·계약·결제·보존 운영 절차 | 담당·대응·에스컬레이션 정의 |

추가 공통 요구사항: 구조화 로그/trace ID, 멱등성·동시성, 모델 공급자 장애 대응, 승인 만료·철회, 데이터 삭제·내보내기·동의, 접근성, 성능 제한, 지표, feature flag, 긴급 중단 스위치.

**작성된 초안(2026-10-16, 모두 미승인):** [PRD](../product/PRD.md), [TF-01~30](../product/TASK_FLOWS.md), [IA](../ux/IA.md), [화면명세](../ux/SCREEN_SPEC.md), [권한 정책](../product/PERMISSIONS_POLICY.md), [AI 아키텍처](../engineering/ARCHITECTURE.md), [데이터 모델](../engineering/DATA_MODEL.md), [API 계약](../engineering/API_CONTRACTS.md). **미작성·미확정:** `docs/ux/UX_FLOWS.md`, `docs/security/THREAT_MODEL.md`, `docs/qa/TEST_PLAN.md`, `docs/operations/RELEASE_RUNBOOK.md`, ModelGateway 구현/기술선택 ADR 및 OpenAPI/SQL 상세. [문서 정합성 감사](../quality/DOCUMENT_REVIEW_2026-10-16.md) 참조.


## FreeLLMAPI 활용 검증 계획 (2026-10-15, 계획 상태: 미착수)
**검토 대상:** https://github.com/tashfeenahmed/freellmapi (MIT, 자체 호스팅, OpenAI 호환 API). **결정:** 내부 개발·비식별 테스트용 후보로만 평가. 고객 서비스 운영용 무료 풀 직접 연결 금지. 공식 README의 개인 실험용·운영 비권장 고지 및 각 제공업체 약관을 우선한다.

### 적용 범위 및 순서
1. **Phase 0 후반 / Phase 1:** 공급자별 상업 이용·데이터 처리 약관, API 키 보안, tool calling·JSON 응답 적합성 조사. 실제 계정·키 확보는 별도 준비.
2. **Phase 1:** 서버 측 `ModelGateway` 인터페이스 설계. PlanOS에서 tenant 인증, 요청별 예산, 모델 허용 목록, 감사 로그, 출력 검증을 책임지고 FreeLLMAPI는 선택적 provider adapter로만 연결.
3. **Phase 3 전 개발 실험:** 격리된 로컬/테스트 환경에 고정 버전 설치. 외부 노출·실고객 데이터·운영 Supabase 접근 금지. 공식 유료 모델을 대조군으로 업무 5종 × 20회씩 비교.
4. **검증 게이트:** 성공률 ≥95%, 구조화 도구 호출 정확성 ≥98%, 짧은 텍스트 p95 ≤20초, 품질 기준 모델의 ≥85%, 보안·약관 위반 0건(초기 목표; 표본 한계 명시).
5. **판정:** 통과 시 내부 테스트에 한정해 선택적으로 사용. 미통과 시 사용하지 않음. 고객 운영용 사용은 별도 공급자 계약·보안·멀티테넌트 검증과 승인 후 재심사.

### 위험·보호 조치
- FreeLLMAPI는 단일 사용자용이며 자체 per-user billing/multi-tenant auth 미지원. **PlanOS의 권한·과금·승인·작업 상태 엔진을 대체하지 못함.**
- 제공업체 무료 쿼터는 가변적이고 SLA 없음. 추정 7.4B tokens/month는 프로젝트의 사용 가능 용량이나 원가 절감 보장치가 아님.
- 프롬프트·출력은 활성화한 외부 모델 제공업체로 전송됨. 민감 데이터 금지 및 데이터 지역·보관 정책 확인.
- 자동 fallback은 모델 성능/도구 호출/JSON 출력 품질을 바꿀 수 있으므로 모델별 capability gate와 결과 검증이 필수.
- 설치 스크립트 파이프 실행 금지, 릴리스 고정·이미지 검사·비밀 관리·localhost 바인딩을 우선.
- 실제 도입·성능 수치는 **아직 검증하지 않았으며**, 이 항목은 개발 백로그 계획일 뿐임.

## 개발 의존성 및 단계 진입 게이트 (2026-10-15)
- **Phase 0 종료 전:** [Issue #6](https://github.com/happysuyeun-rgb/plan_os/issues/6) lint/build CI 통과 및 문서·프로젝트 회귀 확인, [Issue #7](https://github.com/happysuyeun-rgb/plan_os/issues/7) RLS 재현과 위험 차단/수정 계획, 운영 적용 마이그레이션 읽기 전용 확인. 실제 DB 재현 불가 시 차단 사유 기록 후 Phase 3 진입 금지.
- **Phase 1 종료 전:** AI PM/전문 AI 역할별 권한·도구·데이터 접근 정의, ModelGateway와 공급자 어댑터 인터페이스, 작업 상태 전이/멱등성, 실패·취소·승인 만료, 비용 한도 ADR 확정.
- **Phase 2 종료 전:** 기존 프로젝트·문서 URL/편집·복원·버전 흐름 회귀 및 작업 CRUD/권한 테스트.
- **Phase 3 종료 전:** 서버 측 실실행/결과 검증·비용 기록, 공급자 장애 대체 시 capability 검증, 테스트 계정 간 데이터 격리.
- **FreeLLMAPI:** 실험용 후보이며 제품 핵심 기능 개발의 필수 의존성 아님. 테스트 계정·키·격리 환경 없으면 도입을 보류하고 공식 모델 API 어댑터로 진행. 운영 사용은 별도 승인.

## 우선순위 실행 백로그 (2026-10-16 기준)
1. [Issue #6](https://github.com/happysuyeun-rgb/plan_os/issues/6) / [PR #8](https://github.com/happysuyeun-rgb/plan_os/pull/8): CI build/lint 통과 확인. 남은 1개 경고와 프로젝트 복원·문서 편집 회귀 검증, 테스트 자동화.
2. [Issue #7](https://github.com/happysuyeun-rgb/plan_os/issues/7): 별도 개발 DB에서 RLS 재귀/댓글·반응 권한 재현 → 수정 마이그레이션 초안(운영 적용 금지).
3. [Issue #2](https://github.com/happysuyeun-rgb/plan_os/issues/2) / [Issue #3](https://github.com/happysuyeun-rgb/plan_os/issues/3): 실제 적용 마이그레이션·배포/환경 및 CI 증빙 정리, KEEP/MODIFY/NEW 확정.
4. [Issue #4](https://github.com/happysuyeun-rgb/plan_os/issues/4): ModelGateway·서버 워커·승인·비용·권한 ADR 설계.
5. FreeLLMAPI 내부 실험은 계정/약관/격리 환경이 준비될 때 별도 검증; 준비되지 않아도 본 개발 차단하지 않음.
6. Phase 0 수용 기준 확인 후 전체 기간 재산정.

## 릴리스 기준
- P0 사용자 여정: 프로젝트 생성→AI 채용→PM 계획→실제 실행→산출물 검증→승인→브리핑.
- 프로젝트/사용자 데이터 격리 및 서버 측 권한 검증.
- 중복 실행·중복 과금·예산 초과 방지.
- 오류/재시도/취소/승인 만료 및 로그아웃 후 실행 시나리오 통과.
- 기존 로그인, 프로젝트, 문서·버전, 내보내기 기능 회귀 테스트 통과.
- 비용 추적 및 장애 대응 절차 문서화.

## 변경 이력
| 날짜 | 내용 | 근거 |
|---|---|---|
| 2026-10-14 | 개발 준비도·누락 항목 등록 | PR #1 |
| 2026-10-14 | 코드 기준선 감사 초안 등록 | PR #1 |
| 2026-10-14 | CI 기준선 워크플로 초안 등록 | PR #5 |
| 2026-10-14 | 개발 실행계획 최초 작성 | 이 문서 |
| 2026-10-14 | v1.1: 준비도 문서의 핵심 결정·요구사항을 실행계획으로 통합 | PR #1 |
| 2026-10-15 | v1.2: FreeLLMAPI 내부 검증·도입 게이트를 기존 계획에 통합 | 외부 저장소 정적 검토 |
| 2026-10-15 | v1.3: Phase 진입 게이트·RLS/CI 우선순위·선택적 모델 도입·일정 재산정 조건 명확화 | Issues #2, #3, #6, #7 |
| 2026-10-16 | v1.4: 신규 기획/설계 8개 초안 상태, CI 성공, Phase3 계약 선행 의존성, 감사 링크 정합화 | 문서 점검·Actions #38680673570 |
| 2026-10-16 | v1.5: Phase 0 세부 업무·전체 잔여 43~79 작업일로 재산정, 격리 PostgreSQL 17 RLS SQL 검증 성공 반영 | Actions #38849011220 / PR #13 |
| 2026-10-16 | v1.6: PR #13(009) 및 PR #14(010) 실제 일회용 Supabase Auth/JWT/REST 권한 CI 통과, 브라우저/기타 보안 차단·잔여 기간 유지 기록 | Actions #38852999398 / #38854258418 |
| 2026-10-16 | v1.7: PR #15 테스트 전용 앱+RLS 통합/앱 CI·RLS Auth·실제 Chromium 로그인·문서 스모크 통과, 전체 UI QA 미완료와 단계별 잔여 일정 유지 | Actions #38855752421 / #38855748722 / #38856198235 |
| 2026-10-16 | v1.8: B-01/B-02/C-01 격리 브라우저+DB PASS, 댓글 GET 반복 문제 수정 및 19개 잔여 B/C 우선순위 재정렬 | Actions #38867796404 / PR #11, #15 |
| 2026-10-16 | v1.9: B-05 정상 버전 저장·읽기전용 미리보기·v3 복원 Chromium/DB PASS, 18개 B/C 잔여·원자성 P0 이슈 #16 및 다음 순서 반영 | Actions #38869950232 / Issue #16 |

## 관련 자료
- [진행 현황 인덱스](../README.md)
- [기술 감사](../engineering/BASELINE_AUDIT.md)
- [PR #1](https://github.com/happysuyeun-rgb/plan_os/pull/1)
- [PR #5](https://github.com/happysuyeun-rgb/plan_os/pull/5)
- [Issue #2](https://github.com/happysuyeun-rgb/plan_os/issues/2)
- [Issue #3](https://github.com/happysuyeun-rgb/plan_os/issues/3)
- [Issue #4](https://github.com/happysuyeun-rgb/plan_os/issues/4)

| 2026-10-19 | v2.0: 첫 전문 AI P1-1 후보 비교·기획 검수 AI 권고/12개 AC 문서화; D-01 승인 및 Phase 0/나머지 Phase 1 차단 명시 | [설계안](../product/FIRST_SPECIALIST_AI_MVP_2026-10-19.md) / Draft PR #1 |
