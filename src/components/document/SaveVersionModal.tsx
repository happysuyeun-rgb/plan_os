import { useState } from 'react'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import { Input } from '../common/Input'

interface SaveVersionModalProps {
  isOpen: boolean
  defaultName?: string
  onClose: () => void
  onConfirm: (name: string | undefined) => void
}

export function SaveVersionModal({
  isOpen,
  defaultName,
  onClose,
  onConfirm,
}: SaveVersionModalProps) {
  if (!isOpen) return null

  return <SaveVersionModalContent key={defaultName ?? ''} defaultName={defaultName} onClose={onClose} onConfirm={onConfirm} />
}

function SaveVersionModalContent({ defaultName, onClose, onConfirm }: Omit<SaveVersionModalProps, 'isOpen'>) {
  const [name, setName] = useState(defaultName ?? '')

  const handleConfirm = () => {
    const trimmed = name.trim()
    onConfirm(trimmed || undefined)
  }

  return (
    <Modal isOpen onClose={onClose} title="버전 저장">
      <p className="text-sm text-gray-500">
        버전 이름을 입력하세요. 비워두면 자동으로 번호가 부여됩니다.
      </p>
      <div className="mt-4">
        <Input
          label="버전 이름 (선택)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          showCount
          placeholder="예: v1.0 최종 검토"
        />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          취소
        </Button>
        <Button onClick={handleConfirm}>저장</Button>
      </div>
    </Modal>
  )
}
