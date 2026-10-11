import { validateChatTitle } from '../../lib/chatTitle'
import { EditableInlineTitle } from '../common/EditableInlineTitle'

interface EditableChatTitleProps {
  title: string
  canEdit?: boolean
  onSave: (title: string) => void | Promise<void>
  className?: string
}

export function EditableChatTitle({
  title,
  canEdit = false,
  onSave,
  className,
}: EditableChatTitleProps) {
  return (
    <EditableInlineTitle
      value={title}
      canEdit={canEdit}
      onSave={onSave}
      validate={validateChatTitle}
      maxLength={40}
      as="h3"
      className={className}
      textClassName="text-sm"
      editAriaLabel="채팅 제목 변경"
    />
  )
}
