import type { QuestionStatus } from '../types/question'
import { cn } from './cn'

const STEPS: { status: QuestionStatus; label: string }[] = [
  { status: 'received', label: '접수' },
  { status: 'forwarded', label: '전달됨' },
  { status: 'answered', label: '답변 완료' },
]

// 진행 상태를 접수 → 전달됨 → 답변 완료 단계로 보여준다
export default function StatusSteps({ status }: { status: QuestionStatus }) {
  const current = STEPS.findIndex((s) => s.status === status)

  return (
    <ol className="flex items-center">
      {STEPS.map((step, i) => {
        const done = i <= current
        return (
          <li key={step.status} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-caption font-bold',
                  done ? 'bg-primary-600 text-white' : 'border border-line bg-surface text-muted',
                )}
              >
                {done ? '✓' : i + 1}
              </span>
              <span className={cn('text-caption', done ? 'font-semibold text-primary-700' : 'text-muted')}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className={cn('mx-1 mb-5 h-0.5 flex-1', i < current ? 'bg-primary-600' : 'bg-line')} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
