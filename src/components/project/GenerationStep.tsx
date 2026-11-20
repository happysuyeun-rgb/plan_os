import type { GenerationStep as GenStep } from '../../lib/api/generation'
import { DOCUMENT_TYPE_LABELS } from '../../types'
import { DOCUMENT_TYPE_ORDER } from '../../lib/documentTypes'
import { Button } from '../common/Button'
import { CompletionCheck } from '../common/CompletionCheck'
import { LoadingStream } from '../common/LoadingStream'

const TOTAL_STEPS = DOCUMENT_TYPE_ORDER.length

interface GenerationStepProps {
  currentStep: GenStep | null
  completedSteps: GenStep[]
  streamText: string
  isGenerating: boolean
  error?: string | null
  onCancel?: () => void
  showCancel?: boolean
  /** Guided pipeline: waiting for user to continue */
  awaitingContinue?: boolean
  nextStep?: GenStep | null
  onContinue?: () => void
  onPause?: () => void
}

export function GenerationStep({
  currentStep,
  completedSteps,
  streamText,
  isGenerating,
  error,
  onCancel,
  showCancel = true,
  awaitingContinue = false,
  nextStep = null,
  onContinue,
  onPause,
}: GenerationStepProps) {
  return (
    <div className="py-12">
      <LoadingStream
        currentStep={currentStep}
        completedSteps={completedSteps}
        streamText={streamText}
      />
      {error && !isGenerating && completedSteps.length === 0 && (
        <p className="mt-4 text-center text-sm text-red-600">{error}</p>
      )}
      {showCancel && isGenerating && onCancel && (
        <div className="mt-6 flex justify-center">
          <Button variant="ghost" onClick={onCancel}>
            취소 (생성된 것까지 저장)
          </Button>
        </div>
      )}
      {awaitingContinue && nextStep && (
        <div
          className="mt-6 flex flex-col items-center gap-3"
          data-testid="guest-pipeline-continue"
        >
          <p className="text-center text-sm text-slate-700">
            다음으로 {DOCUMENT_TYPE_LABELS[nextStep]}을(를) 작성할까요?
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={onContinue} disabled={isGenerating}>
              진행해줘
            </Button>
            <Button type="button" variant="ghost" onClick={onPause} disabled={isGenerating}>
              아직 / 미리보기
            </Button>
          </div>
        </div>
      )}
      {!isGenerating &&
        !awaitingContinue &&
        completedSteps.length > 0 &&
        completedSteps.length < TOTAL_STEPS && (
          <p className="mt-4 text-center text-sm text-amber-600">
            {completedSteps.length}개 산출물까지 저장되었습니다
          </p>
        )}
      {!isGenerating && !awaitingContinue && completedSteps.length === TOTAL_STEPS && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <CompletionCheck className="h-20 w-20" />
          <p className="text-sm font-medium text-green-600">생성 완료!</p>
        </div>
      )}
    </div>
  )
}
