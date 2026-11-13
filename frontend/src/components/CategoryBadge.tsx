import type { QuestionCategory } from '../types/question'
import { cn } from './cn'

const categoryClass: Record<QuestionCategory, string> = {
  교과: 'bg-primary-50 text-primary-700',
  수행평가: 'bg-primary-50 text-primary-700',
  생활: 'bg-page text-muted',
  고민: 'bg-warning-soft text-warning',
}

// 질문 유형: 교과·수행평가·생활·고민
export default function CategoryBadge({ category }: { category: QuestionCategory }) {
  return (
    <span className={cn('inline-flex rounded-md px-2 py-0.5 text-caption font-semibold', categoryClass[category])}>
      {category}
    </span>
  )
}
