import { Loader2, Check, AlertCircle, AlertTriangle } from 'lucide-react'
import type { DocumentSaveStatus } from '../../lib/documentAutosave'

interface SaveStatusProps {
  status: DocumentSaveStatus
}

export function SaveStatus({ status }: SaveStatusProps) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-400">
        <Loader2 className="h-3 w-3 animate-spin" /> 저장 중...
      </span>
    )
  }
  if (status === 'conflict') {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600">
        <AlertTriangle className="h-3 w-3" /> 충돌: 최신 문서 확인 필요
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 text-xs text-red-500">
        <AlertCircle className="h-3 w-3" /> 저장 실패
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-green-600">
      <Check className="h-3 w-3" /> 저장됨
    </span>
  )
}
