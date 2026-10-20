# PlanOS 3.0 — P1-3 UX 재감사 및 P1-4 인계 차단 목록

**2026-10-20 · 상태:** 문서 간 정합성/누락 검토 완료, 실제 화면·API·SQL·권한 테스트는 미실행.  
**검토 문서:** UX_FLOWS, IA, SCREEN_SPEC, PRD, TASK_FLOWS, FIRST_SPECIALIST_AI_MVP, MVP_CONTRACT_APPROVAL_COST_POLICY, API_CONTRACTS, DATA_MODEL, ARCHITECTURE, PROGRESS_STATUS.

| ID | 심각도 | 발견한 누락/불일치 | 이번 조치 | 남은 검증 |
|---|---|---|---|---|
| UXA-01 | P0 | UX 도식의 실패→실행 되돌림이 자동 무제한 재호출로 오해될 수 있음 | 서버 상태·비용 확인→owner 재동의/승인 후 별도 재시도 게이트로 명시 | 멱등·중복 원가·워커 장애 실제 E2E |
| UXA-02 | P0 | N05 문서 선택은 필수지만 SCREEN_SPEC 핵심 9개 상세에서 제외 | UX_FLOWS에 필드/실패/상태 최소 계약 명시, N05 상세/와이어프레임 P1-3B에 추가 | 문서 소속·digest·권한·두 문서 판정 서버 구현 |
| UXA-03 | P0 | 계약 N19/N20 전에 문서 선택→N17 이동 시 입력 범위가 유지되는 API/세션 계약 없음 | 딥링크·back/forward·새로고침·재인증 시 보존/검증 규칙 초안 추가 | 서버 임시 draft/TTL·민감정보 로컬 보존 정책·UI 테스트 |
| UXA-04 | P0 | AI PM 생성 작업을 N08의 단일 planned 응답처럼 표시할 위험 | 별도 plan-generation job, 상태 조회, 비용 예약/지연/취소·실패 UX 정의 | PM plan API-05 GET/async 상태/예산 상세 |
| UXA-05 | P0 | '기계 검증 PASS'가 자동 accepted 또는 고객 청구 완료로 보일 수 있음 | machine_verified·awaiting_acceptance·human_accepted·provider cost pending 분리 | N11/N12 단일 이벤트·서버/DB 멱등 구현 |
| UXA-06 | P0 | 계획 승인 N09/N12 및 보고서 수락 N11/N12 중복 가능 | 승인/수락 각각 고유 이벤트·ID, N12는 링크만, accepted는 N11 단일 패널 | API-20/22 상태 GET·409/412 시험 |
| UXA-07 | P0 | 문서 변경/멤버십 해제·계약 만료가 UI 캐시보다 빨리 발생 가능 | 화면 재진입·액션 직전 서버 재검증, stale/403 처리·민감 캐시 제거 | 다중기기/RLS/브라우저 E2E |
| UXA-08 | P1 | 계약 데이터 처리 고지와 PM 계획 호출 비용이 별도 동의로 보이지 않을 위험 | N19/N20에 공급자·처리 목적/보존·계획비용·전문 실행 비용 구분 표시 | 실제 공급자 계약·결제/가격 확정 전 공개 금지 |
| UXA-09 | P1 | UX 실패/재시도·접근성은 텍스트 수준이고 명세상 'UX 완료'처럼 읽힐 여지 | P1-3A 문서 완료/실제 와이어프레임·키보드·스크린리더·수동 테스트 P1-3B 분리 | UX-01~12 0건 실제 실행 |
| UXA-10 | P0 | 실제 구현 우선순위가 Phase 3 내부 계약과 Phase 5 공개 N16~N20 전체 여정 사이 불일치할 위험 | 별도 내부 기술 슬라이스 vs 공개 고객 여정 라벨 유지 | 제품·정책 승인, Phase 0 차단 해소 |

**감사 결론:** 발견 항목의 문서 조치와 열린 게이트를 구분한다. '문서 재감사 완료'는 UX 구현·보안·접근성 검증 통과가 아니다. P1-4는 비용/인증/승인과 회복을 다루는 상세 설계로 시작하되 실제 큐 공급자 선택은 검증 전 미정.

**연결:** [UX_FLOWS](../ux/UX_FLOWS.md) · [P1-4 서버 ADR](../engineering/AI_EXECUTION_ADR_002_2026-10-20.md) · [2026-10-19 정책안](../product/MVP_CONTRACT_APPROVAL_COST_POLICY_2026-10-19.md).
