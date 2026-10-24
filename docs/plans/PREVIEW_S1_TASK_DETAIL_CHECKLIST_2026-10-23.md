# Preview — S1 업무 상세·담당·이력 검증 체크리스트 (2026-10-23)

환경: https://planos-preview.vercel.app · DB `PlanOS-Preview` · `VITE_S1_SERVER_TASKS=true`  
코드: PR #44 `feat/planos-bcd-foundation-20261023-wip`  
**이 체크는 UI/권한 검증이다. Placeholder·인메모리 ReviewJob을 “실제 AI 실행 완료”로 체크하지 않는다.**

## 공통

- [ ] Preview에 배포된 커밋에 `/projects/:id/tasks/:taskId` 라우트 포함
- [ ] 업무 목록에서 제목 또는「상세·이력 보기」로 진입 가능

## Owner

- [ ] 업무 상세에서 제목·목표·완료기준·담당 표시
- [ ] `project_task_events` 이력 노출 (생성/상태 변경 등)
- [ ] 역할 표시: owner (편집 가능)

## Editor

- [ ] 동일 프로젝트 업무 상세·이력 읽기 가능
- [ ] 목록에서 상태/담당 편집 가능 (기존 보드 권한)
- [ ] 역할 표시: editor

## Viewer

- [ ] 업무 상세·이력 **읽기만** 가능
- [ ] 목록에서 상태 변경 컨트롤 없음 (기존 보드)
- [ ] 역할 표시: viewer (읽기 전용)

## Outsider / 비멤버

- [ ] 직접 URL 접근 시 업무 없음 또는 접근 불가 안내
- [ ] REST로 `project_tasks` / `project_task_events` 0행 (RLS)

## 미해당 (완료 금지)

- [ ] ~~실 LLM 생성~~ — BFF는 placeholder 모드만
- [ ] ~~검수 AI 영속 DB~~ — `027_ai_review_jobs_DRAFT` 미적용
- [ ] ~~유료 API 호출~~ — 예산 캡 기본 0, 승인 전 금지
