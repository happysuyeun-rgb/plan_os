import LottieImport, { type LottieRefCurrentProps } from 'lottie-react'
import { useRef } from 'react'
import { cn } from '../../lib/utils'

const Lottie =
  typeof LottieImport === 'function'
    ? LottieImport
    : (LottieImport as { default: typeof LottieImport }).default

interface LottieAnimationProps {
  animationData: object
  loop?: boolean
  autoplay?: boolean
  className?: string
  onComplete?: () => void
}

export function LottieAnimation({
  animationData,
  loop = true,
  autoplay = true,
  className,
  onComplete,
}: LottieAnimationProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null)

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={animationData}
      loop={loop}
      autoplay={autoplay}
      onComplete={onComplete}
      className={cn('pointer-events-none', className)}
    />
  )
}
