# PlanOS 3.0 — P1-6 릴리스·장애 중단·롤백 런북 v0.1

**작성:** 2026-10-20. **상태:** 출고/중단/복원 절차 초안 작성, 운영 적용·리허설·CEO 승인 미완료.  
**근거:** [위협 모델](../quality/THREAT_MODEL_2026-10-20.md), [QA 계획](../quality/TEST_PLAN_2026-10-20.md), [P1-5 재감사](../quality/PHASE1_P5_REAUDIT_2026-10-20.md), [ADR-002](../engineering/AI_EXECUTION_ADR_002_2026-10-20.md).

## 릴리스 전 검증
1. 확정된 PRD/역할·계약·공급자/원가/개인정보·삭제/보존 정책 승인과 문서 trace 전수 완료.
2. Phase 0 B-04/문서 버전·C-07·다중 기기 PATCH·직접 chat_messages INSERT/RLS 및 기존 로그인/댓글/알림/휴지통 회귀 PASS.
3. 격리 DB migration·RLS·OpenAPI/generated types·4역할 positive/negative 테스트, 예산 초과/중복/worker crash/응답 유실, 실제 원가 대사 검증.
4. 신규 API/DB/worker/ModelGateway **feature flag OFF 기본**. 키·webhook·로그·데이터 보존/삭제 보호, kill switch/알림/backup restore 가능성 확인.
5. **별도의 사용자 운영 변경 승인** 전 GitHub main merge, 운영 DB migration, 유료 모델 키 연결, Vercel/워커 배포 금지.

## 순서 (미래 실행용 체크리스트, 지금 실행 아님)
- [ ] 격리 브랜치의 앱/DB commit SHA와 PR 리뷰·CI 기록 고정.
- [ ] 격리 DB 데이터/스키마·Storage restore rehearsal와 예상 rollback 제한 확인; 백업 시점·복구 책임자 기록.
- [ ] DB expand-only migration 검토, backward-compatible API 배포 → 영속 outbox/worker 비활성 배포 → feature flag로 내부 계정 제한 활성화.
- [ ] 계약/승인/RLS/예산/원가 negative 테스트와 synthetic run, provider 사용량 지연·외부 비용 유실 케이스 실증.
- [ ] 제한 파일럿 사용자·금액 상한·kill switch 운영자·알림 임계치에 대한 승인 기록 후 확대 여부 결정.

## 즉시 중단(Stop-the-line) 조건
- 타 프로젝트 문서/보고서 노출, 무권한 AI 모델 호출/승인·R2/R3 실행, 공급자 비용 상한 초과, 기존 문서 저장·복원 데이터 손실, 승인/원가 이벤트 위조, 고객 데이터 전송 약관 위반.
- **대응:** 신규 run/plan generation/queue claim/외부 도구 호출 flag OFF 및 worker pause. 이미 진행 중인 provider 요청은 취소 가능성 확인, 기존 원가 pending 및 감사 증거 **삭제하지 않음**.
- 기존 PlanOS 기본 문서 읽기/저장은 안전한 기존 경로로 유지. 새 기능 플래그 OFF가 기존 데이터 삭제로 이어져서는 안 됨.

## 롤백·복원 기준
1. API/UI feature flag와 워커 신규 claim을 OFF. in-flight run을 blocked/pending reconciliation으로 기록하되 임의 accepted/cancelled로 덮어쓰지 않음.
2. 새 DB 컬럼·감사/원장은 **파괴적 down migration 금지**; 호환성 유지한 전진 수정(forward-fix) 또는 사전 검증된 복원 경로 선택. 실제 데이터 손실 위험 검토.
3. 직전 안정 애플리케이션 빌드/커밋으로 복귀하되 DB 새 스키마와 역호환 사전 입증 필요.
4. 기존 프로젝트/문서/버전/휴지통·인증/권한 재검수, 미정산 비용 reconcile, 감사·승인 이력 보존.
5. 사고 범위·영향 데이터/공급자 비용/권한 회수·재배포 판단을 사용자에게 보고. 법적 신고/통지 의무는 별도 근거 확인.

## 담당·증빙/미결정
- 운영 책임자, 백업/Storage 복원 권한, kill switch 구현 위치, 원가/비용 통지 규칙, 데이터 보존기간, 경보 대상, 실제 리허설 환경은 **미지정**.
- 필수 아티팩트: 승인 시간/범위, 코드 commit SHA, DB migration sha, CI 테스트/run 로그, 백업/restore 시험 결과, feature flag·worker 상태, provider cost reconciliation 표, 변경/되돌림 이력.
- [ ] 격리 리허설, [ ] rollback 테스트, [ ] 사고 핸드북/알림 채널, [ ] 기술/CEO 운영 승인.
- **현재 판정:** 런북 문서만 완료. 실제 배포 실행·운영 시스템 변경 없음.

## 2026-10-21 AI 인력사무소 추가 출시 차단 게이트 (설계·검증 전)

- 기존 G1 저장/복원/문서 CAS/프로젝트 RLS P0 미해결 시 **AI 직원 실자료 읽기/쓰기·유료 모델 실행·릴리스 금지**. Mock과 실작동 UI 라벨 구분.
- **직원 공개 이력서:** 고객 적립 동의/공개·익명·비공개/후기·마케팅 등 목적별 기본 거부, 철회 후 즉시 읽기 차단과 캐시·검색색인 정정 SLA/재시도/문제 대응.
- **복수 프로젝트 PM:** 미배정 C/미래 프로젝트 접근·자료가 요약/모델 컨텍스트에 끼어들지 않는지 DATAUTH-01~15와 실제 worker/RLS 테스트 증명.
- **경력·가격:** 중복/허위 업무일 적립·등급 조작/별점 위조·승급 시 계약 자동 인상/미승인 공급자 전송 0회 보장. 실제 사용자 공개 경력의 가상 배경 혼동 방지.
- **진행 중 해임·철회:** 새 job claim 차단, 이미 발생한 공급자 비용 보류·정산, 이전 고객 산출물 안전 보존 및 법적 삭제 경계.
- **상용 승인 필수:** 공급자 API/국외 이전·데이터 처리/요금·환불·저작권·고객 공개 동의 최종 법률/운영 승인. 이 항목들은 테스트 계획에 적힌 것만으로 준비 완료가 아님.
- [전수 재감사](../quality/PLANOS_FULL_DOC_REAUDIT_V3_2026-10-21.md) / [단일 권한 계약](../engineering/AI_STAFF_DATA_AUTH_CONTRACT_V1_2026-10-21.md). **현재 릴리스/운영 DB/배포 승인 없음.**
