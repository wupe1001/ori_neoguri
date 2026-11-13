import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getQuestion, subscribeQuestions } from '../../api/questions'
import Card from '../../components/Card'
import Loading from '../../components/Loading'
import SourceList from '../../components/SourceList'
import StatusSteps from '../../components/StatusSteps'
import { authorLabel, forwardedLabel, timeAgo } from '../../lib/format'
import { markAnswerSeen } from '../../lib/seenAnswers'
import { ROUTES } from '../../routes'
import { useStudent } from '../../session/session'
import type { Question } from '../../types/question'

export default function QuestionDetailPage() {
  const { id = '' } = useParams()
  const student = useStudent()
  const navigate = useNavigate()

  const [question, setQuestion] = useState<Question | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 처음 불러오고, 다른 탭(교사)에서 답하면 다시 불러온다
  useEffect(() => {
    let cancelled = false
    const load = () =>
      getQuestion(id)
        .then((q) => {
          if (cancelled) return
          // 다른 학생의 질문은 보여주지 않는다
          if (q.studentId !== student.id) throw new Error('질문을 찾을 수 없어요.')
          // 답을 봤으면 홈의 "새로 온 답"에서 뺀다
          if (q.answer) markAnswerSeen(student.id, q.id)
          setQuestion(q)
        })
        .catch((err: Error) => {
          if (!cancelled) setError(err.message)
        })
    load()
    const unsubscribe = subscribeQuestions(load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [id, student.id])

  if (error) return <p className="py-16 text-center text-muted">{error}</p>
  if (!question) return <Loading message="질문을 불러오고 있어요…" />

  const forwarded = forwardedLabel(question)

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => navigate(ROUTES.STUDENT.QUESTIONS)}
        className="self-start text-caption text-muted"
      >
        ← 내 질문
      </button>

      <Card>
        <StatusSteps status={question.status} />
        {forwarded && (
          <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-caption text-warning">
            {forwarded}. 담당 부서에서 답해 줄 거예요.
          </p>
        )}
      </Card>

      <Card title="보낸 질문">
        <p>{question.rewrittenText}</p>
        <p className="mt-2 text-caption text-muted">
          {authorLabel(question.author)}(으)로 보냄 · {timeAgo(question.createdAt)}
        </p>
      </Card>

      {question.answer ? (
        <Card title={`${question.answer.teacherName} 선생님의 답`} className="border-success bg-success-soft">
          <p className="whitespace-pre-line">{question.answer.text}</p>
          <SourceList sources={question.answer.sources} />
          <p className="mt-3 text-caption text-muted">
            {timeAgo(question.answer.answeredAt)}
            {(question.answer.recipients ?? 1) > 1 &&
              ` · 같은 질문을 한 친구 ${question.answer.recipients - 1}명도 함께 받았어요`}
          </p>
        </Card>
      ) : (
        <p className="py-6 text-center text-caption text-muted">답이 오면 여기에 보여요</p>
      )}
    </div>
  )
}
