# PlanOS 3.0 — 개발 문서 안내

**최초 작성일:** 2026-10-14  
**최종 수정일:** 2026-10-19  
**문서 버전:** v2.2  
**진행 상태:** 관리 중 (문서 브랜치 초안, main 미병합)

## 어디서 무엇을 확인하나요?

| 목적 | 문서 | 내용 |
|---|---|---|
| **지금 어디까지 진행됐나?** | [전체 진행 현황](PROGRESS_STATUS.md) | 완료/진행 중/미완료/보류, 증빙, 다음 작업 |
| **앞으로 무엇을 언제 개발하나?** | [개발 실행계획](roadmap/IMPLEMENTATION_PLAN.md) | 8단계 일정, 선행 조건, 완료 기준, 핵심 기술 결정 |
| **현재 코드에서 무엇이 확인됐나?** | [기술 감사](engineering/BASELINE_AUDIT.md) | 검증된 코드 현황, 위험 및 미검증 항목 |

**기준 문서:** 개발 상태는 `PROGRESS_STATUS.md`, 계획은 `IMPLEMENTATION_PLAN.md`에서만 관리한다. 이 인덱스에 중복 상태표를 작성하지 않는다.

## 신규 제품 정의
- [통합 서비스 기획서(PRD v0.3)](product/PRD.md) — PlanOS 3.0 × AI 인력사무소 TARGET 제품 정의. 검토 전 초안.
- [최초 전문 AI 업무·MVP 수용 기준(2026-10-19)](product/FIRST_SPECIALIST_AI_MVP_2026-10-19.md) — 후보 3종 비교, 기획 검수 AI 1순위 권고, 12개 수용 케이스, 승인·운영 미완료. **Phase 1 P1-1 설계 산출물 기준 링크.**
- [MVP 계약·승인·비용·데이터 처리 정책안(2026-10-19)](product/MVP_CONTRACT_APPROVAL_COST_POLICY_2026-10-19.md) — Phase 1 P1-2: 계약 선행·비용/권한·중단/취소·POL-01~12, **정책/가격/법무·원가 미승인**.
- [사용자 업무 흐름 TF-01~30 v0.2](product/TASK_FLOWS.md) — 시작·계약·실행·검증·운영 30개 흐름, 검토 전 초안.
- [IA 및 화면 목록 v0.2](ux/IA.md) — CURRENT 11개 라우트, TARGET 23개 화면 ID, 기존 문서 URL 호환 전략.
- [화면별 기능명세서 v0.2](ux/SCREEN_SPEC.md) — MVP 핵심 9개 화면 상세·나머지 14개 통합/후속 처리.
- [권한·승인 정책 v0.2](product/PERMISSIONS_POLICY.md) — 사람/AI 역할·위험 등급·승인·RLS 테스트 기준.
- [AI 실행 아키텍처 v0.2](engineering/ARCHITECTURE.md) — 서버 워커·ModelGateway·예산·검증·복구 ADR 초안.
- [데이터 모델 v0.2](engineering/DATA_MODEL.md) — 기존 Supabase 테이블 보존·신규 AI 엔터티·무결성.
- [API 계약 v0.2](engineering/API_CONTRACTS.md) — TARGET 23개 엔드포인트·권한·오류·멱등성.

- [Phase 1 사용자 UX 와이어플로 v0.1](ux/UX_FLOWS.md) — 프로젝트 문서 선택→계약/데이터·비용 동의→PM 계획→계획 승인→실행→증빙·사람 수락, 화면별 오류/권한/12개 UX 테스트(명세만).

- [P1-4 영속 AI 실행 아키텍처 ADR-002](engineering/AI_EXECUTION_ADR_002_2026-10-20.md) — BFF·영속 outbox/lease worker·ModelGateway·예산/원가·실패 복구 설계(기술 제품 선정·실증 미완료).
- [P1-3 UX 누락 재감사](quality/PHASE1_UX_ARCH_AUDIT_2026-10-20.md) — 재시도/권한/승인/PM job 등 UXA-01~10 교차 점검 및 미완료 게이트.

- [P1-5 API·DB 상세 계약 v0.1](engineering/AI_API_DB_CONTRACT_P1_5_2026-10-20.md) — 신규 보강 API 16건, 상태·트랜잭션·DB/RLS 제약, 12개 검증 케이스(정의만), 구현·승인 미완료.

## 교차 문서 품질 점검
- [2026-10-16 통합 문서 감사](quality/DOCUMENT_REVIEW_2026-10-16.md) — 12개 문서별 누락·충돌, P0~P2 결함, 완료·미완료·다음 수정 우선순위. **기획/보안/개발 검증 통과가 아니라 문서 품질 점검 결과**.
- [2026-10-19 첫 전문 AI 교차 감사](quality/PHASE1_CROSS_AUDIT_2026-10-19.md) — 불일치·누락 AUD-01~12, 문서 정정 범위와 **미해결 API/DB·승인·보안·실제 테스트** 확인.

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

- 2026-10-16 / v1.5: 사용자 업무 흐름 TF-01~30 v0.1 문서 연결.

- 2026-10-16 / v1.6: IA/화면 목록 v0.1 연결.

- 2026-10-16 / v1.7: 화면별 기능명세서 v0.1 링크 추가.

- 2026-10-16 / v1.8: 권한·승인 정책 및 AI 실행 아키텍처 초안 연결.

- 2026-10-16 / v1.9: 데이터 모델 및 API 계약 명세 v0.1 연결.

- 2026-10-16 / v2.0: 문서 12개 교차 감사 연결, 제품·기술 문서 v0.2 정합성 보완 링크 갱신.

- 2026-10-19 / v2.1: 최초 전문 AI 후보 비교·수용 기준 문서 연결; 기존 [Draft PR #1](https://github.com/happysuyeun-rgb/plan_os/pull/1) 문서 브랜치에서 일원화.

- 2026-10-19 / v2.2: 첫 전문 AI 교차 감사와 P1-2 계약·비용 정책안 연결. 문서 기준은 계속 Draft PR #1.
