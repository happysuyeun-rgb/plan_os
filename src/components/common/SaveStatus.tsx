import { Loader2, Check, AlertCircle } from 'lucide-react'

interface SaveStatusProps {
  status: 'saved' | 'saving' | 'error'
}

export function SaveStatus({ status }: SaveStatusProps) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-400">
        <Loader2 className="h-3 w-3 animate-spin" /> 저장 중...
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
