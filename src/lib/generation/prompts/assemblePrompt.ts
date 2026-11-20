import type { DocumentType } from '../../../types'
import type { GenerationVars } from '../../ai/GenerationProvider'
import { getPromptBundle } from './registry'
import { SHARED_OUTPUT_RULES } from './shared/outputRules'
import { SHARED_VOICE } from './shared/voice'
import type { PromptContextPack } from './types'

function formatInterview(answers?: Record<string, string>): string {
  if (!answers || Object.keys(answers).length === 0) return '(없음)'
  return Object.entries(answers)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')
}

function formatPriorDocs(
  docs?: Partial<Record<DocumentType, string>>,
  label = '이전 단계 문서',
): string {
  if (!docs) return `${label}: (없음)`
  const entries = Object.entries(docs).filter(([, v]) => Boolean(v?.trim()))
  if (entries.length === 0) return `${label}: (없음)`
  return [
    `${label}:`,
    ...entries.map(([type, body]) => {
      const clipped = (body ?? '').trim().slice(0, 6000)
      return `### [${type}]\n${clipped}${clipped.length >= 6000 ? '\n…(이하 생략)' : ''}`
    }),
  ].join('\n\n')
}

function buildPmPlanDraftPrompt(vars: GenerationVars): string {
  const extra = vars.interviewAnswers?.instruction?.trim() ?? ''
  return [
    '당신은 PlanOS의 시니어 PM입니다.',
    '출력은 한국어 마크다운만. 서론·사과 금지.',
    '형식 고정:',
    '## 목표',
    '(한 단락)',
    '### 단계 1 제목',
    '완료 기준: …',
    '### 단계 2 제목',
    '완료 기준: …',
    '### 단계 3 제목',
    '완료 기준: …',
    '결제·채용·성과 수치·가짜 KPI를 만들지 마세요.',
    '',
    `프로젝트명: ${vars.title}`,
    `목표 사용자: ${vars.targetUser}`,
    `서비스 유형: ${vars.serviceType ?? '미정'}`,
    `서비스 설명: ${vars.description ?? ''}`,
    extra ? `추가 지시: ${extra}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Assemble the final LLM prompt for a document type.
 * Shared voice + type bundle + project inputs + optional prior/approved context.
 */
export function assemblePrompt(
  type: DocumentType,
  vars: GenerationVars,
  context: PromptContextPack = {},
): string {
  if (vars.interviewAnswers?.purpose?.trim() === 'pm_plan_draft') {
    return buildPmPlanDraftPrompt(vars)
  }

  const bundle = getPromptBundle(type)
  const approvedDecisions =
    context.approvedDecisions?.trim() ||
    vars.approvedDecisions?.trim() ||
    '(아직 없음)'

  const approvedDocs =
    context.approvedSourceDocuments ?? vars.approvedSourceDocuments
  const priorDocs = context.priorDocuments ?? vars.priorDocuments

  return [
    SHARED_VOICE,
    '',
    SHARED_OUTPUT_RULES,
    '',
    '---',
    '',
    bundle.system,
    '',
    bundle.outline,
    bundle.schema ? `\n${bundle.schema}` : '',
    '',
    '---',
    '',
    '**공통 입력 정보**',
    `- 프로젝트명: ${vars.title}`,
    `- 서비스 유형: ${vars.serviceType ?? '미정'}`,
    `- 서비스 설명: ${vars.description ?? ''}`,
    `- 대상 사용자: ${vars.targetUser}`,
    '- AI 인터뷰 답변:',
    formatInterview(vars.interviewAnswers),
    `- 사용자 확정 결정사항: ${approvedDecisions}`,
    formatPriorDocs(approvedDocs, '이전 단계 확정 문서'),
    formatPriorDocs(priorDocs, '파이프라인 직전 산출물(초안 포함)'),
  ]
    .filter((line) => line !== '')
    .join('\n')
}
