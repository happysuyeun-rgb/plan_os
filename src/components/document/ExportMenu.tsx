import { useState, useRef, useEffect } from 'react'
import { Download, ChevronDown, Copy, FileArchive } from 'lucide-react'
import { Button } from '../common/Button'
import { cn } from '../../lib/utils'

interface ExportMenuProps {
  canExportMd: boolean
  canExportZip: boolean
  canCopyCursor: boolean
  isCursorTab: boolean
  onExportMd: () => void
  onExportZip: () => void
  onCopyCursor: () => void
}

export function ExportMenu({
  canExportMd,
  canExportZip,
  canCopyCursor,
  isCursorTab,
  onExportMd,
  onExportZip,
  onCopyCursor,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!canExportMd && !canExportZip) return null

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setOpen(!open)}>
        <Download className="h-4 w-4" />
        보내기
        <ChevronDown className={cn('h-3 w-3 transition', open && 'rotate-180')} />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {canExportMd && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
              onClick={() => {
                onExportMd()
                setOpen(false)
              }}
            >
              <Download className="h-4 w-4 text-gray-500" />
              현재 탭 Markdown
            </button>
          )}
          {canExportZip && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
              onClick={() => {
                onExportZip()
                setOpen(false)
              }}
            >
              <FileArchive className="h-4 w-4 text-gray-500" />
              프로젝트 ZIP (5종)
            </button>
          )}
          {isCursorTab && canCopyCursor && canExportMd && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
              onClick={() => {
                onCopyCursor()
                setOpen(false)
              }}
            >
              <Copy className="h-4 w-4 text-gray-500" />
              클립보드 복사
            </button>
          )}
        </div>
      )}
    </div>
  )
}
