import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getNoticesFor } from '../../api/notices'
import { getMyQuestions, subscribeQuestions } from '../../api/questions'
import Button from '../../components/Button'
import Card from '../../components/Card'
import Loading from '../../components/Loading'
import { timeAgo } from '../../lib/format'
import { getSeenAnswerIds } from '../../lib/seenAnswers'
import { ROUTES } from '../../routes'
import { useStudent } from '../../session/session'
import type { Notice, Question } from '../../types/question'

export default function StudentHomePage() {
  const student = useStudent()
  const [notices, setNotices] = useState<Notice[] | null>(null)
  const [newAnswers, setNewAnswers] = useState<Question[] | null>(null)

  // 공지와 아직 안 본 답을 불러오고, 다른 탭(교사)에서 답하면 다시 불러온다
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [noticeList, questions] = await Promise.all([getNoticesFor(student), getMyQuestions(student.id)])
      if (cancelled) return
      const seen = getSeenAnswerIds(student.id)
      setNotices([...noticeList].sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, 2))
      setNewAnswers(questions.filter((q) => q.answer && !seen.includes(q.id)))
    }
    load()
    const unsubscribe = subscribeQuestions(load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [student])

  if (!notices || !newAnswers) return <Loading message="불러오고 있어요…" />

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-caption text-muted">
          {student.grade}학년 {student.classNo}반
        </p>
        <h1>{student.nickname}님, 안녕하세요</h1>
      </div>

      <Card className="border-primary-200 bg-primary-50">
        <p className="font-semibold">궁금한 게 있나요?</p>
        <p className="mt-1 text-caption text-muted">챗봇이 바로 답하거나, 정리해서 선생님께 전해 줄게요</p>
        <Link to={ROUTES.STUDENT.ASK} className="mt-3 block">
          <Button fullWidth>질문하기</Button>
        </Link>
      </Card>

      {/* 새로 온 답 */}
      {newAnswers.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">
            새로 온 답 <span className="text-success">{newAnswers.length}</span>
          </h2>
          {newAnswers.map((q) => (
            <Link key={q.id} to={ROUTES.STUDENT.QUESTION_DETAIL(q.id)}>
              <Card className="border-success transition-colors hover:bg-success-soft">
                <p className="line-clamp-1 text-caption text-muted">{q.rewrittenText}</p>
                <p className="mt-1 line-clamp-2">
                  <b className="text-success">{q.answer?.teacherName} 선생님</b> {q.answer?.text}
                </p>
              </Card>
            </Link>
          ))}
        </section>
      )}

      {/* 오늘 꼭 볼 공지 */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">꼭 볼 공지</h2>
          <Link to={ROUTES.STUDENT.NOTICES} className="text-caption text-muted">
            전체 보기
          </Link>
        </div>
        {notices.length === 0 ? (
          <p className="text-caption text-muted">새 공지가 없어요</p>
        ) : (
          notices.map((n) => (
            <Card key={n.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{n.title}</p>
                <span className="shrink-0 text-caption text-muted">{timeAgo(n.sentAt)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-caption text-muted">{n.body}</p>
            </Card>
          ))
        )}
      </section>

      {/* 도움이 필요해요 */}
      <Link to={ROUTES.STUDENT.HELP}>
        <Card className="border-warning bg-warning-soft">
          <p className="font-semibold text-ink">도움이 필요해요</p>
          <p className="mt-1 text-caption text-muted">고민이 있으면 상담 선생님께 바로 연결해 줄게요</p>
        </Card>
      </Link>
    </div>
  )
}
