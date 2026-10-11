import type { DocumentVersion } from '../../types'
import { cn } from '../../lib/utils'

interface VersionPillsProps {
  versions: DocumentVersion[]
  activeVersionId: string | null
  onSelect: (versionId: string | null) => void
}

export function VersionPills({ versions, activeVersionId, onSelect }: VersionPillsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
          activeVersionId === null
            ? 'bg-brand-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
        )}
      >
        현재
      </button>
      {versions.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onSelect(v.id)}
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
            activeVersionId === v.id
              ? 'bg-brand-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          )}
        >
          v{v.version_number}
          {v.version_name && ` (${v.version_name})`}
        </button>
      ))}
    </div>
  )
}
