import type { MemberAvatarPerson } from '../../lib/memberAvatars'
import { cn } from '../../lib/utils'

export type { MemberAvatarPerson }

interface MemberAvatarStackProps {
  members: MemberAvatarPerson[]
  max?: number
  size?: 'sm' | 'md'
  className?: string
  onClick?: (e: React.MouseEvent) => void
}

function initialOf(name: string): string {
  return (name.trim().charAt(0) || '?').toUpperCase()
}

export function MemberAvatarStack({
  members,
  max = 4,
  size = 'sm',
  className,
  onClick,
}: MemberAvatarStackProps) {
  if (members.length === 0) return null

  const visible = members.slice(0, max)
  const overflow = members.length - visible.length
  const dim = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-8 w-8 text-xs'

  return (
    <div
      className={cn('flex items-center', className)}
      data-testid="member-avatar-stack"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <ul className="flex items-center -space-x-2">
        {visible.map((member) => {
          const pending = member.status === 'pending'
          return (
            <li key={member.id} className="relative">
              <span
                title={`${member.name}${pending ? ' (초대 진행 중)' : ' (활성)'}`}
                className={cn(
                  'flex items-center justify-center rounded-full font-medium ring-2 ring-white',
                  dim,
                  pending
                    ? 'border border-dashed border-amber-400 bg-amber-50 text-amber-800'
                    : 'bg-brand-100 text-brand-700',
                )}
                data-testid={pending ? 'member-avatar-pending' : 'member-avatar-active'}
                data-status={member.status}
              >
                {initialOf(member.name)}
              </span>
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white',
                  pending ? 'bg-amber-400' : 'bg-emerald-500',
                )}
                aria-hidden
              />
            </li>
          )
        })}
      </ul>
      {overflow > 0 && (
        <span className="ml-1 text-xs font-medium text-gray-500">+{overflow}</span>
      )}
    </div>
  )
}
