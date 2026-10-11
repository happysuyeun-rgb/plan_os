import { useState } from 'react'
import { logProjectActivity } from '../lib/api/activities'
import { useProjectStore } from '../store/projectStore'
import { useUIStore } from '../store/uiStore'

export function useProjectActions() {
  const showToast = useUIStore((s) => s.showToast)
  const { updateProject, trashProject } = useProjectStore()

  const [contextMenu, setContextMenu] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null)
  const [trashTarget, setTrashTarget] = useState<string | null>(null)

  const handleRename = async (newTitle: string) => {
    if (!renameTarget) return
    const trimmed = newTitle.trim()
    if (trimmed === renameTarget.title) {
      setRenameTarget(null)
      return
    }
    const from = renameTarget.title
    await updateProject(renameTarget.id, { title: trimmed })
    await logProjectActivity({
      project_id: renameTarget.id,
      action: 'project_rename',
      meta: { from, to: trimmed },
    })
    showToast('success', '프로젝트 이름이 변경되었습니다')
    setRenameTarget(null)
  }

  const handleTrash = async () => {
    if (!trashTarget) return
    try {
      await trashProject(trashTarget)
      showToast('success', '프로젝트가 휴지통으로 이동했습니다')
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '휴지통 이동에 실패했습니다')
    }
    setTrashTarget(null)
  }

  return {
    contextMenu,
    setContextMenu,
    renameTarget,
    setRenameTarget,
    trashTarget,
    setTrashTarget,
    handleRename,
    handleTrash,
    /** @deprecated trashTarget 사용 */
    deleteTarget: trashTarget,
    setDeleteTarget: setTrashTarget,
    handleDelete: handleTrash,
  }
}
