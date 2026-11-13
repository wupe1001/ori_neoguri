import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getTodayNoticeDraft, getTopQuestions, type TopQuestion } from '../../api/ai'
import { getCrisisAlerts, markCrisisHandled } from '../../api/crisis'
import { getInbox, subscribeQuestions } from '../../api/questions'
import Button from '../../components/Button'
import Card from '../../components/Card'
import Loading from '../../components/Loading'
import { timeAgo } from '../../lib/format'
import { ROUTES } from '../../routes'
import { useTeacher } from '../../session/session'
import type { CrisisAlert } from '../../types/question'

type HomeData = {
  crisis: CrisisAlert[]
  toAnswer: number // 오늘 답할 질문 수 (내 질문함 + 부서 질문함의 미답변)
  top: TopQuestion[]
  noticeDraft: Awaited<ReturnType<typeof getTodayNoticeDraft>>
}

export default function TeacherHomePage() {
  const teacher = useTeacher()
  const [data, setData] = useState<HomeData | null>(null)

  // 처음 불러오고, 다른 탭(학생)에서 질문·위기 알림이 오면 다시 불러온다
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [crisis, mine, dept, noticeDraft] = await Promise.all([
        getCrisisAlerts(teacher),
        getInbox(teacher, 'mine'),
        getInbox(teacher, 'department'),
        getTodayNoticeDraft(),
      ])
      const all = [...mine, ...dept]
      const top = await getTopQuestions(all)
      if (cancelled) return
      setData({ crisis, toAnswer: all.filter((q) => q.status !== 'answered').length, top, noticeDraft })
    }
    load()
    const unsubscribe = subscribeQuestions(load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [teacher])

  if (!data) return <Loading message="불러오고 있어요…" />

  const handleCrisisChecked = async (id: string) => {
    await markCrisisHandled(id)
    setData({ ...data, crisis: data.crisis.filter((a) => a.id !== id) })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        {teacher.department && <p className="text-caption text-muted">{teacher.department}</p>}
        <h1>{teacher.name} 선생님, 안녕하세요</h1>
      </div>

      {/* 위기 알림: 맨 위 고정 */}
      {data.crisis.map((alert) => (
        <Card key={alert.id} className="border-danger bg-danger-soft">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-danger">위기 신호 · 직접 연락이 필요해요</p>
            <span className="shrink-0 text-caption text-muted">{timeAgo(alert.createdAt)}</span>
          </div>
          <p className="mt-1 text-caption text-ink">
            {alert.author.grade}학년 {alert.author.classNo}반{' '}
            {alert.author.nickname ?? '학생 (이름을 알리지 않음)'}
          </p>
          {alert.text && <p className="mt-2 rounded-lg bg-surface p-2">{alert.text}</p>}
          <p className="mt-2 text-caption text-muted">AI 답 추천 없이 담임·상담 선생님께만 전달된 알림이에요.</p>
          <Button size="sm" variant="danger" className="mt-3" onClick={() => handleCrisisChecked(alert.id)}>
            확인했어요
          </Button>
        </Card>
      ))}

      {/* 오늘 답할 질문 */}
      <Link to={ROUTES.TEACHER.INBOX}>
        <Card className="flex items-center justify-between transition-colors hover:border-primary-200">
          <div>
            <p className="text-caption text-muted">답할 질문</p>
            <p className="text-title font-bold text-primary-700">{data.toAnswer}개</p>
          </div>
          <span className="text-caption text-muted">질문함 열기 →</span>
        </Card>
      </Link>

      {/* AI 오늘 공지 초안 (실제 백엔드는 아직 없어서 숨긴다) */}
      {data.noticeDraft && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">오늘 보낼 공지 초안</h2>
          <Card className="border-primary-200 bg-primary-50">
            <p className="text-caption font-semibold text-primary-700">AI 초안</p>
            <p className="mt-1 font-semibold">{data.noticeDraft.title}</p>
            <p className="mt-1 line-clamp-3 text-caption text-ink">{data.noticeDraft.body}</p>
            <p className="mt-2 text-caption text-muted">근거: {data.noticeDraft.basis}</p>
            <Link to={ROUTES.TEACHER.NOTICES} className="mt-3 block">
              <Button size="sm" variant="secondary">
                검토하고 보내기
              </Button>
            </Link>
          </Card>
        </section>
      )}

      {/* 많이 나온 질문 TOP 3 */}
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">많이 나온 질문 TOP 3</h2>
        {data.top.length === 0 ? (
          <p className="text-caption text-muted">아직 모인 질문이 없어요</p>
        ) : (
          <Card>
            <ol className="flex flex-col gap-3">
              {data.top.map((t, i) => (
                <li key={t.topic} className="flex gap-3">
                  <span className="text-title font-bold text-primary-600">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {t.topic} <span className="text-caption text-muted">{t.count}건</span>
                    </p>
                    <p className="line-clamp-1 text-caption text-muted">{t.example}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </section>
    </div>
  )
}
