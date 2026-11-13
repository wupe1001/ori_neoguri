import { useEffect, useMemo, useState } from 'react'
import { getClusters, getLessonDraft, type QuestionCluster } from '../../api/ai'
import { getClasses } from '../../api/notices'
import { getInbox, subscribeQuestions } from '../../api/questions'
import Button from '../../components/Button'
import Card from '../../components/Card'
import { cn } from '../../components/cn'
import Loading from '../../components/Loading'
import { useTeacher } from '../../session/session'
import type { Question, QuestionCategory } from '../../types/question'
import type { ClassRef } from '../../types/user'

type Period = 'today' | 'week' | 'all'
const PERIODS: [Period, string][] = [
  ['today', '오늘'],
  ['week', '최근 7일'],
  ['all', '전체'],
]
const CATEGORIES: (QuestionCategory | '전체')[] = ['전체', '교과', '수행평가', '생활', '고민']

const classKey = (c: ClassRef) => `${c.grade}-${c.classNo}`

function inPeriod(iso: string, period: Period) {
  const date = new Date(iso)
  const now = new Date()
  if (period === 'today') return date.toDateString() === now.toDateString()
  if (period === 'week') return now.getTime() - date.getTime() <= 7 * 24 * 60 * 60 * 1000
  return true
}

export default function ClustersPage() {
  const teacher = useTeacher()
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [classes, setClasses] = useState<ClassRef[]>([])
  const [classFilter, setClassFilter] = useState<string>('all')
  const [period, setPeriod] = useState<Period>('week')
  const [category, setCategory] = useState<QuestionCategory | '전체'>('전체')
  const [result, setResult] = useState<{ clusters: QuestionCluster[]; unclustered: Question[] } | null>(null)

  // 내 질문함 + 부서 질문함의 질문을 불러오고, 새 질문이 오면 다시 불러온다
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [mine, dept, classList] = await Promise.all([
        getInbox(teacher, 'mine'),
        getInbox(teacher, 'department'),
        getClasses(),
      ])
      if (cancelled) return
      setQuestions([...mine, ...dept])
      setClasses(classList)
    }
    load()
    const unsubscribe = subscribeQuestions(load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [teacher])

  const filtered = useMemo(
    () =>
      questions?.filter(
        (q) =>
          (classFilter === 'all' || classKey(q.author) === classFilter) &&
          inPeriod(q.createdAt, period) &&
          (category === '전체' || q.category === category),
      ) ?? null,
    [questions, classFilter, period, category],
  )

  // 거른 질문을 AI가 개념별로 묶는다
  useEffect(() => {
    if (!filtered) return
    let cancelled = false
    getClusters(filtered).then((r) => {
      if (!cancelled) setResult(r)
    })
    return () => {
      cancelled = true
    }
  }, [filtered])

  if (!questions) return <Loading message="질문을 불러오고 있어요…" />

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1>질문 묶음</h1>
        <p className="mt-1 text-caption text-muted">
          AI가 비슷한 질문을 개념별로 묶었어요. 반 전체가 막힌 곳을 보고 다음 수업을 준비해요.
        </p>
      </div>

      {/* 반 · 기간 · 유형 */}
      <div className="flex flex-col gap-2">
        <Chips
          options={[['all', '전체 반'], ...classes.map((c): [string, string] => [classKey(c), `${c.grade}-${c.classNo}반`])]}
          value={classFilter}
          onChange={setClassFilter}
        />
        <Chips options={PERIODS} value={period} onChange={setPeriod} />
        <Chips options={CATEGORIES.map((c): [typeof c, string] => [c, c])} value={category} onChange={setCategory} />
      </div>

      {!result ? (
        <Loading message="AI가 질문을 묶고 있어요…" />
      ) : result.clusters.length === 0 ? (
        <p className="py-12 text-center text-muted">이 조건에서 묶인 질문이 없어요</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.clusters.map((c, i) => (
            <li key={c.topic}>
              <ClusterCard cluster={c} rank={i + 1} />
            </li>
          ))}
        </ul>
      )}

      {result && result.unclustered.length > 0 && (
        <p className="text-center text-caption text-muted">묶이지 않은 질문 {result.unclustered.length}개는 질문함에서 볼 수 있어요</p>
      )}
    </div>
  )
}

function ClusterCard({ cluster, rank }: { cluster: QuestionCluster; rank: number }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const makeDraft = async () => {
    setLoading(true)
    try {
      setDraft(await getLessonDraft(cluster))
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!draft) return
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
    } catch {
      // 복사가 막힌 환경이면 직접 선택해서 복사한다
    }
  }

  return (
    <Card className={cn(rank === 1 && 'border-primary-200')}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">
          <span className="mr-1 text-primary-600">{rank}</span> {cluster.topic}
        </p>
        <span className="shrink-0 rounded-full bg-primary-50 px-2.5 py-0.5 text-caption font-semibold text-primary-700">
          학생 {cluster.studentCount}명
        </span>
      </div>

      <ul className="mt-2 flex flex-col gap-1">
        {cluster.questions.slice(0, 3).map((q) => (
          <li key={q.id} className="line-clamp-1 text-caption text-muted">
            · {q.originalText}
          </li>
        ))}
        {cluster.questions.length > 3 && (
          <li className="text-caption text-muted">외 {cluster.questions.length - 3}개</li>
        )}
      </ul>

      {draft ? (
        <div className="mt-3 rounded-xl bg-primary-50 p-3">
          <p className="text-caption font-semibold text-primary-700">AI 보충 설명 초안</p>
          <p className="mt-1 whitespace-pre-line text-caption text-ink">{draft}</p>
          <Button size="sm" variant="secondary" className="mt-2" onClick={copy}>
            {copied ? '복사했어요' : '복사하기'}
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="secondary" className="mt-3" disabled={loading} onClick={makeDraft}>
          {loading ? 'AI가 쓰고 있어요…' : '다음 수업 보충 설명 초안'}
        </Button>
      )}
    </Card>
  )
}

// 가로로 스크롤되는 선택 칩
function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, string][]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            'shrink-0 rounded-full border px-3 py-1 text-caption',
            value === v ? 'border-primary-600 bg-primary-600 text-white' : 'border-line text-muted',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
