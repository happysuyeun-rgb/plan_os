# PlanOS 3.0 × AI 인력사무소 — IA 및 화면 목록

**최초 작성일:** 2026-10-16  
**최종 수정일:** 2026-10-16  
**문서 버전:** v0.1  
**진행 상태:** TARGET IA/화면 ID 초안 — 제품·개발 검토 전  
**상위 기준:** [PRD](../product/PRD.md) · [TF-01~30](../product/TASK_FLOWS.md)  
**구분:** CURRENT=실제 라우트 확인, KEEP=호환 유지, MODIFY=기존 확장 제안, NEW=신규 제안. **TARGET URL은 제안이며 구현된 주소가 아님.**

## 1. IA 설계 원칙
1. **프로젝트 중심:** 프로젝트는 사람 업무·AI 업무·문서·승인·비용·이력을 공유하는 단일 공간.
2. **모드보다 데이터 우선:** Solo/AI Team은 동일 프로젝트의 작업 방식. 별도 복제 프로젝트 생성 금지.
3. **기존 문서 딥링크 보호:** `/projects/:projectId`, `/projects/:projectId/:docType`은 CURRENT에서 DocumentPage를 렌더링. 새 워크스페이스가 해당 URL을 바로 점유하면 회귀 위험.
4. **사용자 통제:** 계약·고위험 실행·예산 초과·결과 수락은 분명한 화면과 서버 승인 절차 필요.
5. **CURRENT/ TARGET 구분:** 아래 새 URL은 네비게이션 설계용 제안일 뿐, 라우터·DB·API에 반영되지 않음.
6. **접근권한:** 로그인/프로젝트 멤버십/역할/계약/도구 권한을 화면별로 점검. 프런트 라우트 가드만으로 보안 충족 아님.

## 2. CURRENT 라우트 (GitHub main src/App.tsx 정적 확인)

| 화면 ID | 현재 URL | 구현 컴포넌트 | 분류 | 설계 처리 |
|---|---|---|---|---|
| C01 | `/` | LandingPage | KEEP | 공개 랜딩; 비회원/로그인 리다이렉트 회귀 |
| C02 | `/login` | LoginPage | KEEP | 인증 및 에러 안내 |
| C03 | `/onboarding` | OnboardingPage | KEEP | 최초 진입 가드 유지 |
| C04 | `/dashboard` | DashboardPage | MODIFY | 프로젝트·승인·최근 실행 요약 확장 |
| C05 | `/projects` | ProjectListPage | KEEP | 프로젝트 검색/열기 |
| C06 | `/projects/new` | ProjectCreatePage | MODIFY | 목표·제약·예산 입력은 후속 확장 |
| C07 | `/projects/trash` | TrashPage | KEEP | 삭제/복원 권한 검증 |
| C08 | `/settings` | SettingsPage | MODIFY | AI 데이터 처리/비용 설정 추가 |
| C09 | `/projects/:projectId` | DocumentPage | KEEP | 기존 문서 진입 URL 보존 |
| C10 | `/projects/:projectId/:docType` | DocumentPage | KEEP | 기존 문서 유형 URL 보존 |
| C11 | `*` | NotFoundPage | KEEP | 권한/404 응답 구분 필요 |

**확인 범위:** 라우트 선언 및 컴포넌트 연결만 확인. 모든 화면의 런타임 동작, 모바일 접근성, RLS 정상 작동을 확인했다는 뜻은 아니다.

## 3. TARGET 정보 구조

```text
서비스
├─ 공개 영역
│  ├─ 랜딩 (C01)
│  └─ 로그인 (C02)
├─ 최초 설정 (C03)
└─ 로그인 영역
   ├─ 대시보드 (C04)
   ├─ 프로젝트
   │  ├─ 목록 (C05) / 생성 (C06) / 휴지통 (C07)
   │  └─ 프로젝트 워크스페이스 (N01)
   │     ├─ 개요·브리프 (N02)
   │     ├─ 업무 보드 (N03) / 업무 상세 (N04)
   │     ├─ 문서·산출물 목록 (N05) → 기존 문서 (C09/C10)
   │     ├─ AI 팀 (N06) / 역할 배치 (N07)
   │     ├─ PM 계획 (N08) / 계획 승인 (N09)
   │     ├─ 실행 내역 (N10) / 실행 상세·증빙 (N11)
   │     ├─ 승인함 (N12) / 승인 상세 (N13)
   │     ├─ 비용·사용량 (N14)
   │     └─ 활동·댓글 (N15)
   ├─ AI 인력사무소
   │  ├─ 역할 탐색 (N16) / 역할 상세 (N17)
   │  ├─ 업무 적합성 면담 (N18)
   │  ├─ 계약 조건 (N19) / 계약 확인 (N20)
   │  └─ 계약 관리 (N21)
   ├─ 통합 승인함 (N22)
   └─ 계정·보안·데이터 설정 (C08 + N23)
```

## 4. TARGET 신규 화면 목록 (URL은 설계 후보)

| ID | 화면명 | 제안 URL | 분류 | 핵심 목적 | 접근 주체 | 연결 TF |
|---|---|---|---|---|---|---|
| N01 | 프로젝트 워크스페이스 | `/workspace/:projectId` | NEW | 공통 프로젝트 허브·모드 전환 | 멤버 | 04~06 |
| N02 | 개요·브리프 | `/workspace/:projectId/overview` | NEW | 목표/제약·수정 이력 | 멤버(쓰기 owner/editor) | 03~05 |
| N03 | 업무 보드 | `/workspace/:projectId/tasks` | NEW | 사람/AI 업무 상태 통합 | 멤버 | 13~18 |
| N04 | 업무 상세 | `/workspace/:projectId/tasks/:taskId` | NEW | 담당/완료 조건/결과 | 멤버 | 15~16,23~24 |
| N05 | 문서·산출물 목록 | `/workspace/:projectId/documents` | NEW | 기존 문서/AI 산출물 연결 | 멤버 | 21,25 |
| N06 | AI 팀 | `/workspace/:projectId/team` | NEW | 역할·계약·권한 가시화 | 멤버 | 06,12 |
| N07 | 역할 배치 | `/workspace/:projectId/team/assign` | NEW | 활성 계약 역할 배치 | owner | 12 |
| N08 | AI PM 계획 | `/workspace/:projectId/plan` | NEW | 계획 생성/검토 | owner/editor | 13~14 |
| N09 | 계획 승인 | `/workspace/:projectId/plan/approve` | NEW | 계획 버전·비용 승인 | 승인 권한자 | 14 |
| N10 | 실행 내역 | `/workspace/:projectId/runs` | NEW | 진행/실패/완료 기록 | 멤버 | 17~18 |
| N11 | 실행 상세 | `/workspace/:projectId/runs/:runId` | NEW | 로그·증빙·재시도/취소 | 멤버(행위는 권한별) | 18,20~24 |
| N12 | 프로젝트 승인함 | `/workspace/:projectId/approvals` | NEW | 승인 대기 모아보기 | 멤버(행위는 승인자) | 14,19,23 |
| N13 | 승인 상세 | `/workspace/:projectId/approvals/:approvalId` | NEW | 행위/비용/기한 확인 | 승인 권한자 | 19,23 |
| N14 | 프로젝트 비용 | `/workspace/:projectId/costs` | NEW | 상한·예약·실비·정산 | owner | 10,27 |
| N15 | 활동·댓글 | `/workspace/:projectId/activity` | NEW | 업무/문서 이벤트·댓글 | 멤버 | 26 |
| N16 | AI 역할 탐색 | `/agents` | NEW | 역할 검색/필터 | 회원 | 07 |
| N17 | AI 역할 상세 | `/agents/:agentId` | NEW | 도구·제약·검증·가격 | 회원 | 08 |
| N18 | 역할 면담 | `/agents/:agentId/interview` | NEW | 업무 적합성 확인 | 회원 | 09 |
| N19 | 계약 조건 | `/agents/:agentId/contract` | NEW | 프로젝트·범위·예산 설정 | owner | 10 |
| N20 | 계약 확인 | `/contracts/:contractId/review` | NEW | 조건 동의·활성화 | owner | 11 |
| N21 | 계약 관리 | `/contracts` | NEW | 계약 중단/해지/정산 | owner | 28 |
| N22 | 통합 승인함 | `/approvals` | NEW | 프로젝트별 승인 대기 | 승인 권한자 | 19,23 |
| N23 | 보안·데이터 관리 | `/settings/data` | NEW | 데이터 처리·내보내기/탈퇴 | 계정 소유자 | 30 |

**정책:** 위 URL은 후보. 기존 `/projects/:projectId`의 DocumentPage 보존과 새 워크스페이스 연결 방법은 사용자 동선 검증 후 확정한다. 페이지 대신 모달/패널로 통합할 수 있는 화면은 상세 설계에서 줄일 수 있다. 신규 화면 23개가 곧 23개 별도 개발 페이지를 뜻하지 않는다.

## 5. 화면별 공통 상태·예외 요구사항
- **목록/상세:** loading, empty, error, forbidden, not-found, retry.
- **입력/편집:** dirty, saving, saved, conflict, validation-error; 저장 실패 후 데이터 보존.
- **AI 실행:** draft, awaiting-approval, queued, running, verifying, awaiting-acceptance, accepted, failed, cancelled.
- **승인:** pending, approved, rejected, expired, revoked; 만료/철회 후 실행 차단.
- **비용:** estimate, reserved, actual, refunded; 미확정 금액을 확정 과금처럼 표시 금지.
- **모바일:** 핵심 읽기·승인·상태 확인을 우선 지원. 기존 DesktopOnlyBanner 정책은 별도 재검토.
- **접근성:** 키보드/포커스/오류 텍스트, 색상 외 상태 표시, 대화상자 포커스 복귀.

## 6. MVP 화면 최소 세트 및 구현 우선순위

| 단계 | 우선 화면 | 목표 |
|---|---|---|
| Gate 0 — 기존 회귀 | C01~C11 | 기존 URL/문서/복원/권한 정상 |
| M1 — 사람 업무 기반 | N01~N05 | 프로젝트/업무/산출물 공유 기반 |
| M2 — AI 실제 실행 | N08~N14(필수 부분) | 계획·승인·실행·검증·수락·비용 |
| M3 — 인력사무소 | N06~N07, N16~N21 | 탐색·계약·배치·킥오프 |
| M4 — 안정화 | N15, N22~N23 | 알림/통합 승인/데이터 제어 |

**최소 화면 축소 제안:** MVP는 N01 프로젝트 허브, N03 업무 보드, N08 PM 계획, N11 실행 상세, N12 승인함, N16 역할 탐색, N17 역할 상세, N19 계약 조건, N20 계약 확인을 먼저 구성하고, 나머지는 기존 화면·패널·모달 재사용 여부를 검토한다.

## 7. 미결정 사항 / 다음 문서
1. **IA-D01:** 새 워크스페이스를 `/workspace/:projectId`로 분리할지, 기존 `/projects/:projectId`를 단계적 전환할지. **기본 제안:** 초기에는 별도 URL로 안전하게 추가.
2. **IA-D02:** 프로젝트 내 승인함과 통합 승인함의 중복 제거 방법.
3. **IA-D03:** 계약/면담을 독립 페이지로 둘지 다단계 패널로 통합할지.
4. **IA-D04:** 모바일 읽기/승인 범위와 기존 데스크톱 전용 안내 변경 시점.
5. **IA-D05:** 기존 문서 저장/버전/댓글과 신규 산출물의 연결 및 권한 모델.
6. **다음:** 화면별 기능명세(`SCREEN_SPEC.md`) → 권한 매트릭스/상태 전이 → API/데이터 계약. Phase 0의 RLS/회귀 검증과 병행.

## 점검
- [x] CURRENT `src/App.tsx` 라우트 11개 정적 대조
- [x] TF-01~30의 화면 매핑 초안
- [x] 기존 DocumentPage URL 보존 전략 명시
- [x] 신규 화면 ID·권한·예외·MVP 축소 후보
- [ ] 실제 사용자 동선·모바일/접근성 검증
- [ ] 화면별 정책 승인 및 상세 기능명세
- [ ] 구현/테스트·라우팅 적용

## 변경 이력
| 날짜 | 버전 | 내용 | 상태 |
|---|---|---|---|
| 2026-10-16 | v0.1 | CURRENT 11개 라우트, TARGET IA 23개 화면, TF 연결 및 MVP 최소 세트 최초 작성 | 검토 전 |
