# PlanOS 설계 교차검수 01 — Cursor 통합 작업 병행
작성: 2026-10-21 · 범위: PRD, SERVICE_PLAN, FUNCTIONAL_SPEC, PERMISSIONS_POLICY, MVP_BUILD_READY_SPEC, SERVICE_OPERATIONS_POLICY와 현재 PR #25/#27 구현 설명. **설계 검토이며 런타임 결함 재현 결과가 아님.**

## 확인된 정합성 결함
| ID | 우선 | 근거 | 조정 제안 | 완료 기준 |
|---|---|---|---|---|
| DS-01 | P0 | F-401 기능정의서 `owner/editor 작성` ↔ PR #27 F-401 Mock 화면의 owner-only 검증 | `editor`는 계획 **초안 작성/수정** 허용, 계약·계획 **최종 승인/실행은 owner** 유지. 현재 F-401 owner-only Mock은 운영 정책보다 좁음. 역할별 서버 RLS/브라우저 실증 전 일괄 권한 확대 금지 | 소유자/편집자/뷰어/외부인 쓰기·승인 분리 테스트 |
| DS-02 | P0 | S2 manifest의 문서 revision/digest, S3 계약 동의 범위, S4 계획 approval snapshot, S5 run 승인 조건이 문서마다 설명 위치가 다름 | `source_snapshot_id, manifest_digest, plan_version/digest, contract_version/terms_digest`를 실행 요청 검증 불변 조건으로 연결하고 변경시 stale 처리 | 원문 수정→과거 승인 실행 불가 / 변경 범위 재동의 여부 시나리오 |
| DS-03 | P0 | MVP 화면 계약의 `plans/:planId` + plan_version/CAS ↔ F-401 Mock `plans/new` 임시 메모리 | Mock 경로를 별도 표시. 실제 draft 영속·owner 승인에 앞서 입력·버전·오류 복구와 409 UI 상세 설계 필요 | 새로고침 보존/409 동시편집/재승인 E2E |
| DS-04 | P1 | F-301~303은 모델·도구·전송·요금 안내를 요구하나 현재 S3 Mock은 역할/가격 미확정 안내 중심 | 정식 고객용 화면에는 공급자, 도구, 문서 접근 범위, 목적, 보존/국외 전송, 취소·만료·가격·상한의 **확정/미확정 표시** 구분 | 실제 동의 UI와 차단 조건 계약 테스트 |
| DS-05 | P1 | PRD의 넓은 'AI 팀/역할 카탈로그'와 SERVICE_PLAN의 감사 AI 1종 내부 MVP 차이 | 개발 MVP=요구사항 검수 전문가 1종, 역할 면담/다직군은 후속. 홍보 문구와 내부 프로토타입 구별 | UI 노출 목록 1종 및 capabilities 근거 검토 |
| DS-06 | P1 | 문서 수정·계약 철회·멤버 자격 변경·예산 상한 변경은 독립 이벤트이나 화면 복구 UX 흐름 미구체화 | 각 이벤트마다 작업 전·진행 중 차단, 사용자 안내, 재선택/재계약/재승인 경로 명시 | 412/409/429/503별 사용자가 다음 조치를 선택할 수 있음 |
| DS-07 | P1 | 사람업무 done, AI run succeeded, 검수 artifact accepted 혼동 위험 | 리소스별 생명주기 분리 및 통합 활동 화면에서 상태 출처를 함께 표기 | run 성공이 보고서 수락이나 task done으로 자동 표시되지 않음 |
| DS-08 | P1 | FUNCTIONAL_SPEC v1.0의 초기 PR 관련 서술은 최신 main/PR 진척과 일부 불일치 | 상태 컬럼을 `코드 작성/메인 병합/DB 검증/브라우저 검증/출시`로 분리; 현재 실행계획서 최신 사실 근거로 정정 | 날짜·commit/CI 증빙 없이 '검증 완료' 표시 금지 |

## P0 개발과 합류 전 필수 설계 인수 기준
1. `writer` 단일 경로: autosave, restore, chat write, background process는 동일한 server CAS/권한·감사 계약 사용.
2. 문서 동일성: `project_id + document_id + revision + digest`를 실제 DB에서 재검증, 독립 브라우저 검증만으로 완료 처리 금지.
3. 승인 독립성: 계약 동의, 계획 승인, 실제 실행 승인, 산출물 수락을 각각 독립 감사 이벤트로 분리.
4. 프로젝트 권한: owner/editor/viewer/outsider 별 요구사항과 UI·RLS·API가 같아야 함. 특히 editor 계획 초안 작성 ≠ 실행 승인.
5. 결제: 모델 공급자와 비용이 미확정이면 0원/무료라 표기하지 않으며 실모델 실행 차단.
6. 실패 복구: 새로고침/멀티탭/로그아웃/네트워크 단절·지연/재시도에서 중복 작업 및 데이터 덮어쓰기 금지.

## Cursor 결과 02에서 확인할 증빙
- PR #15/#19/#22/#23/#24의 writer 경로와 migration 재번호 문제 해결안.
- blind update 차단을 클라이언트 호출 규약뿐 아니라 **DB 권한/RPC**에서 검증하는지.
- 복원 이력과 원문 변경이 한 트랜잭션으로 유지되는지.
- 역할별 JWT/RLS와 프로젝트 간 데이터 누출 테스트 계획.
- 독립 PR #25/#27은 결함 안정화 완료 전 main으로 병합하지 않았는지.

**결론:** 현재 문서는 안전한 개발 방향을 제시하지만 역할 분리, 소스 스냅샷의 연속성, 단계별 고객 오류 복구를 합류 기준으로 명시해야 한다. 이 문서는 Cursor의 아직 전달되지 않은 결과를 추정하지 않는다.
