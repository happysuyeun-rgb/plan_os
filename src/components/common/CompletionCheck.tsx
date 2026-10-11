import completionAnimation from '../../assets/animations/완료-체크.json'
import { LottieAnimation } from './LottieAnimation'

interface CompletionCheckProps {
  className?: string
  onComplete?: () => void
}

export function CompletionCheck({ className = 'h-16 w-16', onComplete }: CompletionCheckProps) {
  return (
    <LottieAnimation
      animationData={completionAnimation}
      loop={false}
      className={className}
      onComplete={onComplete}
    />
  )
}
