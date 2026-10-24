import { useCallback, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { ScreenListRow } from '../../types'
import { parseScreenListContent, serializeScreenList } from '../../lib/documentContent'
import { useDebouncedSave } from '../../hooks/useDebouncedSave'
import { cn } from '../../lib/utils'

const EMPTY_ROW = (): ScreenListRow => ({
  code: '',
  name: '',
  entryPath: '',
  mainFeature: '',
  authRequired: false,
  notes: '',
})

type EditableField = keyof Omit<ScreenListRow, 'authRequired'>

interface ScreenListTableProps {
  content: string
  onChange: (content: string) => void
  readOnly?: boolean
}

const GRID_COLS =
  'grid-cols-[120px_160px_200px_220px_80px_minmax(0,1fr)_32px]'

export function ScreenListTable({ content, onChange, readOnly }: ScreenListTableProps) {
  const [rows, setRows] = useState<ScreenListRow[]>(() => {
    return parseScreenListContent(content) ?? []
  })
  const [editing, setEditing] = useState<{ row: number; field: EditableField } | null>(null)

  const [previousContent, setPreviousContent] = useState(content)
  if (previousContent !== content) {
    setPreviousContent(content)
    const parsed = parseScreenListContent(content)
    if (parsed) setRows(parsed)
  }

  const persist = useCallback(
    (next: ScreenListRow[]) => {
      onChange(serializeScreenList(next))
    },
    [onChange],
  )

  const scheduleSave = useDebouncedSave(persist, 1000)

  const updateRows = (next: ScreenListRow[]) => {
    setRows(next)
    scheduleSave(next)
  }

  const updateCell = (rowIndex: number, field: EditableField, value: string) => {
    const next = rows.map((row, i) =>
      i === rowIndex ? { ...row, [field]: value } : row,
    )
    updateRows(next)
  }

  const toggleAuth = (rowIndex: number) => {
    const next = rows.map((row, i) =>
      i === rowIndex ? { ...row, authRequired: !row.authRequired } : row,
    )
    updateRows(next)
  }

  const addRow = () => {
    updateRows([...rows, EMPTY_ROW()])
  }

  const removeRow = (rowIndex: number) => {
    updateRows(rows.filter((_, i) => i !== rowIndex))
  }

  const commitEdit = () => setEditing(null)

  const renderCell = (rowIndex: number, field: EditableField, value: string) => {
    const isEditing = editing?.row === rowIndex && editing.field === field

    if (readOnly || !isEditing) {
      return (
        <div
          className={cn(
            'truncate px-2 py-2 text-sm text-gray-800',
            !readOnly && 'cursor-text hover:bg-purple-50/50',
          )}
          onClick={() => !readOnly && setEditing({ row: rowIndex, field })}
        >
          {value || <span className="text-gray-300">—</span>}
        </div>
      )
    }

    return (
      <input
        autoFocus
        className="w-full border-0 bg-white px-2 py-2 text-sm outline-none ring-2 ring-brand-500 ring-inset"
        value={value}
        onChange={(e) => updateCell(rowIndex, field, e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <div className={cn('grid min-w-[900px]', GRID_COLS)}>
        <div className="contents text-xs font-semibold text-gray-600">
          {['화면코드', '화면명', '진입경로', '주요기능', '인증필요', '비고', ''].map(
            (label, i) => (
              <div
                key={label || 'actions'}
                className={cn(
                  'border-b border-gray-200 bg-gray-50 px-2 py-2.5',
                  i === 6 && 'border-b border-gray-200',
                )}
              >
                {label}
              </div>
            ),
          )}
        </div>

        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="group contents">
            <div className="border-b border-gray-100 group-hover:bg-purple-50">
              {renderCell(rowIndex, 'code', row.code)}
            </div>
            <div className="border-b border-gray-100 group-hover:bg-purple-50">
              {renderCell(rowIndex, 'name', row.name)}
            </div>
            <div className="border-b border-gray-100 group-hover:bg-purple-50">
              {renderCell(rowIndex, 'entryPath', row.entryPath)}
            </div>
            <div className="border-b border-gray-100 group-hover:bg-purple-50">
              {renderCell(rowIndex, 'mainFeature', row.mainFeature)}
            </div>
            <div className="flex items-center justify-center border-b border-gray-100 px-2 py-2 group-hover:bg-purple-50">
              <input
                type="checkbox"
                checked={row.authRequired}
                disabled={readOnly}
                onChange={() => toggleAuth(rowIndex)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
            </div>
            <div className="border-b border-gray-100 group-hover:bg-purple-50">
              {renderCell(rowIndex, 'notes', row.notes)}
            </div>
            <div className="flex items-center justify-center border-b border-gray-100 group-hover:bg-purple-50">
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeRow(rowIndex)}
                  className="rounded p-1 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                  aria-label="행 삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={addRow}
          className="flex w-full items-center justify-center gap-1 border-t border-gray-200 py-3 text-sm text-gray-600 hover:bg-purple-50 hover:text-brand-700"
        >
          <Plus className="h-4 w-4" />
          화면 추가
        </button>
      )}
    </div>
  )
}
