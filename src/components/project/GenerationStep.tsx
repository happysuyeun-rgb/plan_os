import type { GenerationStep as GenStep } from '../../lib/api/generation'
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
}

export function GenerationStep({
  currentStep,
  completedSteps,
  streamText,
  isGenerating,
  error,
  onCancel,
  showCancel = true,
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
      {!isGenerating && completedSteps.length > 0 && completedSteps.length < TOTAL_STEPS && (
        <p className="mt-4 text-center text-sm text-amber-600">
          {completedSteps.length}개 산출물까지 저장되었습니다
        </p>
      )}
      {!isGenerating && completedSteps.length === TOTAL_STEPS && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <CompletionCheck className="h-20 w-20" />
          <p className="text-sm font-medium text-green-600">생성 완료!</p>
        </div>
      )}
    </div>
  )
}
