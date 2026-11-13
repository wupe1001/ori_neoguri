import { cn } from './cn'

// 질문 진행 상태: 접수 → 전달됨 → 답변 완료
export type QuestionStatus = 'received' | 'forwarded' | 'answered'

const statusStyle: Record<QuestionStatus, { label: string; className: string }> = {
  received: { label: '접수', className: 'bg-page text-muted border border-line' },
  forwarded: { label: '전달됨', className: 'bg-warning-soft text-warning' },
  answered: { label: '답변 완료', className: 'bg-success-soft text-success' },
}

export default function StatusBadge({ status }: { status: QuestionStatus }) {
  const { label, className } = statusStyle[status]
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-caption font-semibold', className)}>
      {label}
    </span>
  )
}
