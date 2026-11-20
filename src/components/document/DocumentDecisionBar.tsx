import { Check, X } from 'lucide-react'
import { Button } from '../common/Button'
import type { DocumentDecision } from '../../store/documentDecisionStore'
import { cn } from '../../lib/utils'

interface DocumentDecisionBarProps {
  decision: DocumentDecision
  canDecide: boolean
  onApprove: () => void
  onReject: () => void
  onReset?: () => void
}

const STATUS_LABEL: Record<DocumentDecision, string> = {
  pending: '검토 대기',
  approved: '승인됨',
  rejected: '거부됨',
}

export function DocumentDecisionBar({
  decision,
  canDecide,
  onApprove,
  onReject,
  onReset,
}: DocumentDecisionBarProps) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5"
      data-testid="document-decision-bar"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">이 문서 판정</span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-medium',
            decision === 'approved' && 'bg-emerald-50 text-emerald-700',
            decision === 'rejected' && 'bg-red-50 text-red-700',
            decision === 'pending' && 'bg-slate-100 text-slate-600',
          )}
          data-testid="document-decision-status"
        >
          {STATUS_LABEL[decision]}
        </span>
      </div>

      {canDecide ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="h-8 text-xs"
            onClick={onApprove}
            disabled={decision === 'approved'}
            data-testid="document-approve"
          >
            <Check className="h-3.5 w-3.5" />
            승인
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-8 text-xs text-red-700 hover:bg-red-50"
            onClick={onReject}
            disabled={decision === 'rejected'}
            data-testid="document-reject"
          >
            <X className="h-3.5 w-3.5" />
            거부
          </Button>
          {decision !== 'pending' && onReset && (
            <Button type="button" variant="ghost" className="h-8 text-xs" onClick={onReset}>
              대기로
            </Button>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">소유자만 승인·거부할 수 있습니다</p>
      )}
    </div>
  )
}
