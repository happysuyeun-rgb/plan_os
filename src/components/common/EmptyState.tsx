import type { ReactNode } from 'react'
import emptyAnimation from '../../assets/animations/빈상태.json'
import { LottieAnimation } from './LottieAnimation'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  showAnimation?: boolean
}

export function EmptyState({ title, description, action, showAnimation = true }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16">
      {showAnimation && (
        <LottieAnimation animationData={emptyAnimation} loop className="mb-4 h-24 w-24" />
      )}
      <p className="text-gray-500">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
