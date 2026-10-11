import { ConfirmModal } from '../common/ConfirmModal'
import { RenameProjectModal } from './RenameProjectModal'

interface ProjectActionModalsProps {
  renameTarget: { id: string; title: string } | null
  trashTarget: string | null
  onCloseRename: () => void
  onCloseTrash: () => void
  onConfirmRename: (newTitle: string) => void
  onConfirmTrash: () => void
}

export function ProjectActionModals({
  renameTarget,
  trashTarget,
  onCloseRename,
  onCloseTrash,
  onConfirmRename,
  onConfirmTrash,
}: ProjectActionModalsProps) {
  return (
    <>
      <RenameProjectModal
        isOpen={!!renameTarget}
        currentTitle={renameTarget?.title ?? ''}
        onClose={onCloseRename}
        onConfirm={onConfirmRename}
      />
      <ConfirmModal
        isOpen={!!trashTarget}
        title="프로젝트를 휴지통으로 이동"
        message="프로젝트가 휴지통으로 이동합니다. 30일 이내 복원할 수 있으며, 멤버의 접근이 즉시 중단됩니다."
        confirmLabel="휴지통으로 이동"
        danger
        onConfirm={onConfirmTrash}
        onCancel={onCloseTrash}
      />
    </>
  )
}
