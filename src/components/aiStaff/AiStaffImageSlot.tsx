import { Bot } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/utils'

type Props = {
  src?: string
  alt: string
  /** square card art vs circular upcoming avatar */
  variant?: 'card' | 'hero' | 'avatar'
  className?: string
}

/**
 * Image slot for AI staff art. Until assets are provided, shows a soft placeholder.
 * When `src` 404s, falls back to the same placeholder (no broken icon).
 */
export function AiStaffImageSlot({ src, alt, variant = 'card', className }: Props) {
  const [failed, setFailed] = useState(false)
  const showImg = Boolean(src) && !failed

  const isHero = variant === 'hero'
  const shell =
    isHero
      ? 'aspect-square w-full max-w-[280px]'
      : variant === 'avatar'
        ? 'h-16 w-16 rounded-full'
        : 'aspect-square w-full max-w-[148px] rounded-2xl sm:max-w-[160px]'

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center',
        isHero
          ? 'overflow-visible bg-transparent'
          : 'overflow-hidden bg-gradient-to-br from-brand-50 via-violet-50 to-indigo-50 ring-1 ring-brand-100/80',
        shell,
        className,
      )}
      data-image-slot={variant}
      data-has-image={showImg ? 'true' : 'false'}
    >
      {showImg ? (
        <img
          src={src}
          alt={alt}
          className={
            variant === 'avatar'
              ? 'h-full w-full object-cover object-top'
              : isHero
                ? 'h-full w-full object-contain'
                : 'h-full w-full object-contain object-bottom p-1.5'
          }
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className={cn(
            'flex flex-col items-center gap-1 text-brand-600/70',
            isHero && 'rounded-[2rem] bg-gradient-to-br from-brand-50 via-violet-50 to-indigo-50 p-10',
          )}
          aria-hidden
        >
          <Bot className={variant === 'avatar' ? 'h-7 w-7' : 'h-10 w-10'} strokeWidth={1.5} />
          {variant !== 'avatar' && (
            <span className="text-[10px] font-medium tracking-wide text-brand-600/60">이미지 예정</span>
          )}
        </div>
      )}
    </div>
  )
}
