import type { HTMLAttributes } from 'react'
import { cn } from './cn'

type Props = HTMLAttributes<HTMLDivElement> & {
  // 카드 위쪽 작은 제목 (예: "AI 답 초안")
  title?: string
}

export default function Card({ title, className, children, ...rest }: Props) {
  return (
    <div
      className={cn('rounded-2xl border border-line bg-surface p-4', className)}
      {...rest}
    >
      {title && <h2 className="mb-2 text-caption font-semibold text-muted">{title}</h2>}
      {children}
    </div>
  )
}
