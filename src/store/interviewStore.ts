import { create } from 'zustand'
import type { ServiceType } from '../types'

export interface InterviewQuestion {
  id: string
  text: string
  required: boolean
  type: 'text' | 'radio'
  options?: string[]
}

const REQUIRED_QUESTIONS: InterviewQuestion[] = [
  { id: 'q1', text: '로그인/회원가입이 필요한가요?', required: true, type: 'radio', options: ['예', '아니오'] },
  { id: 'q2', text: '수익모델이 있나요? (유료/무료/광고)', required: true, type: 'radio', options: ['유료', '무료', '광고'] },
  { id: 'q3', text: '모바일 앱인가요, 웹인가요?', required: true, type: 'radio', options: ['모바일 앱', '웹', '둘 다'] },
]

const OPTIONAL_BY_TYPE: Partial<Record<ServiceType, InterviewQuestion>> = {
  '앱': { id: 'q4', text: '소셜 기능(댓글, 좋아요 등)이 필요한가요?', required: false, type: 'radio', options: ['예', '아니오'] },
  '웹': { id: 'q4', text: '소셜 기능(댓글, 좋아요 등)이 필요한가요?', required: false, type: 'radio', options: ['예', '아니오'] },
  '커머스': { id: 'q4', text: '결제 기능이 필요한가요?', required: false, type: 'radio', options: ['예', '아니오'] },
  'SaaS': { id: 'q4', text: '팀/멤버 기능이 필요한가요?', required: false, type: 'radio', options: ['예', '아니오'] },
}

const COMMON_Q5: InterviewQuestion = {
  id: 'q5',
  text: '관리자 페이지가 필요한가요?',
  required: false,
  type: 'radio',
  options: ['예', '아니오'],
}

interface InterviewState {
  answers: Record<string, string>
  currentQuestionIndex: number
  serviceType: ServiceType | ''
  skippedAll: boolean

  setServiceType: (type: ServiceType) => void
  setAnswer: (questionId: string, answer: string) => void
  skipQuestion: () => void
  skipAll: () => void
  nextQuestion: () => void
  getQuestions: () => InterviewQuestion[]
  getCurrentQuestion: () => InterviewQuestion | null
  isComplete: () => boolean
  reset: () => void
}

export const useInterviewStore = create<InterviewState>((set, get) => ({
  answers: {},
  currentQuestionIndex: 0,
  serviceType: '',
  skippedAll: false,

  setServiceType: (type) => set({ serviceType: type }),

  setAnswer: (questionId, answer) => {
    set((s) => ({
      answers: { ...s.answers, [questionId]: answer },
      currentQuestionIndex: s.currentQuestionIndex + 1,
    }))
  },

  skipQuestion: () => set((s) => ({ currentQuestionIndex: s.currentQuestionIndex + 1 })),

  skipAll: () => set({ skippedAll: true }),

  nextQuestion: () => set((s) => ({ currentQuestionIndex: s.currentQuestionIndex + 1 })),

  getQuestions: () => {
    const { serviceType } = get()
    const optional = serviceType ? OPTIONAL_BY_TYPE[serviceType] : undefined
    return [...REQUIRED_QUESTIONS, ...(optional ? [optional] : []), COMMON_Q5]
  },

  getCurrentQuestion: () => {
    const questions = get().getQuestions()
    const { currentQuestionIndex, skippedAll } = get()
    if (skippedAll) return null
    return questions[currentQuestionIndex] ?? null
  },

  isComplete: () => {
    const { skippedAll, currentQuestionIndex } = get()
    if (skippedAll) return true
    return currentQuestionIndex >= get().getQuestions().length
  },

  reset: () =>
    set({ answers: {}, currentQuestionIndex: 0, serviceType: '', skippedAll: false }),
}))
