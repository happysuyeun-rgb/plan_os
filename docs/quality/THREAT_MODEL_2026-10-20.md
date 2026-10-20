# PlanOS 3.0 — P1-6 위협 모델 v0.1

**작성:** 2026-10-20. **상태:** 설계 위협 분석 완료 / 침투·RLS·실행 검증 미완료.  
**근거:** [P1-5 재감사](PHASE1_P5_REAUDIT_2026-10-20.md) · [P1-5 API/DB](../engineering/AI_API_DB_CONTRACT_P1_5_2026-10-20.md) · [ADR-002](../engineering/AI_EXECUTION_ADR_002_2026-10-20.md).

## 자산·신뢰경계
- 자산: 고객 프로젝트/문서와 버전·첨부 원문, 동의/계약, 개인식별정보, 인증 JWT, service_role/API keys, AI 계획/승인, 원가·사용량·원장, 검증 보고서, 감사·취소·해지 기록.
- 경계: Browser→BFF/JWT→권한 정책→DB/RLS, DB outbox→lease worker→외부 모델/도구, validator→R1 Storage→owner 검수, provider usage→budget ledger. 프롬프트·문서 내용/외부 모델 답변은 **비신뢰 데이터**.
- 보안 기본값: owner만 계약·유료 실행·승인·보고서 수락, editor는 초안 제안, viewer/outsider는 새 AI 원가/보고서 비공개. R0 읽기와 R1 신규 산출물 쓰기는 서버만.

## 위협 목록·완화·반증 테스트
| ID | 위협/공격 경로 | 차단 설계 | 검증 ID |
|---|---|---|---|
| TM-01 | 조작한 projectId/documentId로 타 프로젝트 조회(IDOR) | 교차 FK, JWT membership, 서버 owner gate, RLS, read tool scope | P5T-03, POL-11 |
| TM-02 | service_role 우회/직접 SQL 및 클라이언트 검증 이벤트 위조 | BFF trust gate, 최소 권한 worker, 직접 INSERT/UPDATE 차단, audit actor server signed | P5T-03/04, P5T-07 |
| TM-03 | AI/문서 프롬프트 인젝션으로 외부 유출·R2/R3 실행 | allowlist R0 only, 문서 내용은 비신뢰, tool input/project scope 검증 | POL-05, AC-10 |
| TM-04 | editor/viewer의 owner 계약·승인·과금·수락 위조 | actor+role+version/digest/expiry check, server-only approval creation | P5T-04/07/10 |
| TM-05 | 임시 draft/문서 URL·로그/Storage signed URL을 통한 원고 유출 | 최소 로그·짧은 TTL·서버 재인증, 민감 원문 URL/로컬 저장 금지 | UX-03/12, P5T-12 |
| TM-06 | 요청 반복/동시성으로 예산 상한 우회·중복 예약 | scope+key+payload digest, DB lock/unique/CAS, ledger/reconciliation | P5T-02/08 |
| TM-07 | worker crash+모델 응답 유실로 외부 비용 재발생 | providerRequestRef+usage pending, ambiguous calls HOLD, 추가 재호출 기본 금지 | P5T-05/08 |
| TM-08 | 만료 계약·승인 철회·권한 회수 뒤 실행(TOCTOU) | worker claim/외부 호출 직전 권한/약관/예산·cancel 재확인 | P5T-07/11 |
| TM-09 | 근거가 없는 모델 결과를 verified·accepted로 위조 | manifest hash/locator 검증, 사람 수락 독립 이벤트, validator server only | P5T-09/10 |
| TM-10 | ModelGateway 비밀키/사용자 데이터 공급자 전송·장기 보존 | 키 서버 보관, 공급자 약관/학습·이전·보존 확인·고지 동의 전 실제 전송 금지 | POL-12 |
| TM-11 | 삭제/휴지통/백업·계약 해지 시 개인정보와 원가 감사 기록 충돌 | 목적별 보존/삭제 법무·정책 승인, 데이터 최소화/익명화/백업 관리 | P5T-11 |
| TM-12 | 배포·스키마 변경으로 기존 문서/버전·로그인 손실 | Phase 0 회귀, 격리 migration/backward compatibility, rollback/kill switch | RELEASE 게이트 |

## 반드시 보호할 불변식
- 승인 없는 비용·도구 호출 0, 교차 프로젝트 원문/보고서 누출 0, R2/R3 도구 허용 0.
- 모델 결과만으로 업무 accepted 전이 불가. 공급자 원가 미확정을 무료/0원으로 둔갑 금지.
- 부정확한 의미적 finding은 자동 검증 결과와 분리하여 사용자에게 한계 표시.
- 위험은 설계에만 제시했으며 구현된 제어의 안전성을 입증하지 않음.

## 미해결 승인/위험
외부 모델 데이터 전송/보존·국외 이전·개인정보 법적 고지, 임시 저장 TTL, 원장 보존, 공급자 이중 과금 정책, RLS 실제 정책 및 Phase 0 직접 chat INSERT 문제는 **차단/검증 대기**.

**실제 침투 테스트·RLS 재현:** 0건. [TEST_PLAN](TEST_PLAN_2026-10-20.md)과 [RELEASE_RUNBOOK](../operations/RELEASE_RUNBOOK_2026-10-20.md)의 게이트 통과 전 보안 완료/출시 가능 판정 불가.
