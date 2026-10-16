# PlanOS 3.0 — AI 실행 아키텍처 / ADR-001

**최초 작성일:** 2026-10-16  
**최종 수정일:** 2026-10-16  
**문서 버전:** v0.1  
**진행 상태:** 제안(검토 전) / 실제 구현·부하·보안 검증 전  
**관련:** [PRD](../product/PRD.md) · [권한 정책](../product/PERMISSIONS_POLICY.md) · [TF](../product/TASK_FLOWS.md)

## 1. 결정 대상
**질문:** 브라우저 기반 생성/채팅 중심의 기존 PlanOS를 어떻게 **실제 서버 실행·지속 상태·권한/승인·예산·증빙**을 가진 AI PM + 전문 AI 시스템으로 확장할 것인가?

**제안:** 기존 React/Vite/Supabase 프런트·프로젝트/문서 데이터를 보존하고, 별도 **서버 오케스트레이터 + 영속 큐/워커 + ModelGateway + 정책/승인/예산 검증 + 산출물/감사 로그** 계층을 추가한다. 단, 최종 큐/호스팅 제품 선정은 개발 환경/비용 검증 후 결정한다.

## 2. CURRENT / TARGET 경계

| 구분 | CURRENT(정적 감사) | TARGET |
|---|---|---|
| 클라이언트 | React/Vite, Zustand, Supabase JS | 기존 유지, 실행·승인·증빙 UI 추가 |
| 생성/채팅 | `src/lib/api/generation.ts`, `chat.ts` 플레이스홀더 동작 | 서버 ModelGateway와 실제 도구 결과 연결 |
| 실행 기록 | `generation_runs` 관련 데이터 구조 | 워커 실행 상태·이벤트·검증·재시도/취소 영속 |
| 권한 | 기존 프런트 제어 + DB RLS(실제 검증 전) | API/RLS/워커 다중 검증, 테넌트 격리 |
| 결과 | 문서 생성/버전 등 기존 흐름 | 검증 증빙·비용·승인/수락을 연결한 산출물 |

**주의:** `generation_runs` 테이블이 있다는 사실은 실제 워커/모델 호출/재시도 구현의 증거가 아니다.

## 3. 논리 구성도

```text
React UI (PlanOS / AI 인력사무소)
    │ 사용자 인증/프로젝트 요청
    ▼
API/BFF ──────── Auth + Project RLS/Policy Gate
    │                     │
    ├── Contracts/Agents ─┤
    ├── Plans/Tasks ──────┤
    ├── Approvals ────────┤
    └── Run Requests ─────┘
             │
             ▼
      Budget Reservation ── Idempotency Guard
             │
             ▼
       Durable Job Queue  ←────────────┐
             │                        retry/backoff
             ▼                         │
       Server Orchestrator ── Policy Recheck
             │
       ┌─────┴──────────────┐
       ▼                    ▼
  AI PM Planner       Specialist Worker
       │                    │
       └──────┬─────────────┘
              ▼
         ModelGateway
       (provider adapter)
              │
       Tool Policy / Sandbox
              │
       Verified Tool Calls
              │
       Artifacts + Validator
              │
       Event Log + Cost Ledger
              │
       PM Evidence Briefing
              │
       Human Acceptance
```

## 4. 서비스 책임 경계

| 컴포넌트 | 책임 | 금지 |
|---|---|---|
| API/BFF | 인증·요청 검증·프로젝트/계약 스코프·승인 요청 | 클라이언트 입력을 곧바로 관리자 권한으로 실행 |
| Orchestrator | 상태 전이, PM 계획/전문가 위임, 취소/재시도 | 승인/예산 정책 우회 |
| Durable Queue/Worker | 브라우저와 무관한 실행, lease/heartbeat, 복구 | 영속 기록 없는 무한 루프 |
| ModelGateway | 모델 선택·공급자 어댑터·토큰 사용량·timeout | 프롬프트를 권한 정책으로 사용 |
| Tool Policy | allowlist, 입력 스키마, 리소스 범위, 위험 등급 | 임의 URL/파일/외부 발송 허용 |
| Approval Service | 승인 스냅샷, 만료/철회, payload digest 검사 | AI 스스로 고위험 승인 |
| Budget Ledger | 예약·사용·환불·상한·중복 청구 방지 | 단순 프런트 예상 비용만으로 허용 |
| Artifact Validator | 산출물 스키마/출처/테스트 결과 | 모델의 '완료' 문구를 검증으로 간주 |
| Audit/Event Store | append-only 상태·도구·승인·비용·오류 기록 | 민감 토큰·개인정보 원문 로그 |

## 5. 실행 상태 전이 (개념)

```text
draft → planned → awaiting_approval → queued → running → verifying
                                                   │         │
                                                   ▼         ▼
                                                blocked   awaiting_acceptance
                                                   │         │
                                                   ▼         ▼
                                                failed    accepted
                  queued/running ── cancel request ──→ cancelled*
                  awaiting_acceptance ── revision ──→ needs_revision
```

- `cancelled*`: 외부 도구 실행 중이면 취소 요청이 곧 완료를 뜻하지 않는다. `cancel_requested`와 최종 `cancelled/failed/completed_with_side_effect` 구분을 데이터 설계에서 확정.
- **승인 전 실행 금지:** 계획 승인과 도구 행위별 승인을 분리. R3는 행위별 승인 필수.
- 상태 전이는 서버의 허용 전이표로 강제. `accepted`는 **사용자 수락**이므로 워커가 직접 설정할 수 없음.
- PM 결과 브리핑은 로그/검증/비용의 **읽기 전용 사실**로 구성한다.

## 6. 한 번의 E2E 시퀀스
1. owner가 역할 계약·예산·허용 도구에 동의한다.
2. PM이 계획/작업/검증 기준을 작성한다. owner가 계획을 승인한다.
3. API는 `project_id/contract_id/task_id` 및 `idempotency_key`를 검증한다.
4. 예산을 원자적으로 예약하고 `run_id`와 큐 작업을 생성한다(트랜잭션/아웃박스 방식 검토).
5. 워커가 lease를 얻고 **실행 직전** 권한·계약·예산·승인을 재검증한다.
6. ModelGateway가 공급자/모델을 선택하고, Tool Policy가 도구·입력·대상 범위를 검사한다.
7. 도구 실행 결과·trace·산출물·비용을 영속 저장한다. 검증 실패 시 `failed/needs_revision`.
8. 검증 통과 시 `awaiting_acceptance`. PM이 근거 기반 브리핑을 생성한다.
9. owner(또는 승인된 위임자)가 수락/반려/수정 요청한다. 비용을 정산한다.

## 7. 실패·중복·복구 정책

| 실패 지점 | 복구 설계 | 확인할 테스트 |
|---|---|---|
| API 중복 요청 | 사용자+프로젝트+요청 종류+멱등성 키 유니크 | 더블클릭 2회 → run 1개 |
| DB 저장 후 큐 전송 실패 | 트랜잭셔널 아웃박스/복구 스캐너 | 작업 유실 없이 재전송 |
| 워커 종료/프로세스 장애 | lease 만료·heartbeat·안전 재시도 | 브라우저/워커 종료 후 상태 유지 |
| 모델 공급자 장애 | timeout·제한된 재시도·회로 차단 | 공급자 장애 시 예산/데이터 보존 |
| 도구 부분 실행 | 외부 효과 기록, 안전한 재실행 가능 여부 확인 | 중복 이메일/배포/결제 없음 |
| 승인 만료·계약 해지 | 실행 직전 재검증, 진행 중 중단 요청 | 권한 철회 후 신규 호출 차단 |
| 예산 부족/초과 | 실행 전 예약, 실행 중 사용량 차단, 실패 정산 | 프로젝트 상한 초과 없음 |
| 검증 실패 | 산출물 미수락·근거 노출·수정 요청 | '완료'로 표시되지 않음 |
| 중복 이벤트 | 이벤트 ID/상태 버전 CAS | 중복 수락·중복 과금 없음 |

**외부 부작용 주의:** 네트워크 호출/발송/결제는 완전한 exactly-once를 보장하기 어렵다. 외부 제공자의 멱등성 지원, 보상 절차, 수동 확인을 조합하고 **중복 방지 목표와 보장 범위**를 명시한다.

## 8. 데이터 경계(개념 엔터티)
- `agent_profiles / agent_capabilities`: 공개 가능한 역할 능력과 검증 수준.
- `agent_contracts / agent_assignments`: 계약 조건·동의 버전·프로젝트 배치.
- `plans / tasks / task_dependencies`: 계획·사람/AI 공통 업무·승인된 버전.
- `runs / run_events / tool_calls`: 영속 실행·도구 요청·결과·trace.
- `approvals`: 승인 요청 스냅샷·결정·만료/철회.
- `artifacts / artifact_verifications / acceptances`: 산출물·검증·사람 수락.
- `budget_reservations / usage_ledger`: 예산 예약·실사용·환불/조정.
- `outbox_events`: DB 커밋과 큐 전달의 복구 연결.
- **명칭/키/인덱스/RLS는 후속 데이터 명세에서 확정.** 기존 projects/documents/versions와 충돌/중복 여부 먼저 감사.

## 9. 보안·데이터 격리
- 사용자 토큰을 모델 프롬프트에 넣지 않음. 서버 도구는 짧은 수명·자원 범위가 좁은 실행 권한만 사용.
- 모델 출력/외부 웹/첨부 문서는 **신뢰하지 않는 데이터**. 프롬프트 인젝션으로 도구 권한·승인·예산을 변경할 수 없어야 함.
- 도구별 허용 URL/도메인/파일 경로·명령·쓰기 대상 제한, 비밀 관리, 감사 로그 마스킹.
- 멀티테넌트 메모리는 프로젝트·사용자별 격리. 공유는 명시적 동의/범위/철회 절차.
- RLS 정책의 정적 위험(Issue #7)은 격리 개발 DB 재현 후 보완. 운영 DB 마이그레이션은 별도 승인.

## 10. 공급자·모델 선택
- 기본: 상용 이용 약관·안정성·도구 호출·데이터 정책·가격을 검증한 공급자 우선.
- ModelGateway 어댑터는 공급자 장애/가격 변동에 대응하되, 고객 데이터 처리 조건이 달라지는 자동 전환은 별도 정책 필요.
- FreeLLMAPI는 **개발자 개인 실험용 선택지**. 공개 상용 경로·무료 무제한 비용 가정에 포함하지 않음.
- 모델/도구/품질 검증 수치가 없는 역할에 검증 배지를 붙이지 않음.

## 11. ADR 후보 비교

| 대안 | 장점 | 위험 | 판단 |
|---|---|---|---|
| A. 프런트 단독 AI 호출 | 빠른 프로토타입 | 키 유출·브라우저 종료·권한/예산 통제 부재 | **기각** |
| B. 서버 API 요청 하나로 장시간 실행 | 구조 단순 | 타임아웃·복구·재시도·상태 유실 | **MVP 운영 구조로 기각** |
| C. API + 영속 큐/워커 + 정책/승인/원장 | 내구성·감사·통제 | 초기 설계/운영 비용 | **권고** |
| D. 전면 마이크로서비스 분리 | 확장성 | 1인 개발 복잡도·운영 부담 | **초기에는 보류** |

**권고:** 모듈형 서버 + 하나의 영속 워커 파이프라인으로 시작. 공급자/큐 제품 확정은 작은 수직 슬라이스 검증 후 결정.

## 12. MVP 수직 슬라이스 수용 조건
- [ ] PM + 전문 AI 1개 역할이 **실제 도구 1종**으로 검증 가능한 산출물 생성.
- [ ] owner가 계약·계획·위험 도구·산출물 수락을 명시적으로 제어.
- [ ] 브라우저 종료·워커 재시작·중복 요청 후에도 작업/비용/증빙 일관.
- [ ] outsider/viewer/editor의 비허용 실행·계약·승인 차단.
- [ ] 예산 초과/승인 철회/계약 만료/검증 실패 시 올바른 실패 상태.
- [ ] 실제 사용자 시나리오 E2E 및 비용 원가 기록.
- [ ] 기존 PlanOS 문서/프로젝트/휴지통 기능 회귀 없음.

## 13. 미결정/선행 작업
1. 실제 워커 호스팅/큐/스케줄러 및 DB 트랜잭션 경계 선택.
2. 첫 전문 AI 업무·실도구 1종과 자동 검증 기준 선정.
3. 예산 단위(통화/크레딧), 예약/정산/환불 정책.
4. R2 내부 쓰기 도구의 승인 기본값·승인 위임 정책.
5. 모델 데이터 처리/메모리 보존·삭제/비식별화 정책.
6. 실제 개발 DB RLS 재현 및 CI/브라우저 회귀 테스트.
7. 상태 전이/API/DB·테스트 계약 문서 확정.

## 변경 이력
| 날짜 | 버전 | 변경 | 상태 |
|---|---|---|---|
| 2026-10-16 | v0.1 | 서버 워커/ModelGateway/도구/승인/예산/증빙 아키텍처 및 실패 복구 ADR 초안 | 검토 전 |
