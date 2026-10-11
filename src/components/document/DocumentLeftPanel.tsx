import type { ReactNode } from 'react'

interface DocumentLeftPanelProps {
  canChat: boolean
  chatPanel?: ReactNode
}

export function DocumentLeftPanel({ canChat, chatPanel }: DocumentLeftPanelProps) {
  if (!canChat || !chatPanel) return null
  return <div className="flex shrink-0">{chatPanel}</div>
}
