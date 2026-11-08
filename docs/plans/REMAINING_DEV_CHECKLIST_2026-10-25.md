# PlanOS 남은 개발 체크리스트

**기준 tip:** `main` @ `81ba632` (#67 병합, 2026-11-08)  
**정책:** 이중진입 유지 · 호스티드 027 / 유료 LLM / Production = **명시 승인 전 금지**  
**최신 스냅샷:** [PROGRESS_SNAPSHOT_2026-11-08.md](./PROGRESS_SNAPSHOT_2026-11-08.md)  
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

---

## 1. 지금 바로 가능 (DB·과금·027 없이 · Mock/브라우저)

### 1-C. 품질·회귀

- [x] 전체 `npm run lint` 잔여 오류 정리 (본 PR)
- [ ] 번들 분할(청크 과대)
- [x] PROGRESS / DUAL_ENTRY 문서의 “#25 보류” 등 구식 표기 → #49~#51 반영
- [ ] 오래된 OPEN 이슈 재검증·클로즈 (#10·#12·#16·#6 등)

---

## 2. 정책·설계 승인 후 (지금은 착수 금지에 가깝음)

### 2-A. 계약·예산

- [x] F-302 **Mock 서버 계약** (동의·철회·만료·서버 digest) — #62  
  - [ ] 유료/실공급사 연동·실청구 계약은 별도 승인 후
- [ ] F-303 예산 상한·원장·청구 (₩0 날조 금지 유지)

### 2-B. AI 실행 파이프라인

- [x] F-501~504 **Mock** 서버 큐·worker·이력·mock usage — #63  
  - [ ] 실 worker·유료 사용량·본격 취소/재시도 고도화는 별도
- [x] F-601~603 **Mock** 보고서·사람 수락·S1 연결 — #64  
  - [ ] 브리핑/실공급사 산출물 고도화는 별도
- [ ] 유료 LLM **공식 게이트**(Gate C-LLM) · Preview/운영 경로  
  - 참고: 로컬 Vite BFF + Gemini(#66)는 개발 검증용. 과금·호스티드 키·Production ≠ 완료

### 2-C. 사람 PM 고도화

- [x] F-402 승인·반려·재수정 상태머신 (서버 CAS) — #60  
- [ ] `ai_suggested` PM 계획 소스 (마이그레이션/RPC 필요 시)

---

## 3. 맨 마지막 (명시 승인)

- [ ] Preview 호스티드에 027 적용 (Gate A-027)
- [ ] Preview E2E 전수
- [ ] 운영 009/010≡013/014 **읽기 전용** 확인
- [ ] Production 배포

---

## 4. P2 / 후순위

- [ ] AI 인력사무소 풀스펙 (복수 직무·경력 티어·평판)
- [ ] 서버 리뷰 스토어 프로덕션 경로
- [ ] N29 복수 프로젝트 PM 대시보드
- [ ] F-801 면담·추천·평판 (MVP 후)
- [ ] AI 마케터·영업 FUTURE (#37·#38)
- [ ] 사업 검증 트랙 (#34)

---

## 추천 다음 1개 (작음)

1. **번들 분할(청크 과대)**  
2. 또는 오래된 P0 이슈 재검증·클로즈 (#10·#12·#16·#6)  
3. 또는 (승인 후) Gate C-LLM / Preview 027  
