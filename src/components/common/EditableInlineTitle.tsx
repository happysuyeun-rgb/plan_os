import { useEffect, useRef, useState, type ElementType, type KeyboardEvent } from 'react'
import { Pencil } from 'lucide-react'
import { cn } from '../../lib/utils'

interface EditableInlineTitleProps {
  value: string
  canEdit?: boolean
  onSave: (value: string) => void | Promise<void>
  validate?: (value: string) => string | null
  maxLength?: number
  className?: string
  textClassName?: string
  inputClassName?: string
  as?: ElementType
  editAriaLabel?: string
  showPencil?: boolean
}

export function EditableInlineTitle({
  value,
  canEdit = false,
  onSave,
  validate,
  maxLength = 50,
  className,
  textClassName,
  inputClassName,
  as: TextTag = 'span',
  editAriaLabel = '제목 변경',
  showPencil = true,
}: EditableInlineTitleProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editing) {
      const input = inputRef.current
      input?.focus()
      input?.select()
    }
  }, [editing])

  const startEdit = () => {
    if (!canEdit) return
    setDraft(value)
    setError('')
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft(value)
    setError('')
    setEditing(false)
  }

  const commitEdit = async () => {
    const trimmed = draft.trim()
    const validationError = validate?.(trimmed) ?? null
    if (validationError) {
      setError(validationError)
      return
    }
    if (trimmed === value.trim()) {
      setEditing(false)
      return
    }
    await onSave(trimmed)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className={cn('min-w-0', className)}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commitEdit()
            if (e.key === 'Escape') cancelEdit()
          }}
          onBlur={() => void commitEdit()}
          onFocus={(e) => e.target.select()}
          maxLength={maxLength}
          className={cn(
            'w-full rounded-md border px-2 py-1 text-sm font-semibold text-gray-900 outline-none',
            error ? 'border-red-300 focus:border-red-500' : 'border-brand-300 focus:border-brand-500',
            inputClassName,
          )}
        />
        {error && <p className="mt-0.5 text-[10px] text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <TextTag
        className={cn(
          'truncate font-semibold text-gray-900',
          canEdit && 'cursor-text hover:text-brand-700',
          textClassName,
        )}
        title={value}
        onClick={startEdit}
        onKeyDown={(e: KeyboardEvent<HTMLElement>) => {
          if (canEdit && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            startEdit()
          }
        }}
        role={canEdit ? 'button' : undefined}
        tabIndex={canEdit ? 0 : undefined}
      >
        {value}
      </TextTag>
      {canEdit && showPencil && (
        <button
          type="button"
          onClick={startEdit}
          className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-brand-600"
          aria-label={editAriaLabel}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

function validateProjectTitle(value: string): string | null {
  if (value.length < 2) return '2자 이상 입력해주세요'
  if (value.length > 50) return '50자 이하로 입력해주세요'
  return null
}

interface EditableProjectTitleProps {
  title: string
  canEdit?: boolean
  onSave: (title: string) => void | Promise<void>
  className?: string
  titleClassName?: string
}

export function EditableProjectTitle({
  title,
  canEdit,
  onSave,
  className,
  titleClassName,
}: EditableProjectTitleProps) {
  return (
    <EditableInlineTitle
      value={title}
      canEdit={canEdit}
      onSave={onSave}
      validate={validateProjectTitle}
      maxLength={50}
      className={className}
      textClassName={cn('text-sm font-normal text-gray-700', titleClassName)}
      editAriaLabel="프로젝트 이름 변경"
    />
  )
}
