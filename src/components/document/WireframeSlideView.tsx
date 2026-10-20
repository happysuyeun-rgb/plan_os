import { useCallback, useState } from 'react'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import type {
  WireframeComponent,
  WireframeInteraction,
  WireframeSlide,
} from '../../types'
import { parseWireframeContent, serializeWireframe } from '../../lib/documentContent'
import { useDebouncedSave } from '../../hooks/useDebouncedSave'
import { cn } from '../../lib/utils'

interface WireframeSlideViewProps {
  content: string
  onChange: (content: string) => void
  readOnly?: boolean
}

function newSlide(): WireframeSlide {
  const id = `slide-${Date.now()}`
  return {
    id,
    code: '',
    name: '새 화면',
    layout: '',
    components: [],
    interactions: [],
  }
}

function newComponent(): WireframeComponent {
  return { name: '', type: '', state: '-', description: '' }
}

function newInteraction(): WireframeInteraction {
  return { condition: '', action: '' }
}

export function WireframeSlideView({ content, onChange, readOnly }: WireframeSlideViewProps) {
  const [slides, setSlides] = useState<WireframeSlide[]>(() => {
    return parseWireframeContent(content) ?? []
  })
  const [activeId, setActiveId] = useState<string | null>(() => slides[0]?.id ?? null)
  const [dragId, setDragId] = useState<string | null>(null)

  const [previousContent, setPreviousContent] = useState(content)
  if (previousContent !== content) {
    setPreviousContent(content)
    const parsed = parseWireframeContent(content)
    if (parsed) {
      setSlides(parsed)
      setActiveId((prev) =>
        parsed.some((s) => s.id === prev) ? prev : (parsed[0]?.id ?? null),
      )
    }
  }

  const persist = useCallback(
    (next: WireframeSlide[]) => {
      onChange(serializeWireframe(next))
    },
    [onChange],
  )

  const scheduleSave = useDebouncedSave(persist, 1000)

  const updateSlides = (next: WireframeSlide[]) => {
    setSlides(next)
    scheduleSave(next)
  }

  const activeSlide = slides.find((s) => s.id === activeId) ?? slides[0]

  const updateActive = (patch: Partial<WireframeSlide>) => {
    if (!activeSlide) return
    updateSlides(slides.map((s) => (s.id === activeSlide.id ? { ...s, ...patch } : s)))
  }

  const addSlide = () => {
    const slide = newSlide()
    updateSlides([...slides, slide])
    setActiveId(slide.id)
  }

  const removeSlide = (id: string) => {
    const next = slides.filter((s) => s.id !== id)
    updateSlides(next)
    if (activeId === id) setActiveId(next[0]?.id ?? null)
  }

  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return
    const fromIdx = slides.findIndex((s) => s.id === fromId)
    const toIdx = slides.findIndex((s) => s.id === toId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = [...slides]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    updateSlides(next)
  }

  if (!activeSlide) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
        {readOnly ? '화면설계서가 비어 있습니다' : (
          <button type="button" onClick={addSlide} className="text-brand-600 hover:underline">
            + 화면 추가
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-200px)] gap-4 rounded-lg border border-gray-200 bg-white">
      {/* 좌측 썸네일 */}
      <aside className="flex w-[200px] shrink-0 flex-col border-r border-gray-100">
        <div className="flex-1 overflow-y-auto p-2">
          {slides.map((slide) => (
            <div
              key={slide.id}
              draggable={!readOnly}
              onDragStart={() => setDragId(slide.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) reorder(dragId, slide.id)
                setDragId(null)
              }}
              onDragEnd={() => setDragId(null)}
              className={cn(
                'mb-1 flex cursor-pointer items-start gap-1 rounded-lg px-2 py-2 text-left text-sm transition-colors',
                activeSlide.id === slide.id
                  ? 'bg-brand-100 font-medium text-brand-800'
                  : 'text-gray-700 hover:bg-gray-50',
              )}
              onClick={() => setActiveId(slide.id)}
            >
              {!readOnly && (
                <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
              )}
              <div className="min-w-0">
                <p className="truncate text-xs text-gray-500">{slide.code || '—'}</p>
                <p className="truncate">{slide.name}</p>
              </div>
            </div>
          ))}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={addSlide}
            className="flex items-center justify-center gap-1 border-t border-gray-100 py-3 text-xs text-gray-600 hover:bg-brand-50 hover:text-brand-700"
          >
            <Plus className="h-3.5 w-3.5" />
            화면 추가
          </button>
        )}
      </aside>

      {/* 우측 상세 */}
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {readOnly ? (
                activeSlide.code || '—'
              ) : (
                <input
                  className="w-28 bg-transparent outline-none"
                  value={activeSlide.code}
                  onChange={(e) => updateActive({ code: e.target.value })}
                  placeholder="화면코드"
                />
              )}
            </span>
            {readOnly ? (
              <h2 className="mt-2 text-xl font-semibold text-gray-900">{activeSlide.name}</h2>
            ) : (
              <input
                className="mt-2 w-full text-xl font-semibold text-gray-900 outline-none focus:border-b focus:border-brand-500"
                value={activeSlide.name}
                onChange={(e) => updateActive({ name: e.target.value })}
                placeholder="화면명"
              />
            )}
          </div>
          {!readOnly && slides.length > 1 && (
            <button
              type="button"
              onClick={() => removeSlide(activeSlide.id)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </button>
          )}
        </div>

        <section className="mb-8">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">레이아웃 설명</h3>
          {readOnly ? (
            <p className="whitespace-pre-wrap text-sm text-gray-700">{activeSlide.layout}</p>
          ) : (
            <textarea
              className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              rows={3}
              value={activeSlide.layout}
              onChange={(e) => updateActive({ layout: e.target.value })}
              placeholder="레이아웃 구성을 설명하세요"
            />
          )}
        </section>

        <MiniTableSection
          title="컴포넌트"
          readOnly={readOnly}
          columns={['컴포넌트명', '타입', '상태', '설명']}
          rows={activeSlide.components.map((c) => [c.name, c.type, c.state, c.description])}
          onChange={(rows) =>
            updateActive({
              components: rows.map(([name, type, state, description]) => ({
                name,
                type,
                state,
                description,
              })),
            })
          }
          onAdd={() =>
            updateActive({ components: [...activeSlide.components, newComponent()] })
          }
          onRemove={(i) =>
            updateActive({
              components: activeSlide.components.filter((_, idx) => idx !== i),
            })
          }
        />

        <MiniTableSection
          title="인터랙션 정책"
          readOnly={readOnly}
          columns={['조건', '처리']}
          rows={activeSlide.interactions.map((i) => [i.condition, i.action])}
          onChange={(rows) =>
            updateActive({
              interactions: rows.map(([condition, action]) => ({ condition, action })),
            })
          }
          onAdd={() =>
            updateActive({
              interactions: [...activeSlide.interactions, newInteraction()],
            })
          }
          onRemove={(i) =>
            updateActive({
              interactions: activeSlide.interactions.filter((_, idx) => idx !== i),
            })
          }
        />
      </div>
    </div>
  )
}

interface MiniTableSectionProps {
  title: string
  columns: string[]
  rows: string[][]
  readOnly?: boolean
  onChange: (rows: string[][]) => void
  onAdd: () => void
  onRemove: (index: number) => void
}

function MiniTableSection({
  title,
  columns,
  rows,
  readOnly,
  onChange,
  onAdd,
  onRemove,
}: MiniTableSectionProps) {
  const updateCell = (rowIdx: number, colIdx: number, value: string) => {
    const next = rows.map((row, ri) =>
      ri === rowIdx ? row.map((cell, ci) => (ci === colIdx ? value : cell)) : row,
    )
    onChange(next)
  }

  return (
    <section className="mb-8">
      <h3 className="mb-2 text-sm font-semibold text-gray-900">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
              {columns.map((col) => (
                <th key={col} className="px-3 py-2">
                  {col}
                </th>
              ))}
              {!readOnly && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="group border-t border-gray-100 hover:bg-purple-50">
                {row.map((cell, colIdx) => (
                  <td key={colIdx} className="px-1 py-1">
                    {readOnly ? (
                      <span className="block px-2 py-1 text-gray-800">{cell}</span>
                    ) : (
                      <input
                        className="w-full rounded px-2 py-1 outline-none focus:ring-1 focus:ring-brand-500"
                        value={cell}
                        onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                      />
                    )}
                  </td>
                ))}
                {!readOnly && (
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => onRemove(rowIdx)}
                      className="rounded p-1 text-gray-300 opacity-0 hover:text-red-600 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!readOnly && (
          <button
            type="button"
            onClick={onAdd}
            className="flex w-full items-center justify-center gap-1 border-t border-gray-100 py-2 text-xs text-gray-500 hover:bg-purple-50"
          >
            <Plus className="h-3.5 w-3.5" />
            행 추가
          </button>
        )}
      </div>
    </section>
  )
}
