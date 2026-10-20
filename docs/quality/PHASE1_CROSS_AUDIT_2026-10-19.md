# PlanOS 3.0 — 최초 전문 AI MVP 설계 교차 감사 및 수정 대장

**검수:** 2026-10-19 / **범위:** [최초 전문 AI 설계안](../product/FIRST_SPECIALIST_AI_MVP_2026-10-19.md) ↔ [PRD](../product/PRD.md) ↔ [TF-01~30](../product/TASK_FLOWS.md) ↔ [IA/화면](../ux/SCREEN_SPEC.md) ↔ [권한 정책](../product/PERMISSIONS_POLICY.md) ↔ [AI 아키텍처](../engineering/ARCHITECTURE.md) ↔ [데이터 모델](../engineering/DATA_MODEL.md) ↔ [API 계약](../engineering/API_CONTRACTS.md) ↔ [P1-2 정책](../product/MVP_CONTRACT_APPROVAL_COST_POLICY_2026-10-19.md). 현재 소스의 DocumentType 열거(6종)도 확인.  
**검증 종류:** 문서 내용·상호 참조·결정 상태 정합성. **실행 테스트/사용자 검증/보안 실증 아님.**  
**개선 원칙:** 기존 10/16 감사 DQ-02~15를 삭제·'해결' 처리하지 않고 새로운 좁은 수정·남은 게이트를 명확히 함.

## 1. 발견된 중요 불일치·누락 및 처리 결과

| ID | 심각도 | 교차 감사 발견 | 문서 조치(2026-10-19) | 아직 남은 차단 |
|---|---|---|---|---|
| AUD-01 | **높음** | 첫 전문 AI 설계안 §4는 **유료 AI PM 계획 생성 후 계약 동의**처럼 읽힘. TF-10~14/ADR-001은 계약 동의 → PM 계획. 무동의 비용/자료 전송 위험 | 최초 전문 AI 설계안의 실행 순서를 재배열, [P1-2 정책 §2](../product/MVP_CONTRACT_APPROVAL_COST_POLICY_2026-10-19.md)에 계약→모델 계획(비용 허용)→계획 승인→전문 AI 작업 고정 | 실제 API-05 비동기/비용 예약·프로젝트 정책 구현 미완 |
| AUD-02 | **높음** | 기계적 schema/인용 존재 검사와 의미적 요구사항 정답/사용자 최종 수락이 구별돼야 하는데 '검증된 보고서'라는 말이 혼동 가능 | 첫 AI 보고서 finding에 source_validated ≠ human_confirmed/accepted 명확화, P1-2에서 generated/machine_verified/human_accepted 분리 | 정확도/오탐 fixture, 사용자 기준선·실제 평가 필요 |
| AUD-03 | **높음** | ADR-001 §6은 사용자 수락 다음 비용 정산처럼 보임. 공급자 비용은 실패·반려에도 발생하고 예약/실비/고객 청구·환불은 별개 | [P1-2 §4](../product/MVP_CONTRACT_APPROVAL_COST_POLICY_2026-10-19.md) 원가·고객 청구·예산 장부 분리, ADR 비용 이벤트 위치 정정 | 공급자 측 idempotency·원장 DB·가격/무료/환불 정책 검증 미완 |
| AUD-04 | **높음** | '실도구 1종'을 R0 문서 읽기로 정했으나 보고서 저장(R1)을 누가 수행하며 기존 문서를 덮어쓰지 않는지 분리 필요 | 서버 오케스트레이터/아티팩트 저장 서비스의 R1 권한으로 **신규 비공개 artifact만 생성**, 전문 AI 도구는 R0 전용이라고 명시 | 실제 artifact DB FK·스토리지 RLS·격리/출처 검사 미구현 |
| AUD-05 | **높음** | 프로젝트 문서 수정(PATCH)/버전 복원/초안에 따라 원본이 바뀔 수 있음. 단순 documentId 또는 버전 번호만으로 검증 출처 불변 보장 불충분 | source_manifest에 digest·스냅샷 시점 및 document revision/명시적 이력 번호 구분, 실행중 stale/충돌 보류·경고 게이트 | 기존 PlanOS B-04/C-07/다중클라이언트 문제, 서버 snapshot 원자성 미구현 |
| AUD-06 | **높음** | 계약/승인/검증과 기존 API-05/20/22 사이 조회·요청 생성·수락/거부 상태·마감/철회 계약 공백 | P1-2 승인 요청은 **서버만 생성**·digest/만료/변경 재승인 정의, API 명세에 누락 계약 링크/차단 유지 | P1-5 OpenAPI/DDL/DB 테스트 전 완료 불가 |
| AUD-07 | **중요** | Phase 3 **내부 기술 슬라이스**와 Phase 5 **인력 탐색·면담·고객 계약 UX** 시점이 섞여 최초 역할 선택 UI가 즉시 구현되는 것처럼 보일 수 있음 | P1-2 §1, PRD/전문 AI 설계안에 출시 단계 분리 명시 | 고객용 탐색/결제/계약 UX는 Phase 5 전 미구현 |
| AUD-08 | **중요** | 최초 보고서는 2개 이상의 문서가 필요한데 신규 프로젝트에는 완성된 두 문서가 없을 수 있음. 텍스트 0건, 문서 위치/해시 누락 시 허위 '검증됨' 위험 | 2개 미만·빈 내용은 insufficient_input/실행 거부; 인용·manifest 유효성 검증, 다국어/구조화 문서별 locator는 상세 설계 과제 | 실제 JSON Schema/validator 및 사용성 테스트 미실행 |
| AUD-09 | **높음** | owner/editor 위임/비공개 보고서 열람 범위·R2/R3 위험등급은 권한 매트릭스 C와 MVP 기본값 사이 별도 설명 필요 | P1-2 §1/§3: MVP owner만 유료 실행/수락, editor 제안만, viewer/outsider 비공개 보고서 기본 거부, R2/R3 비활성 | DQ-07 및 실제 RLS/워커 권한 재현 미완 |
| AUD-10 | **중요** | 모델 공급자 처리/보존/국외 이전/비밀키·프롬프트 인젝션·계약 해지 시 자료 보존 정책 미확정 | P1-2 §5: 고지·동의/공급자 검증 전 외부 고객 원문 전송 차단, 로그 최소화·삭제 미정 명시 | DQ-10 Threat Model·실제 공급자/법적 검토 미완 |
| AUD-11 | **높음** | 재시도 성공을 '원가 1회'로 단정하면 공급자 과금 중복을 은폐할 수 있음. 작업 멱등성과 외부 호출 과금 멱등성은 다름 | P1-2 §4: 내부 장부/작업 중복 방지, 외부 공급자 과금은 별도 재조정/비용 보류·추가 동의 | 공급자 API 동작/원장/부하 테스트 미완 |
| AUD-12 | **중요** | '작성한 AC 12건'을 실제 CI 테스트 PASS처럼 표현할 위험; FR/TF↔UI↔API↔DB의 일부만 교차 연결됨 | P1-2 POL-01~12 시나리오 작성, 최초 설계안 AC-01~12 **모두 미실행**, 문서에 설계 완료만 [x]; P1-7 추적성 남음 | fixture·E2E·보안 실증·사용자 최종 승인 미완 |

## 2. 일치 여부와 검증 범위

- **일치:** PRD의 FR-01~13/TF-03~24·25·27/OWNER 중심 정책/ADR의 서버 워커+계약 선행/최초 전문 1종 수직 슬라이스, 신규 artifact 수락 분리라는 방향은 대체로 일치.
- **조정 필요 영역:** 출처의 원자적 snapshot API/버전 정의, 신규 검증 report·AI PM plan 생성 job 모델, 비용 예약과 합산/실제 공급자 원가, 승인 요청 발행의 서버 주체, 데이터 보존 및 고객 요금.
- **실제 기존 앱 정합:** 현재 소스의 DocumentType은 prd/ia/screen_list/policy/wireframe/cursor_prompt. **고객 프로젝트의 문서 데이터**와 TF-01~30 같은 **PlanOS 제품 개발 기획 문서**를 혼동하지 않는다.
- **미해결 기존 항목:** DQ-03/04/05/07/08/09/10/11 및 Phase 0 B-04·C-07·멀티클라이언트 경합·서버 직접 쓰기 권한/종합 회귀는 아직 닫지 않는다.

## 3. 정리한 완료·미완료 기준

- [x] 문서 교차 감사 12개 발견·원인/조치/남은 게이트 기록.
- [x] 계약→AI PM 비용 계획→owner 계획 승인→run 전이 순서 문서로 정합화.
- [x] R0 읽기 도구 vs 신규 R1 artifact 저장 분리, AI 정확도 vs 기계 근거 검사 vs 인간 수락 구분.
- [x] 공급자 원가/고객 청구·환불/예산 상한 분리 및 정책 테스트 12건(POL-01~12) 정의.
- [ ] D-01/P1-2 최종 정책 승인, 실제 구현·모델 호출·보안/원가 테스트.
- [ ] 모든 TF/FR ↔ 구현 API/DB/validator ↔ 테스트의 전수 추적, 구조화 artifact schema, UX 화면, 운영 릴리스.

**이번 점검의 DONE은 설계문서의 검토·수정만. 전체 Phase 1 종료, 시스템 테스트, main 병합, 운영 DB 적용, 배포를 의미하지 않음.**

## 4. 다음 순서

1. P1-3 UX_FLOWS: 계약·문서 선택·PM 계획·명시 승인·실행·결과 수락/반려(비모델 첫 화면 포함).
2. P1-4 ADR: 워커/영속 큐/ModelGateway·PM 계획 비용 작업·provider usage 원장 동기화.
3. P1-5: plan GET/버전, contract GET/PATCH, approval 요청 발행/조회/철회, artifact 리뷰/수락, provider 원가 정산 API·DB/RLS.
4. P1-6/7: Threat Model/QA/Runbook과 AC/POL 케이스 격리 서버 테스트, 제품 정책 최종 승인.
