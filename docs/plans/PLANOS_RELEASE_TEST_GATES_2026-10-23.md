# PlanOS 테스트 · 병합 · 운영 출시 게이트 (2026-10-23)

게이트를 건너뛰고 “완료”로 승격하지 않는다.

---

## Gate 0 — 격리 개발 (상시)

| 검사 | 기준 |
|---|---|
| 환경 | Preview DB 또는 disposable local만 |
| 비밀 | 운영 URL/키 미사용 |
| 단위 | `npm run test:unit` PASS |
| S1 | `npm run test:s1` PASS |
| 빌드·린트 | build OK, lint 0 errors |
| RLS | CI `auth-postgrest-integration` 또는 동등 로컬 스위트 |
| 브라우저 | smoke + 변경 영역 E2E |

## Gate A — Preview 수용

| 검사 | 기준 |
|---|---|
| URL | https://planos-preview.vercel.app |
| 시나리오 | 안내서 A/B/C 사용자 체크 |
| 격리 | 네트워크에 운영 Supabase ref 없음 |
| 보호 | Vercel Authentication ON |
| Git | planos-preview ← main 자동배포 없음 |

## Gate B — Draft Ready (PR 단위)

| PR | 필수 |
|---|---|
| #30 | CI PASS + Sonar security OK |
| #36 | CI PASS + Sonar QG 또는 **문서화된 예외 승인** |
| #42 | CI PASS + Sonar OK (현행 충족) |
| 공통 | Draft→Ready는 사용자 승인 |

## Gate C — main 병합 (승인 필수) — V1.1

Git 병합 순서: **#30 → #36 → #42**.  
운영 적용 순서: **백업 → mig 013…026 (DEPLOYMENT V1.1 표) → 검증 → 그다음 Git 병합**.

| 사전 | 내용 |
|---|---|
| 1 | Gate A·B |
| 2 | 운영 DB **read-only** 객체 목록 (018/022~026 등) |
| 3 | 백업/PITR 확인 |
| 4 | **mig 적용·객체 검증 완료** (코드 병합보다 앞) |
| 5 | Vercel Production 프로젝트·자동배포 경로 확인 (없으면 생성 계획) |
| 6 | Feature flag 운영 기본값 합의 |

“병합 먼저, DB 나중”은 **금지** (CAS 018·PM 022·C04 025 의존).

## Gate D — 운영 DB 적용 (승인 필수)

1. 백업  
2. 미적용분만 파일명 순 (`ON_ERROR_STOP`)  
3. drafts/017·021 **제외**  
4. 객체 재확인  
5. 롤백: `DEPLOYMENT_TRANSITION_PLAN` §7 + 022~026 함수 `CREATE OR REPLACE` 역적용 메모  

## Gate E — Production 배포 (승인 필수)

| 검사 | 기준 |
|---|---|
| 코드 | Gate C 후 |
| DB | Gate D 후 |
| 스모크 | 로그인·문서 CAS·복원·S1(플래그)·PM·C04 |
| DEV 로그인 | **OFF** |
| 유료 AI | 상한·키 순환 확인 |

## Gate F — AI/과금 기능 출시 (추가)

| 기능 | 추가 게이트 |
|---|---|
| 실 LLM | provider·데이터처리 DEC, 예산 캡, 실패 이력 |
| 검수 AI | 사람 최종 승인 경로, 인용 감사 |
| 채용·과금 | 결제·환불 OP, 고객 동의 |

---

## 회귀 최소 세트 (매 PR)

1. `test_local_supabase_content` (+ document_versions 전제)  
2. `test_local_supabase_pm_*` / `dashboard` (해당 시)  
3. `browser_smoke`  
4. 변경 영역 전용 E2E  

## 롤백 한 줄

배포 이상 → Vercel 이전 배포 롤백 **우선**, DB는 스키마 전진이 구코드와 호환되면 유지; 데이터 손상 의만 백업 복원.
