# PlanOS 남은 개발 체크리스트

**기준 tip:** `main` @ `671f6fd` (#80 병합, 2026-11-13)  
**정책:** 이중진입 유지 · 호스티드 027/033 / 유료 LLM / Production = **명시 승인 전 금지**  
**최신 스냅샷:** [PHASE0_AGENT_BASELINE_2026-11-14.md](./PHASE0_AGENT_BASELINE_2026-11-14.md) · [PROGRESS_STATUS.md](../PROGRESS_STATUS.md)  
**승인 게이트 보류(급하지 않음):** [DEFERRED_GATES_REMAINING_IMPL_2026-11-08.md](./DEFERRED_GATES_REMAINING_IMPL_2026-11-08.md)  
**정합 산출물:** [STATUS_VOCABULARY](./STATUS_VOCABULARY_2026-10-25.md) · [PERMISSION_MATRIX](./PERMISSION_MATRIX_2026-10-25.md) · [FEATURE_TRACEABILITY](./FEATURE_TRACEABILITY_2026-10-25.md) · [DESIGN_DEFECT_DECISION_LOG](./DESIGN_DEFECT_DECISION_LOG_2026-10-25.md) (R2 표 포함)

---

## 0. 이미 끝난 것 (참고 · 체크 완료)

- [x] Phase A~D Mock MVP (#45·#46 등)
- [x] Gate A-027 / C-LLM 런북 문서 (#47·#48)
- [x] S3 채용 Mock `/specialists/request` (#49)
- [x] 채용 → `/ai-review` 세션 핸드오프 (#50)
- [x] staffing brief → Mock 검수 job 연동 (#51)
- [x] 남은 개발 체크리스트 + S1 owner soft-delete (#52)
- [x] 대시보드·생성 “진행 중 AI 투입” 안내 (#53)
- [x] AI 직원 1종 카탈로그 카드 Mock (#54)
- [x] 사람 PM(`/plans`) ↔ AI 검수(`/ai-review`) 병행 고지 (#55)
- [x] 채용→검수→S1 E2E fixture 문서 (#56)
- [x] S1 감사 이력 주체·로드 오류 고지 (#57)
- [x] S2 manifest digest 재검증 게이트 (#61)
- [x] F-A 서버 계약·명시 동의 Mock (`requirements_auditor_v1`, #62)
- [x] F-B Mock worker 큐·실행 이력·mock usage (#63)
- [x] F-C Mock 보고서 수락·S1 task 연결 (#64)
- [x] F-105 AI 담당 지정 Mock + 설계 정합 + placeholder 가드 (#59; #58 흡수)
- [x] F-402 사람 PM 승인·반려·재수정 루프 E2E (#60)
- [x] Gemini BFF + AI 직원 허브 `/ai-staff` + localDevData (#66)
- [x] Draft 설계 문서 고유분 main 입고 (#67; #26·#28·#40 닫음)
- [x] `ai_suggested` PM Mock (#70)
- [x] 라우트 번들 분할 (#71)
- [x] C08 아바타 파일 업로드 · 랜딩 · 이용 가이드 · 카드 진행률 (#80)
- [x] Phase 0 CI `ubuntu-24.04` + AI 직원 Mock/실실행 기준선 문서 (PR-A)

### 0-B. 아직 Mock만 (실모델 워커 아님)

- [ ] `requirements_auditor_v1` **실모델** 분석 워커 (현재 `process_mock_ai_run`만)
- [ ] Agent Definition / Skill·Tool Registry (PR-B)
- [ ] 호스티드 `033_avatars_storage` 적용 (승인 후)
- [ ] 유료/승인 LLM 경로 (Gate C-LLM)

---

## 1. 지금 바로 가능 (DB·과금·027 없이 · Mock/브라우저)

### 1-C. 품질·회귀

- [x] 전체 `npm run lint` 잔여 오류 정리 (#68)
- [x] 번들 분할(청크 과대) — 라우트 `React.lazy` (랜딩/로그인 eager)
- [x] PROGRESS / DUAL_ENTRY 문서의 “#25 보류” 등 구식 표기 → #49~#51 반영
- [x] 오래된 P0 이슈 코드측 재검증·클로즈 (2026-11-08)
  - [x] #6 lint → `npm run lint` 0
  - [x] #10 채팅 문서 쓰기 우회 → write lane + `commit_chat_document_edit`(016)
  - [x] #16 버전 복원 원자성 → `restore_document_version`(015) + operationId
  - [x] #12/#7 `project_members` 재귀·댓글 hardening → 013/014 **코드/마이그레이션 main**
  - [x] #4 ADR-002 문서 · #29 G1 통합(#30) main 반영
  - [ ] 운영/호스티드에 013/014/015/016 **적용 여부**는 §3 출시 게이트(읽기 전용 확인)에서 별도

---

## 1-D. 승인 없이 바로 가능 (게이트 보류 중 · 2026-11-08)

- [x] **이중진입 E-01** — `/projects/new` 「직접 기획 | 기본 PM」 경로 선택 UI (interview_answers 메타 · 모드 잠금 아님)
- [x] **E-03/E-06 Mock 고지** — MidProjectAiStaffingNotice(문서 화면 포함) + StaffingDigestGateNotice(`/ai-review`·specialist 요청). 서버 digest 강제·유료 게이트는 잔여
- [x] **AI 직원 카탈로그 Mock 확장** — hub/catalog에 #37 영업·#38 마케터 준비 중 자리(표시만 · 채용/결제/발송 없음). 실직무 구현은 P2/FUTURE 잔여
- [x] **#34 연동 · 교차검수 진입 CTA** — 문서 2종+일 때 DocumentPage → `/ai-review` Mock 미리보기 (자동 PASS·유료 금지). 실험 B Version A 샘플 추가

---

## 2. 정책·설계 승인 후 — **보류(급하지 않음)** · 상세 [DEFERRED_GATES…](./DEFERRED_GATES_REMAINING_IMPL_2026-11-08.md)

### 2-A. 계약·예산

- [x] F-302 **Mock 서버 계약** (동의·철회·만료·서버 digest) — #62  
  - [ ] 유료/실공급사 연동·실청구 계약은 별도 승인 후
- [ ] F-303 예산 상한·원장·청구 (₩0 날조 금지 유지) — **보류**

### 2-B. AI 실행 파이프라인

- [x] F-501~504 **Mock** 서버 큐·worker·이력·mock usage — #63  
  - [ ] 실 worker·유료 사용량·본격 취소/재시도 고도화는 별도
- [x] F-601~603 **Mock** 보고서·사람 수락·S1 연결 — #64  
  - [ ] 브리핑/실공급사 산출물 고도화는 별도
- [ ] 유료 LLM **공식 게이트**(Gate C-LLM) · Preview/운영 경로 — **보류**  
  - 참고: 로컬 Vite BFF + Gemini(#66)는 개발 검증용. 과금·호스티드 키·Production ≠ 완료

### 2-C. 사람 PM 고도화

- [x] F-402 승인·반려·재수정 상태머신 (서버 CAS) — #60  
- [x] `ai_suggested` PM 계획 소스 Mock (032 + 목록 CTA · 실 AI PM/유료 아님) — #70

---

## 3. 맨 마지막 (명시 승인) — **보류(급하지 않음)**

- [ ] Preview 호스티드에 027 적용 (Gate A-027)
- [ ] Preview E2E 전수
- [ ] 운영 009/010≡013/014 **읽기 전용** 확인
- [ ] Production 배포

---

## 4. P2 / 후순위

- [ ] AI 인력사무소 풀스펙 (복수 직무·경력 티어·평판)
- [ ] 서버 리뷰 스토어 프로덕션 경로
- [x] N29 복수 프로젝트 PM 운영실 **Mock 자리** (`/ai-staff/pm-ops` · 배정·scheduler·유료 없음) — 실배정·worker는 잔여
- [x] F-801 면담·추천·평판 **Mock 자리** (`/ai-staff/reputation` · 별점/경력 원장·면담 엔진 없음) — 실구현은 MVP 후 잔여
- [ ] AI 마케터·영업 **실직무** FUTURE (#37·#38) — 카탈로그 자리 표시는 완료, 실행/게시/발송은 미착수
- [ ] 사업 검증 트랙 (#34) — 합성 샘플·앱 진입 CTA는 보강됨. **인터뷰 모집·유료 실험은 owner 실행**

---

## 추천 다음 1개 (작음) · 2026-11-10

1. **#34 인터뷰 모집·시연**(owner · 코드 외) 또는 게이트 승인 후 항목  
2. 게이트(C-LLM/027/F-303/Production)는 [보류 문서](./DEFERRED_GATES_REMAINING_IMPL_2026-11-08.md) — 승인 문장 오기 전 착수 금지  
3. P2 잔여: 인력사무소 풀스펙 · 서버 리뷰 스토어 프로덕션 경로 (#37/#38 실직무)

