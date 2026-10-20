# PlanOS 문서 인벤토리·이동 대장 — 2026-10-21

**범위 제한:** GitHub main에서 직접 조회한 주요 문서 16개 + 연관 구문서 9개. 도구상 전체 디렉터리 열거가 불가능해 전수조사 완료로 간주하지 않는다. Cursor 로컬 `git ls-files docs`로 확인 예정.

| 파일 | 분류 | 처리 |
|---|---|---|
| product/PRD.md | CURRENT | 유지 |
| product/FUNCTIONAL_SPEC_V1_2026-10-20.md | CURRENT | 유지 |
| product/SERVICE_PLAN_V1_2026-10-20.md | CURRENT | 유지 |
| product/SERVICE_OPERATIONS_POLICY_V1_2026-10-20.md | CURRENT | 유지 |
| product/TASK_FLOWS.md | REFERENCE | 유지 |
| ux/SCREEN_SPEC.md, ux/IA.md | REFERENCE | 유지 |
| engineering/MVP_BUILD_READY_SPEC_2026-10-20.md | CURRENT | 유지 |
| engineering/ARCHITECTURE.md, engineering/DATA_MODEL.md, engineering/API_CONTRACTS.md | REFERENCE | 유지 |
| plans/PLANOS_INTEGRATED_EXECUTION_PLAN_2026-10-21.md | CURRENT | 유지 |
| quality/S1_TASK_CROSS_AUDIT_2026-10-20.md | REFERENCE | 유지 |
| quality/PHASE1_CROSS_AUDIT_2026-10-19.md | REFERENCE | 유지 |
| quality/DOCUMENT_REVIEW_2026-10-16.md | REFERENCE | 유지 |
| TECH_SPEC.md | ARCHIVE | 원문 → archive/legacy-v1/TECH_SPEC.md, 원 경로 안내 유지 |

**정리 정책:** CURRENT는 위치 유지. 구문서는 원문 보존+구 경로 redirect. 원문 상대링크 검수 전 삭제 금지. PR #15/#19 미병합 자료 이동 보류.

## 진행 체크
- [x] 주요 16개 파일 1차 직접 확인·분류
- [x] 과거 V1 기술명세 원문을 archive/legacy-v1에 복사
- [x] 구 경로에 최신 명세 링크 안내 유지
- [ ] 저장소 전체 문서 목록 확보 및 구문서 전체 분류
- [ ] Markdown 상대링크·코드/CI 경로 실제 검사
- [ ] 문서정리 PR 검토 및 병합

## 2026-10-21 추가 참조 조사 — 이전 V1 기술명세가 참조하는 구문서

다음 9개 파일은 실제 GitHub 경로 존재를 확인했지만 **현재 기능/테스트에서의 사용 여부를 전수 확인하지 못했기 때문에 REVIEW로 유지하고 이동하지 않음**.

| 파일 | 상태 | 이동 결정 |
|---|---|---|
| `docs/DEV_GUIDE.md` | REVIEW | 사용자 개발환경/스크립트 참조 확인 후 |
| `docs/MOCK_GAP_REVIEW.md` | REVIEW | 현행 결함 대장 중복 확인 후 |
| `docs/HISTORY_AND_EXPORT_DESIGN.md` | REVIEW | 현행 기능과 대체 문서 확인 후 |
| `docs/EXPORT_FORMATS_DESIGN.md` | REVIEW | 코드/문서 인용 확인 후 |
| `docs/MEMBER_PERMISSIONS_DESIGN.md` | REVIEW | 현재 RLS/멤버 설계와 중복 확인 후 |
| `docs/MEMBER_COMMENTS_DESIGN.md` | REVIEW | PR #15 연관성 확인 후 |
| `docs/PROJECT_TRASH_DESIGN.md` | REVIEW | 기존 휴지통 QA 근거 확인 후 |
| `docs/DASHBOARD_NOTIFICATIONS_DESIGN.md` | REVIEW | 알림 구현 참조 확인 후 |
| `docs/DOC_LAYOUT_DESIGN.md` | REVIEW | 화면/복원 설계 참조 확인 후 |

**링크 검수:** `archive/legacy-v1/TECH_SPEC.md`에 있는 기존 상대링크 9개 목적지를 현재 브랜치에서 직접 조회해 **9/9 존재 확인**. 전체 Markdown·CI·기타 코드 참조의 전수 검증은 별도 미완료로 유지.

## 2026-10-21 전수 파일목록/링크 검사 갱신

- GitHub Actions #39494903607에서 `git ls-files`로 **전체 추적 Markdown 46개** 목록을 확보했고, **상대링크 348개가 모두 유효**한 것을 검증함. 이 수치는 Markdown 파일 수이며 docs 외 README 등이 포함됨.
- 검사 범위: 모든 git 추적 `.md` 문서의 일반 Markdown 인라인 상대경로. 참조형 링크, 위키 링크, 소스 코드/CI가 동적으로 만드는 경로, 내용의 최신성은 검사되지 않음.
- 기존 문서 전수 목록 미확인 표기는 **해소됨**. 대신 코드·CI·비정형 문서 참조 경로 검증을 미완료로 남김.

### 추가 문서 분류
| 파일군 | 분류 | 근거·처리 |
|---|---|---|
| `docs/DEV_GUIDE.md`, `USER_TASKS.md`, `MOCK_GAP_REVIEW.md` | ARCHIVE 후보·REVIEW | 2026-06 이전 운영 기준·구 마이그레이션 설명; 현행 코드/스크립트 참조 전수 점검 전까지 위치 유지 |
| `docs/DASHBOARD_NOTIFICATIONS_DESIGN.md`, `DOC_LAYOUT_DESIGN.md`, `EXPORT_FORMATS_DESIGN.md`, `HISTORY_AND_EXPORT_DESIGN.md`, `MEMBER_COMMENTS_DESIGN.md`, `MEMBER_PERMISSIONS_DESIGN.md`, `PROJECT_RENAME_DESIGN.md`, `PROJECT_TRASH_DESIGN.md` | LEGACY-REFERENCE | V1 설계이나 현재 기존 기능의 상세 근거일 수 있어 보존·위치 유지 |
| `docs/PROGRESS_STATUS.md`, `docs/roadmap/IMPLEMENTATION_PLAN.md` | REVIEW·중복관리 | 현행 실행계획서와 완료 상태 및 과거 브랜치/PR 표기 충돌 가능. 먼저 대조/최신 링크 보강 |
| `docs/engineering/BASELINE_AUDIT.md` | REFERENCE | G1 기존 데이터 안전 검증 근거이므로 이동 보류 |
| `docs/operations/RELEASE_RUNBOOK_2026-10-20.md` | CURRENT-DRAFT | 릴리스 게이트 유지, 출시 완료 아님 |
| `docs/engineering/AI_API_DB_CONTRACT_P1_5_2026-10-20.md`, `AI_EXECUTION_ADR_002_2026-10-20.md` | REFERENCE | 신규 기술 설계·선행 승인 관련 |
| `docs/product/FIRST_SPECIALIST_AI_MVP_2026-10-19.md`, `MVP_CONTRACT_APPROVAL_COST_POLICY_2026-10-19.md`, `PERMISSIONS_POLICY.md` | REFERENCE | 기능·정책 상세 근거 |
| `docs/quality/PHASE1_P5_REAUDIT_2026-10-20.md`, `PHASE1_UX_ARCH_AUDIT_2026-10-20.md`, `TEST_PLAN_2026-10-20.md`, `THREAT_MODEL_2026-10-20.md` | REFERENCE | 품질 검증과 출시 차단 근거 |
| `docs/ux/UX_FLOWS.md` | REFERENCE | 사용자 흐름 검증 대조 |

### 최종 정리 전 남은 차단 조건
- [x] 추적 파일 목록(46개 Markdown) 수집
- [x] 모든 추적 Markdown의 인라인 상대링크 348개 경로 검사
- [ ] 소스·CI·비정형 문자열에 들어간 문서 경로 전수 조사
- [ ] 과거 상태문서 2건(`PROGRESS_STATUS`, `IMPLEMENTATION_PLAN`)와 통합 실행계획서 정합화
- [ ] 구문서 후보 파일 이동 또는 유지 여부에 대한 코드 참조 검증
- [ ] PR #21 최종 리뷰 및 병합
