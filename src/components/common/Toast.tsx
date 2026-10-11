import { useEffect } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { cn } from '../../lib/utils'
import type { ToastType } from '../../types'
import { CompletionCheck } from './CompletionCheck'

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

const styles: Record<ToastType, string> = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
}

function ToastItem({
  id,
  type,
  message,
  animation,
}: {
  id: string
  type: ToastType
  message: string
  animation?: 'completion'
}) {
  const removeToast = useUIStore((s) => s.removeToast)
  const Icon = icons[type]
  const showCompletion = type === 'success' && animation === 'completion'

  useEffect(() => {
    const timer = setTimeout(() => removeToast(id), showCompletion ? 2500 : 3000)
    return () => clearTimeout(timer)
  }, [id, removeToast, showCompletion])

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg',
        styles[type],
        showCompletion && 'flex-col items-center text-center',
      )}
    >
      {showCompletion ? (
        <CompletionCheck className="h-14 w-14" />
      ) : (
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <p className={cn('flex-1 text-sm', showCompletion && 'flex-none')}>{message}</p>
      <button
        type="button"
        onClick={() => removeToast(id)}
        className="shrink-0 opacity-60 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} />
      ))}
    </div>
  )
}
