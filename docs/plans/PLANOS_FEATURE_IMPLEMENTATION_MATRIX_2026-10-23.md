# PlanOS 기능 구현 매트릭스 (2026-10-23)

정본 코드 (역사): `preview/planos-integrated-20261023`.  
**2026-10-25 현행 코드:** GitHub `main` @ **`f780691`** (PR #45 포함).  
상태값: `코드완료` / `검증완료(격리)` / `병합완료` / `운영완료` / `부분` / `Mock` / `미착수` / `설계만` / `DEPRECATED`.

문서완료 ≠ 코드완료. **운영완료·Production은 현재 전 항목 해당 없음.**

### 2026-10-25 정정 (본 표보다 우선)

| ID | 이전 표기 | 정정 | 근거 |
|---|---|---|---|
| F-105 | 코드완료(브랜치) | **병합완료** · Preview E2E 미증빙 | PR #45 → main |
| F-401~402 | 병합완료 | **병합완료** 유지 | PR #36 |
| C04/DASH | 병합완료 | **병합완료** + Preview 수용 미증빙 | PR #42 |
| GEN | Mock + BFF | **Mock + BFF 계약** (유료 차단) · main | Vite+`api/ai/generate` |
| AI-REV | Mock 코드완료(브랜치) | **Mock 병합완료(main)** · 027 호스티드 미적용 · 실 LLM 미연결 | `/ai-review` |
| main | #45 미병합 | Phase A+#45 **병합완료** `f780691` | GitHub |
| Sonar #30/#36/#45 | — | #45 Sonar Security A 통과 후 병합 | CI |

---

## 1. 기존 PlanOS · G1

| ID | 기능 | 상태 | 근거 | 누락 |
|---|---|---|---|---|
| F-001 | 가입·로그인 | 부분 | Supabase Auth; Google OAuth는 Preview 미연결 | Preview OAuth, 운영 회귀 |
| F-002 | 프로젝트 CRUD | 코드완료 | Create/List/Trash | 운영 회귀 |
| F-003 | 문서 저장 | 검증완료(격리) | CAS 018, autosave | 운영 적용 |
| F-004 | 버전·복원 | 검증완료(격리) | 015 RPC, append-only 014/026 | 021 컷오버 UNDECIDED |
| F-005 | 멤버·권한 | 부분 | RLS 013/014 | 초대 UX 고도화 |
| G1-chat | 채팅→문서 | 검증완료(격리) | 016 | — |
| G1-guest | 게스트 이전 | 검증완료(격리) | guestTransfer | — |
| GEN | AI 문서 생성 | Mock | `placeholderContent.ts` | 실 LLM (Phase C) |

## 2. S1 업무 · 사람 PM · C04

| ID | 기능 | 상태 | 근거 | 누락 |
|---|---|---|---|---|
| F-101~103 | 업무 CRUD·상태 | 부분 | 플래그 ON 시 011/020 | 기본값 OFF, 상세 UI |
| F-104 | 삭제·복원 | 부분 | 서버 soft-delete | owner-only 정책 D-4 |
| F-105 | 상세·담당·이력 | 미착수/부분 | 목록 UI만 | 상세 라우트·이벤트 UI |
| F-401 | PM 계획 작성 | 검증완료(격리) | 022~024, UI | main 미병합 |
| F-402 | 승인·반려·재오픈 | 검증완료(격리) | 동일 (문서 구버전 “미구현”은 DEPRECATED) | — |
| F-402-link | 단계→S1 task | 검증완료(격리) | link RPC | — |
| C04/DASH | 통합 대시보드 | 검증완료(격리) | 025, DashboardPage | Preview 사용자 수용 |

## 3. S2 감사 · S3 계약 Mock

| ID | 기능 | 상태 | 누락 |
|---|---|---|---|
| F-201~202 | 감사 소스·manifest | 부분 | 실실행 파이프라인 연결 |
| F-301~303 | AI 역할 요청·계약 | Mock (PR #25) | digests·예산원장·철회 |

## 4. AI 실행 · 검수 · 인력사무소 (TARGET)

| ID | 기능 | 상태 | 설계 출처 |
|---|---|---|---|
| F-501~504 | 큐·워커·검수실행·취소 | 설계만 | ADR-002, P1-5 |
| F-601~603 | 보고서·수락·브리핑 | 설계만 | PR #28 |
| AI-REV | 기획 검수 직원 | **Mock 병합완료(main)** · 027 호스티드 미적용 | `/ai-review` · PR #45 |
| AI-PM | 실제 AI PM 실행 | 설계만 | 사람 PM과 구분 필수 |
| AI-HIRE | 채용·모델·등급·성향 | 설계만 | AI_STAFF_* specs |
| AI-CAREER | 경력·동의·승급 | 설계만 | VERIFIED_EXPERIENCE_* |
| AI-PRICE | 단발/구독 과금 | 설계만 | OP/DEC UNDECIDED |
| N29 | 복수 프로젝트 PM 대시보드 | 설계만 | PR #40 (C04와 분리) |

## 5. 인프라 · 출시

| ID | 항목 | 상태 |
|---|---|---|
| MIG-001~026 | Preview DB 적용 | 검증완료(격리) |
| MIG-ops | 운영 DB | 미착수 (read-only도 미실시) |
| Preview | planos-preview.vercel.app | 검증완료(격리) |
| main | 병합 | **완료** `f780691` (#45 포함) |
| Production | 배포 | 미착수 |
| Sonar #42 | OK | 검증완료 |
| Sonar #36/#30 | 역사 FAIL → 병합 후 해소 | 검증완료(병합) |
| Sonar #45 | Security A | 검증완료(병합) |

---

## 판정 규칙

- **코드완료**: 브랜치에 동작 코드 존재  
- **검증완료(격리)**: 로컬/CI/Preview JWT·E2E 증거  
- **병합완료**: `main`에 포함  
- **운영완료**: 운영 DB+Production 검증  
- 증거 없이 상위 상태로 승격 금지 (Issue #41과 동일)
