import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getMyQuestions, subscribeQuestions } from '../../api/questions'
import Button from '../../components/Button'
import Card from '../../components/Card'
import { cn } from '../../components/cn'
import Loading from '../../components/Loading'
import StatusBadge from '../../components/StatusBadge'
import { forwardedLabel, timeAgo } from '../../lib/format'
import { ROUTES } from '../../routes'
import { useStudent } from '../../session/session'
import type { Question } from '../../types/question'

type Filter = 'ongoing' | 'answered'

export default function MyQuestionsPage() {
  const student = useStudent()
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [filter, setFilter] = useState<Filter>('ongoing')

  // 처음 불러오고, 다른 탭(교사)에서 답하면 다시 불러온다
  useEffect(() => {
    let cancelled = false
    const load = () =>
      getMyQuestions(student.id).then((list) => {
        if (!cancelled) setQuestions(list)
      })
    load()
    const unsubscribe = subscribeQuestions(load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [student.id])

  if (!questions) return <Loading message="내 질문을 불러오고 있어요…" />

  const ongoing = questions.filter((q) => q.status !== 'answered')
  const answered = questions.filter((q) => q.status === 'answered')
  const visible = filter === 'ongoing' ? ongoing : answered

  return (
    <div className="flex flex-col gap-4">
      <h1>내 질문</h1>

      <div className="grid grid-cols-2 rounded-full bg-page p-1 text-caption font-semibold">
        {(
          [
            ['ongoing', `진행 중 ${ongoing.length}`],
            ['answered', `답변 완료 ${answered.length}`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              'rounded-full py-2 transition-colors',
              filter === value ? 'bg-surface text-primary-700 shadow-sm' : 'text-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted">
          <p>{filter === 'ongoing' ? '진행 중인 질문이 없어요' : '아직 답을 받은 질문이 없어요'}</p>
          {filter === 'ongoing' && (
            <Link to={ROUTES.STUDENT.HOME}>
              <Button size="sm">질문하러 가기</Button>
            </Link>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((q) => (
            <li key={q.id}>
              <Link to={ROUTES.STUDENT.QUESTION_DETAIL(q.id)}>
                <Card
                  className={cn(
                    'transition-colors hover:border-primary-200',
                    q.status === 'answered' && 'border-success',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-caption text-muted">{timeAgo(q.createdAt)}</span>
                    <StatusBadge status={q.status} />
                  </div>
                  <p className="mt-2 line-clamp-2">{q.rewrittenText}</p>
                  {forwardedLabel(q) && <p className="mt-2 text-caption text-warning">{forwardedLabel(q)}</p>}
                  {q.answer && (
                    <p className="mt-2 line-clamp-1 text-caption text-success">
                      {q.answer.teacherName} 선생님: {q.answer.text}
                    </p>
                  )}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
