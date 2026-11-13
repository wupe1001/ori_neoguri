import { useEffect, useState } from 'react'
import { getSubjects } from '../../../api/ask'
import type { Subject } from '../../../api/backend/types'
import Button from '../../../components/Button'
import { cn } from '../../../components/cn'
import Loading from '../../../components/Loading'

type Props = {
  submitting: boolean
  onChoose: (subjectId: number) => void
}

// AI가 과목을 정하지 못했을 때 학생이 직접 고른다
export default function SubjectStep({ submitting, onChoose }: Props) {
  const [subjects, setSubjects] = useState<Subject[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    getSubjects()
      .then((list) => {
        if (!cancelled) setSubjects(list)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <p className="py-16 text-center text-muted">{error}</p>
  if (!subjects) return <Loading message="과목 목록을 불러오고 있어요…" />

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1>어느 과목 질문인가요?</h1>
        <p className="mt-1 text-muted">AI가 과목을 정하지 못했어요. 고르면 그 과목 선생님께 보내요.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {subjects.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelected(s.id)}
            className={cn(
              'rounded-xl border py-3 text-body',
              selected === s.id ? 'border-primary-600 bg-primary-50 font-semibold text-primary-700' : 'border-line',
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      <Button fullWidth disabled={selected === null || submitting} onClick={() => selected !== null && onChoose(selected)}>
        {submitting ? '보내는 중…' : '이 과목 선생님께 보내기'}
      </Button>
    </div>
  )
}
