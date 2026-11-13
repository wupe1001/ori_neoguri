import { useState } from 'react'
import { askChatbot, refineQuestion, rewriteQuestion, screenQuestion } from '../../api/ai'
import { submitQuestion } from '../../api/questions'
import { useStudent } from '../../session/session'
import type { ChatbotReply, FiveW1H } from '../../types/question'
import ChatbotStep from './ask/ChatbotStep'
import ConfirmStep from './ask/ConfirmStep'
import CrisisStep from './ask/CrisisStep'
import DoneStep from './ask/DoneStep'
import Loading from './ask/Loading'
import RefineStep from './ask/RefineStep'
import type { AskStep } from './ask/types'
import WriteStep from './ask/WriteStep'

// 질문하기: 한 페이지 안에서 단계만 바꾼다.
// 쓰기 → 검사(위기·욕설) → 챗봇 답 또는 육하원칙 정리 → "이렇게 보낼까요?" → 전송
export default function AskPage() {
  const student = useStudent()

  const [step, setStep] = useState<AskStep>('write')
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [text, setText] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [blockedReason, setBlockedReason] = useState<string | null>(null)
  const [chatbotReply, setChatbotReply] = useState<ChatbotReply | null>(null)
  const [aiResult, setAiResult] = useState<FiveW1H | null>(null)
  const [fiveW1H, setFiveW1H] = useState<FiveW1H | null>(null)
  const [rewrittenText, setRewrittenText] = useState('')
  const [sending, setSending] = useState(false)
  const [sentId, setSentId] = useState<string | null>(null)

  const goTo = (next: AskStep) => {
    setStep(next)
    window.scrollTo({ top: 0 })
  }

  // AI 호출을 감싸서 로딩 문구와 에러를 한 곳에서 처리한다
  const run = async (message: string, task: () => Promise<void>) => {
    setError(null)
    setLoadingMessage(message)
    try {
      await task()
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제가 생겼어요. 다시 시도해 주세요.')
    } finally {
      setLoadingMessage(null)
    }
  }

  const startRefine = () =>
    run('AI가 육하원칙으로 정리하고 있어요…', async () => {
      const result = await refineQuestion(text, student, isAnonymous)
      setAiResult(result)
      setFiveW1H(result)
      goTo('refine')
    })

  // 챗봇/선생님 버튼: 먼저 위기 신호와 욕설을 검사한다
  const handleAsk = (target: 'chatbot' | 'teacher') =>
    run('질문을 확인하고 있어요…', async () => {
      setBlockedReason(null)
      const result = await screenQuestion(text)
      if (result.kind === 'crisis') return goTo('crisis')
      if (result.kind === 'blocked') return setBlockedReason(result.reason)

      if (target === 'teacher') return startRefine()
      setLoadingMessage('챗봇이 답을 찾고 있어요…')
      setChatbotReply(await askChatbot(text))
      goTo('chatbot')
    })

  const handleRefineNext = () =>
    run('AI가 질문을 다시 쓰고 있어요…', async () => {
      if (!fiveW1H) return
      setRewrittenText(await rewriteQuestion(text, fiveW1H))
      goTo('confirm')
    })

  const handleSend = async (finalText: string) => {
    if (!fiveW1H) return
    setSending(true)
    setError(null)
    try {
      const question = await submitQuestion({
        student,
        isAnonymous,
        originalText: text,
        fiveW1H,
        rewrittenText: finalText,
      })
      setSentId(question.id)
      goTo('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : '보내지 못했어요. 다시 시도해 주세요.')
    } finally {
      setSending(false)
    }
  }

  const restart = () => {
    setText('')
    setBlockedReason(null)
    setChatbotReply(null)
    setAiResult(null)
    setFiveW1H(null)
    setRewrittenText('')
    setSentId(null)
    setError(null)
    goTo('write')
  }

  if (loadingMessage) return <Loading message={loadingMessage} />

  return (
    <>
      {error && <p className="mb-4 rounded-xl bg-danger-soft p-3 text-caption text-danger">{error}</p>}

      {step === 'write' && (
        <WriteStep
          text={text}
          onTextChange={setText}
          isAnonymous={isAnonymous}
          onAnonymousChange={setIsAnonymous}
          blockedReason={blockedReason}
          onAskChatbot={() => handleAsk('chatbot')}
          onAskTeacher={() => handleAsk('teacher')}
        />
      )}

      {step === 'crisis' && <CrisisStep isAnonymous={isAnonymous} onBack={restart} />}

      {step === 'chatbot' && chatbotReply && (
        <ChatbotStep
          question={text}
          reply={chatbotReply}
          onResolved={() => goTo('resolved')}
          onAskTeacher={startRefine}
        />
      )}

      {step === 'refine' && aiResult && fiveW1H && (
        <RefineStep
          aiResult={aiResult}
          values={fiveW1H}
          onChange={setFiveW1H}
          onNext={handleRefineNext}
          onBack={() => goTo('write')}
        />
      )}

      {step === 'confirm' && (
        <ConfirmStep
          rewrittenText={rewrittenText}
          isAnonymous={isAnonymous}
          authorLabel={`${student.grade}학년 ${student.classNo}반 ${isAnonymous ? '학생' : student.nickname}`}
          sending={sending}
          onSend={handleSend}
          onBack={() => goTo('refine')}
        />
      )}

      {step === 'sent' && sentId && <DoneStep kind="sent" questionId={sentId} onRestart={restart} />}
      {step === 'resolved' && <DoneStep kind="resolved" onRestart={restart} />}
    </>
  )
}
