import { useState } from 'react'
import type { MemberRole } from '../../types'
import { Modal } from '../common/Modal'
import { Input } from '../common/Input'
import { Select } from '../common/Select'
import { Button } from '../common/Button'

interface InviteMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onInvite: (email: string, role: Exclude<MemberRole, 'owner'>) => Promise<void>
}

export function InviteMemberModal({ isOpen, onClose, onInvite }: InviteMemberModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Exclude<MemberRole, 'owner'>>('editor')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleClose = () => {
    setEmail('')
    setRole('editor')
    setError('')
    onClose()
  }

  const handleSubmit = async () => {
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      setError('올바른 이메일을 입력해주세요')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      await onInvite(trimmed, role)
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '초대에 실패했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="멤버 초대">
      <p className="mb-4 text-sm text-gray-500">
        이메일로 프로젝트에 초대합니다. 초대된 멤버는 산출물을 함께 볼 수 있습니다.
      </p>
      <div className="space-y-4">
        <Input
          label="이메일"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@company.com"
          error={error}
        />
        <Select
          label="권한"
          value={role}
          onChange={(e) => setRole(e.target.value as Exclude<MemberRole, 'owner'>)}
          options={[
            { value: 'editor', label: '편집자 — 문서 수정·채팅 가능' },
            { value: 'viewer', label: '뷰어 — 읽기 전용' },
          ]}
        />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={handleClose}>
          취소
        </Button>
        <Button onClick={handleSubmit} isLoading={isSubmitting} disabled={!email.trim()}>
          초대 보내기
        </Button>
      </div>
    </Modal>
  )
}
