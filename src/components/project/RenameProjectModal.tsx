import { useState, useEffect } from 'react'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import { Input } from '../common/Input'

interface RenameProjectModalProps {
  isOpen: boolean
  currentTitle: string
  onClose: () => void
  onConfirm: (newTitle: string) => void
}

export function RenameProjectModal({
  isOpen,
  currentTitle,
  onClose,
  onConfirm,
}: RenameProjectModalProps) {
  const [title, setTitle] = useState(currentTitle)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setTitle(currentTitle)
      setError('')
    }
  }, [isOpen, currentTitle])

  const handleConfirm = () => {
    if (title.length < 2) {
      setError('2자 이상 입력해주세요')
      return
    }
    if (title.length > 50) {
      setError('50자 이하로 입력해주세요')
      return
    }
    onConfirm(title)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="프로젝트 이름 변경">
      <Input
        label="프로젝트명"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={50}
        showCount
        error={error}
      />
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          취소
        </Button>
        <Button onClick={handleConfirm} disabled={title.length < 2}>
          저장
        </Button>
      </div>
    </Modal>
  )
}
