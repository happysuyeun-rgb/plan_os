import { useState } from 'react'
import { Link2, Mail } from 'lucide-react'
import type { MemberRole } from '../../types'
import { buildProjectInviteLink } from '../../lib/inviteLink'
import { Modal } from '../common/Modal'
import { Input } from '../common/Input'
import { Select } from '../common/Select'
import { Button } from '../common/Button'
import { cn } from '../../lib/utils'

type InviteTab = 'email' | 'link'

export type InviteProjectOption = {
  id: string
  title: string
}

interface InviteMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onInvite: (
    projectId: string,
    email: string,
    role: Exclude<MemberRole, 'owner'>,
  ) => Promise<void>
  /** 단일 프로젝트(문서 화면) — 생략 시 projects에서 선택 */
  projectId?: string
  projects?: InviteProjectOption[]
}

export function InviteMemberModal({
  isOpen,
  onClose,
  onInvite,
  projectId,
  projects,
}: InviteMemberModalProps) {
  const needsProjectPick = !projectId
  const [tab, setTab] = useState<InviteTab>('email')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Exclude<MemberRole, 'owner'>>('editor')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const resolvedProjectId =
    projectId || selectedProjectId || projects?.[0]?.id || ''

  const resetForm = () => {
    setTab('email')
    setSelectedProjectId(null)
    setEmail('')
    setRole('editor')
    setError('')
    setLinkCopied(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmitEmail = async () => {
    if (!resolvedProjectId) {
      setError('초대할 프로젝트를 선택해주세요')
      return
    }
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      setError('올바른 이메일을 입력해주세요')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      await onInvite(resolvedProjectId, trimmed, role)
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '초대에 실패했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyLink = async () => {
    if (!resolvedProjectId) {
      setError('초대할 프로젝트를 선택해주세요')
      return
    }
    setError('')
    const link = buildProjectInviteLink(resolvedProjectId, role)
    try {
      await navigator.clipboard.writeText(link)
      setLinkCopied(true)
    } catch {
      setError('링크 복사에 실패했습니다. 아래 주소를 직접 복사해주세요.')
    }
  }

  const inviteLink = resolvedProjectId
    ? buildProjectInviteLink(resolvedProjectId, role)
    : ''

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="멤버 초대">
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1" role="tablist">
        {(
          [
            { id: 'email' as const, label: '이메일', icon: Mail },
            { id: 'link' as const, label: '초대 링크', icon: Link2 },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id)
              setError('')
              setLinkCopied(false)
            }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium',
              tab === id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900',
            )}
            data-testid={`invite-tab-${id}`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {needsProjectPick && (
          <Select
            label="프로젝트"
            value={resolvedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value)
              setLinkCopied(false)
            }}
            options={(projects ?? []).map((p) => ({
              value: p.id,
              label: p.title,
            }))}
            data-testid="invite-project-select"
          />
        )}

        <Select
          label="권한"
          value={role}
          onChange={(e) => {
            setRole(e.target.value as Exclude<MemberRole, 'owner'>)
            setLinkCopied(false)
          }}
          options={[
            { value: 'editor', label: '편집자 — 문서 수정·채팅 가능' },
            { value: 'viewer', label: '뷰어 — 읽기 전용' },
          ]}
        />

        {tab === 'email' ? (
          <>
            <p className="text-sm text-gray-500">
              이메일로 초대합니다. 실제 메일 발송은 mock이며, 초대 대기 멤버로 기록됩니다.
            </p>
            <Input
              label="이메일"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              error={error || undefined}
              data-testid="invite-email-input"
            />
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              링크를 공유하면 로그인 후 해당 프로젝트로 이동합니다. 수락 API는 아직 없습니다.
            </p>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">초대 링크</label>
              <input
                readOnly
                value={inviteLink}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                data-testid="invite-link-value"
              />
              {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
              {linkCopied && !error && (
                <p className="mt-1 text-xs text-brand-700" data-testid="invite-link-copied">
                  클립보드에 복사되었습니다
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={handleClose}>
          취소
        </Button>
        {tab === 'email' ? (
          <Button
            onClick={handleSubmitEmail}
            isLoading={isSubmitting}
            disabled={!email.trim() || !resolvedProjectId}
            data-testid="invite-email-submit"
          >
            초대 보내기
          </Button>
        ) : (
          <Button
            onClick={() => void handleCopyLink()}
            disabled={!resolvedProjectId}
            data-testid="invite-link-copy"
          >
            링크 복사
          </Button>
        )}
      </div>
    </Modal>
  )
}
