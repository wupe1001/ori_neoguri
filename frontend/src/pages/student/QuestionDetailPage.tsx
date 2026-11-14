import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getStudentQuestion, subscribeQuestions } from '../../api/questions'
import Button from '../../components/Button'
import Card from '../../components/Card'
import { AttachmentList } from '../../components/Attachments'
import HotlineCard from '../../components/HotlineCard'
import Loading from '../../components/Loading'
import SourceList from '../../components/SourceList'
import StatusSteps from '../../components/StatusSteps'
import { answerAuthor, authorLabel, classLabel, forwardedLabel, timeAgo } from '../../lib/format'
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
      getStudentQuestion(id, student.id)
        .then((q) => {
          if (cancelled) return
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
        className="self-start text-caption text-muted hover:text-ink"
      >
        ← 내 질문
      </button>

      <Card>
        <StatusSteps status={question.status} />
        {question.note && (
          <p className="mt-3 rounded-lg bg-page px-3 py-2 text-caption text-muted">{question.note}</p>
        )}
        {question.resumable && (
          <Button
            fullWidth
            className="mt-3"
            onClick={() => navigate(ROUTES.STUDENT.HOME, { state: { resumeQuestionId: question.id } })}
          >
            이어서 하기
          </Button>
        )}
        {forwarded && (
          <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-caption text-warning">
            {forwarded}. 담당 부서에서 답해 줄 거예요.
          </p>
        )}
      </Card>

      <Card title="보낸 질문">
        <p>{question.rewrittenText}</p>
        <AttachmentList items={question.attachments} className="mt-3" />
        <p className="mt-2 text-caption text-muted">
          {/* 실제 백엔드는 학년·반을 주지 않아서 보낸 이름은 생략한다 */}
          {classLabel(question.author) && `${authorLabel(question.author)}(으)로 보냄 · `}
          {question.subjectName && `${question.subjectName} · `}
          {question.crisis && '담임 선생님께 전달 · '}
          {timeAgo(question.createdAt)}
        </p>
      </Card>

      {/* 고민·위기 신호로 담임에게 간 질문: 답을 기다리는 동안 바로 연락할 곳을 알려준다 */}
      {question.crisis && !question.answer && <HotlineCard />}

      {question.answer ? (
        <Card title={`${answerAuthor(question.answer)}의 답`} className="border-success bg-success-soft">
          <p className="whitespace-pre-line">{question.answer.text}</p>
          <AttachmentList items={question.answer.attachments} className="mt-3" />
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
