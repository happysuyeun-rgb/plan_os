# PlanOS 문서 인벤토리·이동 대장 — 2026-10-21

**범위 제한:** GitHub main에서 직접 조회한 주요 문서 16개. 도구상 전체 디렉터리 열거가 불가능해 전수조사 완료로 간주하지 않는다. Cursor 로컬 `git ls-files docs`로 확인 예정.

| 파일 | 분류 | 처리 |
|---|---|---|
| product/PRD.md | CURRENT | 유지 |
| product/FUNCTIONAL_SPEC_V1_2026-10-20.md | CURRENT | 유지 |
| product/SERVICE_PLAN_V1_2026-10-20.md | CURRENT | 유지 |
| product/SERVICE_OPERATIONS_POLICY_V1_2026-10-20.md | CURRENT | 유지 |
| product/TASK_FLOWS.md | REFERENCE | 유지 |
| ux/SCREEN_SPEC.md, ux/IA.md | REFERENCE | 유지 |
| engineering/MVP_BUILD_READY_SPEC_2026-10-20.md | CURRENT | 유지 |
| engineering/ARCHITECTURE.md, engineering/DATA_MODEL.md, engineering/API_CONTRACTS.md | REFERENCE | 유지 |
| plans/PLANOS_INTEGRATED_EXECUTION_PLAN_2026-10-21.md | CURRENT | 유지 |
| quality/S1_TASK_CROSS_AUDIT_2026-10-20.md | REFERENCE | 유지 |
| quality/PHASE1_CROSS_AUDIT_2026-10-19.md | REFERENCE | 유지 |
| quality/DOCUMENT_REVIEW_2026-10-16.md | REFERENCE | 유지 |
| TECH_SPEC.md | ARCHIVE | 원문 → archive/legacy-v1/TECH_SPEC.md, 원 경로 안내 유지 |

**정리 정책:** CURRENT는 위치 유지. 구문서는 원문 보존+구 경로 redirect. 원문 상대링크 검수 전 삭제 금지. PR #15/#19 미병합 자료 이동 보류.

## 진행 체크
- [x] 주요 16개 파일 1차 직접 확인·분류
- [x] 과거 V1 기술명세 원문을 archive/legacy-v1에 복사
- [x] 구 경로에 최신 명세 링크 안내 유지
- [ ] 저장소 전체 문서 목록 확보 및 구문서 전체 분류
- [ ] Markdown 상대링크·코드/CI 경로 실제 검사
- [ ] 문서정리 PR 검토 및 병합
