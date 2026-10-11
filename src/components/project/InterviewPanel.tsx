import { useEffect } from 'react'
import { Button } from '../common/Button'
import { useInterviewStore } from '../../store/interviewStore'
import type { ServiceType } from '../../types'

interface InterviewPanelProps {
  onComplete: () => void
  onSkipAll?: () => void
  defaultServiceType?: ServiceType
}

function mapQ3ToServiceType(answer: string): ServiceType {
  if (answer.includes('모바일')) return '앱'
  if (answer.includes('SaaS')) return 'SaaS'
  return '웹'
}

export function InterviewPanel({
  onComplete,
  onSkipAll,
  defaultServiceType = '웹',
}: InterviewPanelProps) {
  const {
    getCurrentQuestion,
    getQuestions,
    currentQuestionIndex,
    isComplete,
    setAnswer,
    skipQuestion,
    skipAll,
    setServiceType,
    serviceType,
  } = useInterviewStore()

  useEffect(() => {
    if (!serviceType) {
      setServiceType(defaultServiceType)
    }
  }, [defaultServiceType, serviceType, setServiceType])

  const currentQuestion = getCurrentQuestion()
  const questions = getQuestions()

  const handleAnswer = (questionId: string, answer: string) => {
    if (questionId === 'q3') {
      setServiceType(mapQ3ToServiceType(answer))
    }
    setAnswer(questionId, answer)
    if (useInterviewStore.getState().isComplete()) {
      onComplete()
    }
  }

  const handleSkipAll = () => {
    skipAll()
    if (onSkipAll) {
      onSkipAll()
      return
    }
    onComplete()
  }

  if (isComplete()) {
    return (
      <p className="text-center text-sm text-green-600">인터뷰가 완료되었습니다</p>
    )
  }

  if (!currentQuestion) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">AI 인터뷰</h2>
        <span className="text-sm text-gray-400">
          {Math.min(currentQuestionIndex + 1, questions.length)}/{questions.length}
        </span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="font-medium text-gray-900">{currentQuestion.text}</p>
        {currentQuestion.type === 'radio' && currentQuestion.options ? (
          <div className="mt-4 space-y-2">
            {currentQuestion.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleAnswer(currentQuestion.id, opt)}
                className="block w-full rounded-lg border border-gray-200 px-4 py-2 text-left text-sm hover:border-brand-300 hover:bg-brand-50"
              >
                {opt}
              </button>
            ))}
          </div>
        ) : null}
        {!currentQuestion.required && (
          <Button
            variant="ghost"
            className="mt-3"
            onClick={() => {
              skipQuestion()
              if (useInterviewStore.getState().isComplete()) onComplete()
            }}
          >
            건너뛰기
          </Button>
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={handleSkipAll}>
          바로 생성하기
        </Button>
      </div>
    </div>
  )
}
