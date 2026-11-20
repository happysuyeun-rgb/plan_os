import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface DocumentPaperFrameProps {
  children: ReactNode
  className?: string
}

/** A4-width centered white paper for document body only. */
export function DocumentPaperFrame({ children, className }: DocumentPaperFrameProps) {
  return (
    <div
      className={cn(
        'flex min-h-full justify-center bg-slate-100/90 px-3 py-6 sm:px-6',
        className,
      )}
      data-testid="document-paper-canvas"
    >
      <div
        className="w-full max-w-[210mm] min-h-[297mm] bg-white px-8 py-10 shadow-sm ring-1 ring-slate-200/80 sm:px-12 sm:py-12"
        data-testid="document-paper-sheet"
      >
        {children}
      </div>
    </div>
  )
}
