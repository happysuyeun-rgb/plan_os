import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import type { DocumentType } from '../../types'
import { DOCUMENT_TYPE_LABELS } from '../../types'

interface RegenerateModalProps {
  isOpen: boolean
  docType: DocumentType
  onClose: () => void
  onRegenerateSingle: () => void
  onRegenerateCascade: () => void
}

const CASCADE_LABELS: Partial<Record<DocumentType, string>> = {
  prd: `${DOCUMENT_TYPE_LABELS.ia}, 화면목록, 정책서, 화면설계서, Cursor 프롬프트`,
  ia: '화면목록, 정책서, 화면설계서, Cursor 프롬프트',
  screen_list: '정책서, 화면설계서, Cursor 프롬프트',
  policy: '화면설계서, Cursor 프롬프트',
}

export function RegenerateModal({
  isOpen,
  docType,
  onClose,
  onRegenerateSingle,
  onRegenerateCascade,
}: RegenerateModalProps) {
  const cascadeHint = CASCADE_LABELS[docType]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="산출물 재생성">
      <p className="text-sm text-gray-600">
        <strong>{DOCUMENT_TYPE_LABELS[docType]}</strong>을(를) 다시 생성합니다.
        {cascadeHint && (
          <>
            <br />
            <br />
            나머지 산출물({cascadeHint})도 함께 다시 생성할 수 있습니다.
          </>
        )}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Button onClick={onRegenerateSingle}>
          {DOCUMENT_TYPE_LABELS[docType]}만 재생성
        </Button>
        {cascadeHint && (
          <Button variant="ghost" onClick={onRegenerateCascade}>
            연관 산출물 모두 재생성
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          취소
        </Button>
      </div>
    </Modal>
  )
}
