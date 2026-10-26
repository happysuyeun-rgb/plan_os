# 기능 추적표 (화면 ↔ 기능 ↔ 흐름 ↔ API/저장 ↔ 테스트)

**작성·수정일:** 2026-10-25 · **버전:** v1.0  
**범위:** MVP CURRENT(구현·Mock) 중심. TARGET은 별도 표기.

| 화면 ID | CURRENT URL | 기능 ID | 사용자 흐름 | API / 저장 | 테스트 |
|---|---|---|---|---|---|
| C01 | `/` | F-001 | 랜딩 | — | 회귀 |
| C02 | `/login` | F-001 | 로그인 | Auth | 회귀 |
| C04 | `/dashboard` | F-002 | 요약+중도 AI 안내 | projects RPC | mid-project notice |
| C06 | `/projects/new` | F-002 | 생성(+안내) | createProject | — |
| C09/C10 | `/projects/:id` `/:docType` | F-003~004 | 문서 KEEP | documents | G1 |
| C12 | `/projects/:id/tasks` | F-101~104 | S1 보드 | tasks / prototype | S1 CI |
| C13 | `/projects/:id/tasks/:taskId` | F-102~105 | 상세·이력·F-105 | events + **AI kind Mock LS** | `s1-f105-*.test.mjs`, `s1-task-events-ui` |
| C14 | `/projects/:id/specialists` | F-301 Mock | 1종 카탈로그 | 메모리 설명 | `ai-staff-catalog-mock` |
| C15 | `/projects/:id/specialists/request` | F-301 요청 Mock | 초안→모의검토→핸드오프 | sessionStorage handoff | `s3-browser-e2e` |
| C16 | `/projects/:id/ai-review` | F-502 Mock 일부 | hire→run→accept→S1 | browser/server review store | `browser_ai_review`, handoff |
| C17 | `/projects/:id/plans` | F-401 | 사람 PM 목록 | pm_plans | pm e2e |
| C18 | `/projects/:id/plans/new` | F-401 | 초안 작성 | pm_plans | |
| C19 | `/projects/:id/plans/:planId` | F-402 | 승인 루프 | pm plan RPC | |
| C20 | `/projects/:id/audits/new` | F-201 | 소스 선택 | audit manifests | |
| — | (없음) `/contracts*` | F-302~303 | TARGET | — | — |
| — | (없음) `/runs*` | F-501~504 | TARGET | — | — |
| — | (없음) `/artifacts*` | F-601~603 | TARGET | — | — |
| — | (없음) `/workspace*` | N01~ | TARGET IA | — | DocumentPage 비점유 |

**레인 분리:** F-105 agent 지정 ≠ C14~C16 채용/검수. 연결은 UI 링크·수동 E2E fixture만.

---

## Test ID 통합 추적 (분산 → 본 표 · 2026-10-25 R2)

| 계열 | 대표 ID / 파일 | 범위 | 비고 |
|---|---|---|---|
| S1 업무 | `s1-*.test.mjs`, `task-detail-*` / `task-list-*` / `task-soft-delete` testid | CRUD·이벤트·soft-delete | CI 단위 |
| F-105 | `s1-f105-ai-assignee-mock.test.mjs` · `task-detail-ai-assignee-mock` | Mock kind·격리·저장 후 기록 | DB 영속 없음 |
| AI 카탈로그 | `ai-staff-catalog-*` | 1종 Mock | |
| S3 채용 | `s3-browser-e2e` · `specialist-continue-ai-review` | handoff | |
| AI 검수 | `ai-review-*` · `browser_ai_review` | hire/run/accept Mock | viewer readonly testid |
| 사람 PM | pm e2e / RPC | `pm_plans` | REST API-05/06 아님 |
| 권한·위협 | AUTH-01~12 · P5T-* · POL-* · TM-* · AC-* | 정책/위협 ID | **다수 미실행** · 코드 testid와 별도 |
| 감사 교차 | AUD-* · DQ-* · UXA-* · SVC-* · C-0* | 문서 감사 | 회귀 게이트와 1:1 아님 |

신규 테스트 추가 시 **본 표에 한 줄**을 넣고, AUTH/POL/TM 등 정책 ID는 「설계 ID」로 남기며 자동 테스트 파일명과 혼용하지 않는다.
