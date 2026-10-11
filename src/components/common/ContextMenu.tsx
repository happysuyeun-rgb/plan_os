import { useEffect, useRef } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface ContextMenuItem {
  id: string
  label: string
  icon?: 'edit' | 'delete'
  danger?: boolean
  onClick: () => void
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  onClose: () => void
  className?: string
}

const icons = {
  edit: Pencil,
  delete: Trash2,
}

export function ContextMenu({ items, onClose, className }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={ref}
      className={cn(
        'absolute right-2 top-2 z-10 min-w-[120px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg',
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon ? icons[item.icon] : null
        return (
          <button
            key={item.id}
            type="button"
            className={cn(
              'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50',
              item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700',
            )}
            onClick={() => {
              item.onClick()
              onClose()
            }}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
