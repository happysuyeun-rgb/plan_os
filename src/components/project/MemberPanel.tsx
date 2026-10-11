import { UserPlus, X, Trash2 } from 'lucide-react'
import type { MemberRole, ProjectMember } from '../../types'
import { MEMBER_ROLE_LABELS } from '../../types'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import { Badge } from '../common/Badge'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { cn } from '../../lib/utils'

interface MemberPanelProps {
  isOpen: boolean
  onClose: () => void
  members: ProjectMember[]
  isLoading: boolean
  canInvite: boolean
  canManageMembers: boolean
  memberLimit: number | 'unlimited'
  onInviteClick: () => void
  onRemoveMember: (memberId: string) => void
  onUpdateRole: (memberId: string, role: Exclude<MemberRole, 'owner'>, fromRole: MemberRole) => void
}

export function MemberPanel({
  isOpen,
  onClose,
  members,
  isLoading,
  canInvite,
  canManageMembers,
  memberLimit,
  onInviteClick,
  onRemoveMember,
  onUpdateRole,
}: MemberPanelProps) {
  const activeCount = members.length
  const limitLabel =
    memberLimit === 'unlimited' ? `${activeCount}명` : `${activeCount}/${memberLimit}명`

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="프로젝트 멤버" className="max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">멤버 {limitLabel}</p>
        {canInvite && (
          <Button className="px-3 py-1.5 text-xs" onClick={onInviteClick}>
            <UserPlus className="h-4 w-4" />
            멤버 초대
          </Button>
        )}
      </div>

      {!canInvite && canManageMembers && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          멤버 한도에 도달했습니다. Team 플랜으로 업그레이드하면 무제한 초대가 가능합니다.
        </p>
      )}

      {isLoading ? (
        <LoadingSpinner className="py-8" />
      ) : members.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">아직 멤버가 없습니다</p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5"
            >
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium',
                  member.role === 'owner'
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-gray-100 text-gray-600',
                )}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-gray-900">
                    {member.name}
                  </span>
                  {canManageMembers && member.role !== 'owner' ? (
                    <select
                      value={member.role}
                      onChange={(e) =>
                        onUpdateRole(
                          member.id,
                          e.target.value as Exclude<MemberRole, 'owner'>,
                          member.role,
                        )
                      }
                      className="h-7 rounded border border-gray-200 px-2 text-xs"
                    >
                      <option value="editor">{MEMBER_ROLE_LABELS.editor}</option>
                      <option value="viewer">{MEMBER_ROLE_LABELS.viewer}</option>
                    </select>
                  ) : (
                    <Badge variant={member.role === 'owner' ? 'brand' : 'muted'}>
                      {MEMBER_ROLE_LABELS[member.role]}
                    </Badge>
                  )}
                  {member.status === 'pending' && (
                    <Badge variant="muted">초대 대기</Badge>
                  )}
                </div>
                <p className="truncate text-xs text-gray-500">{member.email}</p>
              </div>
              {canManageMembers && member.role !== 'owner' && (
                <button
                  type="button"
                  onClick={() => onRemoveMember(member.id)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="멤버 제거"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
          닫기
        </Button>
      </div>
    </Modal>
  )
}
