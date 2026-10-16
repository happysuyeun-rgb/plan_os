# PlanOS 3.0 — 개발 문서 안내

**최초 작성일:** 2026-10-14  
**최종 수정일:** 2026-10-16  
**문서 버전:** v1.4  
**진행 상태:** 관리 중 (문서 브랜치 초안, main 미병합)

## 어디서 무엇을 확인하나요?

| 목적 | 문서 | 내용 |
|---|---|---|
| **지금 어디까지 진행됐나?** | [전체 진행 현황](PROGRESS_STATUS.md) | 완료/진행 중/미완료/보류, 증빙, 다음 작업 |
| **앞으로 무엇을 언제 개발하나?** | [개발 실행계획](roadmap/IMPLEMENTATION_PLAN.md) | 8단계 일정, 선행 조건, 완료 기준, 핵심 기술 결정 |
| **현재 코드에서 무엇이 확인됐나?** | [기술 감사](engineering/BASELINE_AUDIT.md) | 검증된 코드 현황, 위험 및 미검증 항목 |

**기준 문서:** 개발 상태는 `PROGRESS_STATUS.md`, 계획은 `IMPLEMENTATION_PLAN.md`에서만 관리한다. 이 인덱스에 중복 상태표를 작성하지 않는다.

## 신규 제품 정의
- [통합 서비스 기획서(PRD v0.1)](product/PRD.md) — PlanOS 3.0 × AI 인력사무소 TARGET 제품 정의. 검토 전 초안.

## 읽는 순서 및 주의
1. 현재 완료·미완료·다음 실행은 [전체 진행 현황](PROGRESS_STATUS.md)에서 확인.
2. Phase별 의존성과 FreeLLMAPI 검증·도입 조건은 [개발 실행계획](roadmap/IMPLEMENTATION_PLAN.md)에서 확인.
3. 코드/SQL에서 실제로 확인된 내용과 **아직 재현하지 않은 위험 가설**은 [기술 감사](engineering/BASELINE_AUDIT.md)에서 확인.

## 관련 GitHub 작업
- [PR #1 — 문서 정리 (Draft)](https://github.com/happysuyeun-rgb/plan_os/pull/1)
- [PR #5 — CI 워크플로 (Draft)](https://github.com/happysuyeun-rgb/plan_os/pull/5)
- [Issue #2 — DB/RLS 감사](https://github.com/happysuyeun-rgb/plan_os/issues/2)
- [Issue #3 — 빌드/CI/회귀 검증](https://github.com/happysuyeun-rgb/plan_os/issues/3)
- [Issue #4 — AI 실행 아키텍처](https://github.com/happysuyeun-rgb/plan_os/issues/4)
- [Issue #6 — 린트 수정](https://github.com/happysuyeun-rgb/plan_os/issues/6) / [PR #8 — 부분 수정 중](https://github.com/happysuyeun-rgb/plan_os/pull/8)
- [Issue #7 — RLS 재현·보안 검증](https://github.com/happysuyeun-rgb/plan_os/issues/7)

## 문서 관리 원칙
1. 모든 문서에 **최초 작성일, 실제 최종 수정일, 버전, 진행 상태**를 기록한다.
2. 작업마다 [전체 진행 현황](PROGRESS_STATUS.md)을 갱신하고, 완료와 미완료를 구분한다.
3. 브랜치 작성, PR 생성, CI 통과, main 병합, 운영 반영은 별개 상태다.
4. 중복 문서는 내용을 대표 문서로 통합한 뒤 제거한다.
5. 운영 비밀·고객 데이터는 GitHub에 기록하지 않는다.

## 변경 이력
| 날짜 | 버전 | 변경 내용 |
|---|---|---|
| 2026-10-14 | v1.0 | 문서 인덱스 최초 작성 |
| 2026-10-14 | v1.1 | 진행 현황 문서 연결 |
| 2026-10-14 | v1.2 | 중복 현황표 제거, 개발 준비도 문서 실행계획에 통합 |
| 2026-10-15 | v1.3 | 3개 기준 문서의 읽는 순서·최신 Issue/PR·FreeLLMAPI 계획 위치 반영 |

- 2026-10-16 / v1.4: 통합 서비스 기획서(PRD v0.1) 연결.
