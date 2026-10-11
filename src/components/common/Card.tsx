import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  dashed?: boolean
}

export function Card({ children, dashed, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-5 transition-colors',
        dashed ? 'border-dashed border-gray-300' : 'border-gray-200 hover:border-brand-200 hover:shadow-sm',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
