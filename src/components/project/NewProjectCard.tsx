import { Plus } from 'lucide-react'
import { Card } from '../common/Card'

interface NewProjectCardProps {
  onClick: () => void
}

export function NewProjectCard({ onClick }: NewProjectCardProps) {
  return (
    <Card dashed className="flex cursor-pointer flex-col items-center justify-center py-12" onClick={onClick}>
      <Plus className="h-8 w-8 text-gray-300" />
      <p className="mt-2 text-sm text-gray-400">새 프로젝트</p>
    </Card>
  )
}
