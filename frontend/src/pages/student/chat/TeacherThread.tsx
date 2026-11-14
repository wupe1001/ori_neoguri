import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { USE_MOCK } from '../../../api/client'
import { getMyQuestions, getStudentQuestion, subscribeQuestions } from '../../../api/questions'
import { cn } from '../../../components/cn'
import SourceList from '../../../components/SourceList'
import { answerAuthor, timeAgo } from '../../../lib/format'
import { ROUTES } from '../../../routes'
import { useStudent } from '../../../session/session'
import type { Answer, Question } from '../../../types/question'

// 선생님 대화: 선생님께 보낸 질문과 받은 답을 메신저처럼 시간순으로 보여준다 (보기 전용).
// 목록에는 답 내용이 없어서, 답이 온 질문만 상세를 불러온다. 답은 바뀌지 않으니 한 번 불러오면 기억한다.
// 실제 백엔드는 상세를 열면 답을 읽음 처리하므로, 이 화면을 보면 안 읽은 답 수가 줄어든다.
export default function TeacherThread() {
  const student = useStudent()
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const answersRef = useRef(answers)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const list = await getMyQuestions(student.id)
      // 선생님께 간 질문만, 오래된 것부터.
      // 실제: 배정(전달됨)·선생님 답변 완료 (AI 개선 중인 질문, 공지로 AI가 답한 질문은 뺀다)
      // 목업: 저장된 질문이 모두 선생님께 보낸 질문이다
      const sent = list
        .filter((q) => USE_MOCK || q.status === 'forwarded' || (q.status === 'answered' && !q.noticeAnswered))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

      const missing = sent.filter((q) => q.status === 'answered' && !q.answer && !answersRef.current[q.id])
      const loaded = await Promise.all(missing.map((q) => getStudentQuestion(q.id, student.id)))
      if (cancelled) return

      const next = { ...answersRef.current }
      for (const q of [...sent, ...loaded]) if (q.answer) next[q.id] = q.answer
      answersRef.current = next
      setAnswers(next)
      setQuestions(sent)
    }
    load()
    const unsubscribe = subscribeQuestions(load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [student.id])

  // 처음 열었을 때와 새 답이 왔을 때 맨 아래로
  const answerCount = Object.keys(answers).length
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [questions?.length, answerCount])

  if (!questions) return <p className="py-16 text-center text-caption text-muted">선생님 대화를 불러오고 있어요…</p>

  if (questions.length === 0) {
    return (
      <div className="py-16 text-center text-muted">
        <p>아직 선생님께 보낸 질문이 없어요.</p>
        <p className="mt-1 text-caption">AI 채팅에서 질문하면 정리해서 선생님께 전해 줘요.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      {questions.map((q) => {
        const answer = answers[q.id] ?? q.answer
        const to = q.crisis ? '담임' : (q.subjectName ?? '담당')
        return (
          <div key={q.id} className="flex flex-col gap-2">
            {/* 내가 보낸 질문 */}
            <div className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-line rounded-[20px] rounded-tr-md bg-linear-to-br from-primary-500 to-primary-700 px-4 py-2.5 text-white shadow-sm shadow-primary-600/20">
                {q.rewrittenText}
              </p>
            </div>

            {/* 상태 안내 */}
            <Link to={ROUTES.STUDENT.QUESTION_DETAIL(q.id)} className="self-center">
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-caption',
                  answer ? 'bg-success-soft text-success' : 'bg-page text-muted',
                )}
              >
                {to} 선생님께 전달됨 · {answer ? '답변 완료' : '답변 기다리는 중'} · {timeAgo(q.createdAt)}
              </span>
            </Link>

            {/* 선생님 답 */}
            {answer && (
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-success text-[11px] font-extrabold text-white shadow-sm">
                  쌤
                </span>
                <div className="min-w-0 flex-1 rounded-[20px] rounded-tl-md border border-success/20 bg-surface px-4 py-3 shadow-card">
                  <p className="text-caption font-semibold text-success">{answerAuthor(answer)}</p>
                  <p className="mt-0.5 whitespace-pre-line">{answer.text}</p>
                  <SourceList sources={answer.sources} />
                  <p className="mt-1 text-caption text-muted">{timeAgo(answer.answeredAt)}</p>
                </div>
              </div>
            )}
          </div>
        )
      })}
      <p className="text-center text-caption text-muted">선생님께는 답장할 수 없어요. 더 궁금하면 AI 채팅에서 새로 질문해 주세요.</p>
      <div ref={endRef} />
    </div>
  )
}
