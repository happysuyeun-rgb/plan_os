/**
 * PR-C: requirements_auditor_v1 (and sibling specialists) default to CrewAI queue.
 * process_mock_ai_run is E2E / disposable-only — never the Preview default.
 *
 * - Default path: enqueue → CrewAI worker claim/complete (credit/free Liner; Gate C closed)
 * - Mock path: VITE_S3_E2E_FIXTURE or VITE_ALLOW_MOCK_AI_RUN in DEV only
 */

export type AiExecutionPath = 'crewai' | 'mock_e2e'

/** S3 Chromium localDev IDs — skips live server contract hydrate. */
export function isS3E2eFixtureMode(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_S3_E2E_FIXTURE === 'true'
}

/** Disposable F-B/F-C local E2E: show process_mock CTA without S3 fixtureMode. */
export function isMockAiRunCtaAllowed(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_ALLOW_MOCK_AI_RUN === 'true'
}

/** Mock worker CTA / process_mock_ai_run — never in production builds. */
export function isMockAiRunAllowed(): boolean {
  return isS3E2eFixtureMode() || isMockAiRunCtaAllowed()
}

/** Product default for hireable auditor / market researcher. */
export function defaultAiExecutionPath(): AiExecutionPath {
  return 'crewai'
}

export const CREWAI_DEFAULT_PATH_NOTE =
  '기본 실행 경로: CrewAI 큐(워커 claim). Mock worker는 E2E·픽스처 전용이며 실 AI 성공으로 표시하지 않습니다.'
