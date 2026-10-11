import { useNavigate } from 'react-router-dom'
import { Modal } from './Modal'
import { Button } from './Button'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  message?: string
}

export function LoginModal({
  isOpen,
  onClose,
  message = '결과를 저장하려면 로그인이 필요합니다. 로그인 후 자동으로 저장됩니다.',
}: LoginModalProps) {
  const navigate = useNavigate()

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="로그인 필요">
      <p className="text-sm text-gray-600">{message}</p>
      <Button
        className="mt-4 w-full"
        onClick={() => {
          onClose()
          navigate('/login?redirect=/dashboard')
        }}
      >
        로그인하기
      </Button>
    </Modal>
  )
}
