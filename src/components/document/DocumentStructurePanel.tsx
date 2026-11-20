import { cn } from '../../lib/utils'
import type { OutlineSection } from '../../lib/documentOutline'

interface DocumentStructurePanelProps {
  sections: OutlineSection[]
  activeIndex: number
  onSelect: (index: number) => void
}

export function DocumentStructurePanel({
  sections,
  activeIndex,
  onSelect,
}: DocumentStructurePanelProps) {
  return (
    <nav
      className="flex w-52 shrink-0 flex-col border-r border-slate-200 bg-slate-50"
      data-testid="document-structure-panel"
      aria-label="문서 구조"
    >
      <p className="border-b border-slate-200 px-3 py-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
        문서 구조
      </p>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {sections.map((section) => {
          const active = section.index === activeIndex
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onSelect(section.index)}
                className={cn(
                  'w-full px-2 py-1.5 text-left text-xs transition-colors',
                  active
                    ? 'font-bold text-violet-600'
                    : 'font-normal text-slate-600 hover:text-slate-900',
                )}
                data-testid={`document-structure-item-${section.index}`}
              >
                <span
                  className={cn(
                    'mr-1.5 text-[10px]',
                    active ? 'font-bold text-violet-600' : 'text-slate-400',
                  )}
                >
                  {String(section.index + 1).padStart(2, '0')}
                </span>
                <span className="line-clamp-2">{section.title}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-400">
        {activeIndex + 1} / {sections.length} 페이지
      </p>
    </nav>
  )
}
