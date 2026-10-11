import type { ReactNode } from 'react'

interface ProjectGridProps {
  children: ReactNode
}

export function ProjectGrid({ children }: ProjectGridProps) {
  return <div className="grid grid-cols-3 gap-4">{children}</div>
}
