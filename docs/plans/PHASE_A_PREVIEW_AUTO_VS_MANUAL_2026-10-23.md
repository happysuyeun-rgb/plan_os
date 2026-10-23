# Phase A — Preview 자동화 vs 사용자 수동 검수 (2026-10-23)

스택: PR **#30 → #36 → #42** (tip `preview/planos-integrated-20261023`)  
Preview URL: https://planos-preview.vercel.app · DB: PlanOS-Preview (운영과 분리)

---

## 자동화로 완료·유지하는 항목 (CI / Sonar)

| 영역 | 근거 |
|---|---|
| 빌드·린트·단위 | `baseline` / `npm run build` · `test:unit` |
| G1 CAS·draft | `g1-autosave-cas` · `g1-revision-cas` |
| RLS JWT/PostgREST | `rls-auth-integration` (PM 스위트 포함) |
| 멤버 RLS SQL | `rls-member-policy` |
| S1 계약 | `s1-task-check` |
| Browser smoke (disposable) | `phase0-browser-smoke` (경로 트리거 시) |
| Sonar QG | #30 security · #36 duplication · #42 기존 OK |

위 항목은 **병합 전 필수**이며 사용자 수동으로 대체하지 않는다.

---

## 사용자 수동 검수만 필요한 항목

| ID | 내용 | 비고 |
|---|---|---|
| M1 | Preview 로그인 (Owner/Editor/Viewer) | Vercel Authentication |
| M2 | 문서 열기·자동저장·충돌 안내 | CAS UX |
| M3 | 버전 복원 1회 | B-05 경로 |
| M4 | 사람 PM 계획 작성→승인→S1 링크 | #36 UX |
| M5 | C04 대시보드 KPI/보드 링크 | #42 UX |
| M6 | 네트워크에 운영 Supabase ref 없음 | DevTools |
| M7 | `planos-preview` Git이 main에 묶이지 않음 | Vercel Settings |

체크리스트 상세: `PREVIEW_USER_TEST_GUIDE_2026-10-23.md`

**수동 미완료여도** CI/Sonar가 통과하면 “코드 병합 준비”는 가능하나, **Preview 수용(A-P0-03)** 전 main 승인은 권고하지 않는다.

---

## 이번 지시에서 하지 않은 것

- Preview 실브라우저 수동 클릭 (사용자)
- tip Preview 재배포 (별도 승인/작업)
- #44 AI 기능을 Phase A 완료로 포함하지 않음
