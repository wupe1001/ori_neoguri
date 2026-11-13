import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getInbox, subscribeQuestions } from '../../api/questions'
import Card from '../../components/Card'
import CategoryBadge from '../../components/CategoryBadge'
import { cn } from '../../components/cn'
import Loading from '../../components/Loading'
import StatusBadge from '../../components/StatusBadge'
import { authorLabel, timeAgo } from '../../lib/format'
import { ROUTES } from '../../routes'
import { useTeacher } from '../../session/session'
import type { Question, QuestionCategory, QuestionStatus } from '../../types/question'

type Box = 'mine' | 'department'
const CATEGORIES: (QuestionCategory | '전체')[] = ['전체', '교과', '수행평가', '생활', '고민']

// 답할 질문이 위로 오도록: 접수 → 전달됨 → 답변 완료, 같은 상태는 최신순
const STATUS_ORDER: Record<QuestionStatus, number> = { received: 0, forwarded: 1, answered: 2 }
function sortQuestions(list: Question[]) {
  return [...list].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt.localeCompare(a.createdAt),
  )
}

export default function InboxPage() {
  const teacher = useTeacher()
  // 탭·필터는 URL에 둔다 → 상세에서 뒤로 와도 유지된다
  const [params, setParams] = useSearchParams()
  const box: Box = params.get('box') === 'department' ? 'department' : 'mine'
  const category = (params.get('category') as QuestionCategory | null) ?? '전체'

  const [questions, setQuestions] = useState<Question[] | null>(null)

  // 처음 불러오고, 다른 탭(학생)에서 질문을 보내면 다시 불러온다
  useEffect(() => {
    let cancelled = false
    const load = () =>
      getInbox(teacher, box).then((list) => {
        if (!cancelled) setQuestions(sortQuestions(list))
      })
    load()
    const unsubscribe = subscribeQuestions(load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [teacher, box])

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const changeBox = (next: Box) => {
    setQuestions(null)
    setParam('box', next === 'mine' ? null : next)
  }

  const visible = questions?.filter((q) => category === '전체' || q.category === category) ?? []

  return (
    <div className="flex flex-col gap-4">
      <h1>질문함</h1>

      {/* 내 질문함 / 부서 질문함 */}
      <div className="grid grid-cols-2 rounded-full bg-page p-1 text-caption font-semibold">
        {(['mine', 'department'] as const).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => changeBox(b)}
            className={cn(
              'rounded-full py-2 transition-colors',
              box === b ? 'bg-surface text-primary-700 shadow-sm' : 'text-muted',
            )}
          >
            {b === 'mine' ? '내 질문함' : `${teacher.department} 질문함`}
          </button>
        ))}
      </div>

      {/* 유형 필터 */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setParam('category', c === '전체' ? null : c)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-caption',
              category === c ? 'border-primary-600 bg-primary-600 text-white' : 'border-line text-muted',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {questions === null ? (
        <Loading message="질문을 불러오고 있어요…" />
      ) : visible.length === 0 ? (
        <p className="py-16 text-center text-muted">아직 들어온 질문이 없어요</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((q) => (
            <li key={q.id}>
              <Link to={ROUTES.TEACHER.INBOX_DETAIL(q.id)}>
                <Card className={cn('transition-colors hover:border-primary-200', q.status === 'answered' && 'opacity-60')}>
                  <div className="flex items-center justify-between gap-2">
                    <CategoryBadge category={q.category} />
                    <StatusBadge status={q.status} />
                  </div>
                  <p className="mt-2 line-clamp-2">{q.rewrittenText}</p>
                  <p className="mt-2 text-caption text-muted">
                    {authorLabel(q.author)} · {timeAgo(q.createdAt)}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
