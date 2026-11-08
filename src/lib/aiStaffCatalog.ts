import { MOCK_SPECIALIST } from './mockSpecialistRequest'

export type AiStaffCard = {
  id: string
  title: string
  description: string
  capability: string
  available: boolean
}

/** Visible roster: 1 hireable Mock role + upcoming roles so the office is not empty. */
export const AI_STAFF_ROSTER: AiStaffCard[] = [
  {
    id: MOCK_SPECIALIST.id,
    title: MOCK_SPECIALIST.title,
    description: MOCK_SPECIALIST.description,
    capability: MOCK_SPECIALIST.capability,
    available: true,
  },
  {
    id: 'ai_pm_planner_v1',
    title: 'AI PM 플래너',
    description: '업무 분해·일정·우선순위를 제안하는 역할입니다.',
    capability: '준비 중 · 채용 불가',
    available: false,
  },
  {
    id: 'ux_flow_reviewer_v1',
    title: 'UX 흐름 검수',
    description: '화면 흐름·빈 상태·오류 안내의 빈틈을 점검합니다.',
    capability: '준비 중 · 채용 불가',
    available: false,
  },
  {
    id: 'policy_drafter_v1',
    title: '정책서 초안 작성',
    description: '서비스 정책·약관 초안을 정리하는 역할입니다.',
    capability: '준비 중 · 채용 불가',
    available: false,
  },
]
