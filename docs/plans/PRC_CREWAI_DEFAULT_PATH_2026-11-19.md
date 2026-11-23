# PR-C — requirements_auditor CrewAI 기본 경로 (2026-11-19)

**F/TF/N:** F-301/F-B 실행 경로 · Specialist request CTA  
**브랜치:** `feat/prb-skill-tool-registry-20261119` (PR-B 위 연속)  
**금지:** Gate C · Preview DDL apply · ops

## 목표

Preview/제품 기본 실행 = **CrewAI 큐**. `process_mock_ai_run` / Mock CTA = **E2E·픽스처 전용**.

## 변경

| 파일 | 내용 |
|------|------|
| `src/lib/aiExecutionPath.ts` | `isMockAiRunAllowed` / `defaultAiExecutionPath='crewai'` |
| `src/pages/SpecialistRequestMockPage.tsx` | CrewAI CTA 우선 · Mock 보조·E2E 라벨 |
| `src/lib/mockSpecialistRequest.ts` | capability: 실행 불가 → CrewAI 기본 |
| `tests/prc-crewai-default-path.test.mjs` | 계약 테스트 |

## 수락

- [x] Mock CTA는 DEV + (S3 fixture \| ALLOW_MOCK)만
- [x] 카탈로그/요청 화면이 “AI 실행 불가”를 주장하지 않음
- [x] 정적 계약 테스트 PASS
- [x] Chromium 계약→CrewAI enqueue — **PASS** (2026-11-23 Preview) run `02c42ff7…` `queued`
- [ ] Chromium CrewAI live claim·완료 — NOT RUN (워커 스택 별도)

## 다음 1코드

Preview 027/036/037 apply 승인 **또는** auditor Preview 스모크(키+워커 poll).
