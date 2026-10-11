import { Check } from 'lucide-react'
import loadingAnimation from '../../assets/animations/생성-로딩.json'
import { DOCUMENT_TYPE_ORDER } from '../../lib/documentTypes'
import type { GenerationStep } from '../../lib/api/generation'
import { cn } from '../../lib/utils'
import { DOCUMENT_TYPE_LABELS } from '../../types'
import { LottieAnimation } from './LottieAnimation'

const STEPS: GenerationStep[] = DOCUMENT_TYPE_ORDER

interface LoadingStreamProps {
  currentStep: GenerationStep | null
  completedSteps: GenerationStep[]
  streamText: string
}

export function LoadingStream({ currentStep, completedSteps, streamText }: LoadingStreamProps) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mx-auto mb-4 flex justify-center">
        <LottieAnimation animationData={loadingAnimation} loop className="h-28 w-28" />
      </div>
      <h2 className="text-center text-lg font-semibold text-gray-900">산출물 생성 중...</h2>
      <div className="mt-6 space-y-3">
        {STEPS.map((step) => {
          const isDone = completedSteps.includes(step)
          const isCurrent = currentStep === step && !isDone

          return (
            <div
              key={step}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-4 py-3',
                isDone && 'border-green-200 bg-green-50',
                isCurrent && 'border-brand-200 bg-brand-50',
                !isDone && !isCurrent && 'border-gray-100 bg-gray-50 opacity-50',
              )}
            >
              <div
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                  isDone ? 'bg-green-500 text-white' : isCurrent ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500',
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : STEPS.indexOf(step) + 1}
              </div>
              <span className="text-sm font-medium">{DOCUMENT_TYPE_LABELS[step]}</span>
              {isCurrent && <span className="ml-auto text-xs text-brand-600">생성 중...</span>}
            </div>
          )
        })}
      </div>

      {streamText && (
        <div className="mt-6 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4">
          <pre className="whitespace-pre-wrap text-xs text-gray-700">{streamText}</pre>
        </div>
      )}
    </div>
  )
}
