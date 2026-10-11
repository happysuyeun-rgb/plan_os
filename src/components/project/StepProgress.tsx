interface StepProgressProps {
  currentStep: number
  totalSteps?: number
}

export function StepProgress({ currentStep, totalSteps = 3 }: StepProgressProps) {
  return (
    <div className="mb-8 flex items-center gap-2">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              currentStep >= s ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}
          >
            {s}
          </div>
          {s < totalSteps && (
            <div className={`h-0.5 w-12 ${currentStep > s ? 'bg-brand-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}
