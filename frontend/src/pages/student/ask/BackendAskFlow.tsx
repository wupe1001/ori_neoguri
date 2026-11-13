import { useState } from 'react'
import { useLocation } from 'react-router'
import { chooseSubject, confirmAsk, retryAsk, submitAsk, submitDetails, type AskResult } from '../../../api/ask'
import Loading from '../../../components/Loading'
import { useStudent } from '../../../session/session'
import type { ChatbotReply, FiveW1H } from '../../../types/question'
import ChatbotStep from './ChatbotStep'
import ConfirmStep from './ConfirmStep'
import DoneStep from './DoneStep'
import FailedStep from './FailedStep'
import RefineStep from './RefineStep'
import SubjectStep from './SubjectStep'
import WriteStep from './WriteStep'

type Step = 'write' | 'refine' | 'confirm' | 'subject' | 'notice' | 'sent' | 'failed' | 'resolved'

const EMPTY: FiveW1H = { who: null, when: null, where: null, what: null, how: null, why: null }

// 실제 백엔드 질문하기 흐름.
// 질문을 보내면 백엔드 AI가 다음 단계를 정해서 알려준다 (AskResult). 화면은 그 결과대로 바뀐다.
// 쓰기 → (공지로 답 | 육하원칙 → 확인 | 과목 선택 | 배정 | 실패 → 재시도)
export default function BackendAskFlow() {
  const student = useStudent()
  const location = useLocation()
  const initialText = (location.state as { initialText?: string } | null)?.initialText ?? ''

  const [step, setStep] = useState<Step>('write')
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [text, setText] = useState(initialText)
  const [questionId, setQuestionId] = useState<number | null>(null)
  const [fiveW1H, setFiveW1H] = useState<FiveW1H>(EMPTY)
  const [askedAgain, setAskedAgain] = useState(false)
  const [rewritten, setRewritten] = useState('')
  const [noticeReply, setNoticeReply] = useState<ChatbotReply | null>(null)
  const [sent, setSent] = useState<{ toLabel: string; crisisMessage: string | null } | null>(null)

  const goTo = (next: Step) => {
    setStep(next)
    window.scrollTo({ top: 0 })
  }

  // 백엔드가 알려준 다음 단계로 이동한다
  const apply = (result: AskResult) => {
    setQuestionId(result.questionId)
    switch (result.kind) {
      case 'needs_details':
        // 전에 채운 내용이 있으면 AI가 다시 보완을 요청한 것
        setAskedAgain(result.previous !== null)
        setFiveW1H(result.previous ?? EMPTY)
        return goTo('refine')
      case 'confirm':
        setRewritten(result.rewritten)
        return goTo('confirm')
      case 'needs_subject':
        return goTo('subject')
      case 'notice_answered':
        setNoticeReply({ answer: result.answer, sources: result.sources })
        return goTo('notice')
      case 'assigned': {
        const homeroom = result.routeType === 'HOMEROOM'
        setSent({
          toLabel: homeroom ? '담임 선생님' : `${result.subjectName ?? '담당'} 선생님`,
          crisisMessage: homeroom ? result.message : null,
        })
        return goTo('sent')
      }
      case 'failed':
        return goTo('failed')
      case 'other':
        setSent({ toLabel: '담당 선생님', crisisMessage: null })
        return goTo('sent')
    }
  }

  // 백엔드 호출을 감싸서 로딩 문구와 에러를 한 곳에서 처리한다
  const run = async (message: string, task: () => Promise<AskResult>) => {
    setError(null)
    setLoadingMessage(message)
    try {
      apply(await task())
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제가 생겼어요. 다시 시도해 주세요.')
    } finally {
      setLoadingMessage(null)
    }
  }

  const id = () => {
    if (questionId === null) throw new Error('질문 정보가 없어요. 처음부터 다시 시도해 주세요.')
    return questionId
  }

  const handleSubmit = () => run('AI가 질문을 살펴보고 있어요…', () => submitAsk(text.trim()))

  const handleDetails = () =>
    run('AI가 질문을 다시 쓰고 있어요…', () =>
      submitDetails(id(), {
        who: fiveW1H.who?.trim() ?? '',
        when: fiveW1H.when?.trim() ?? '',
        where: fiveW1H.where?.trim() ?? '',
        what: fiveW1H.what?.trim() ?? '',
        how: fiveW1H.how?.trim() ?? '',
        why: fiveW1H.why?.trim() ?? '',
      }),
    )

  const handleConfirm = (finalText: string) => run('담당 선생님을 찾고 있어요…', () => confirmAsk(id(), finalText))
  const handleSubject = (subjectId: number) => run('선생님께 보내고 있어요…', () => chooseSubject(id(), subjectId))
  const handleRetry = () => run('다시 시도하고 있어요…', () => retryAsk(id()))

  const restart = () => {
    setText('')
    setQuestionId(null)
    setFiveW1H(EMPTY)
    setAskedAgain(false)
    setRewritten('')
    setNoticeReply(null)
    setSent(null)
    setError(null)
    goTo('write')
  }

  if (loadingMessage) return <Loading message={loadingMessage} />

  return (
    <>
      {error && <p className="mb-4 rounded-xl bg-danger-soft p-3 text-caption text-danger">{error}</p>}

      {step === 'write' && (
        <WriteStep text={text} onTextChange={setText} blockedReason={null} onAskTeacher={handleSubmit} />
      )}

      {step === 'refine' && (
        <RefineStep
          aiResult={EMPTY}
          values={fiveW1H}
          onChange={setFiveW1H}
          requireAll
          askedAgain={askedAgain}
          onNext={handleDetails}
          onBack={restart}
        />
      )}

      {step === 'confirm' && (
        <ConfirmStep
          rewrittenText={rewritten}
          isAnonymous={false}
          authorLabel={student.nickname}
          sending={false}
          onSend={handleConfirm}
        />
      )}

      {step === 'subject' && <SubjectStep submitting={false} onChoose={handleSubject} />}

      {step === 'notice' && noticeReply && (
        <ChatbotStep question={text} reply={noticeReply} onResolved={() => goTo('resolved')} />
      )}

      {step === 'sent' && sent && questionId !== null && (
        <DoneStep
          kind="sent"
          questionId={String(questionId)}
          toLabel={sent.toLabel}
          crisisMessage={sent.crisisMessage}
          onRestart={restart}
        />
      )}

      {step === 'failed' && <FailedStep retrying={false} onRetry={handleRetry} onRestart={restart} />}

      {step === 'resolved' && <DoneStep kind="resolved" onRestart={restart} />}
    </>
  )
}
