import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import type { Subject } from '../../../api/backend/types'
import Button from '../../../components/Button'
import { cn } from '../../../components/cn'
import HotlineCard from '../../../components/HotlineCard'
import SourceList from '../../../components/SourceList'
import { TextArea } from '../../../components/TextField'
import { ROUTES } from '../../../routes'
import type { QuestionCandidate } from '../../../types/question'
import type { AiContent } from './types'

export type ChatActions = {
  getSubjects: () => Promise<Subject[]>
  // 예시 답변을 아래 입력창에 채운다 (학생이 고쳐서 보낸다)
  fillComposer: (text: string) => void
  // 1·2단계에서 남은 단계를 건너뛰고 AI 추천 질문 하나로 바로 보내기
  skipToFinal: () => void
  finalize: (content: string) => void
  chooseSubject: (subject: Subject) => void
  resolve: () => void
  escalate?: () => void
  retry: () => void
  requestCounseling: (revealName: boolean) => void
}

type Props = {
  content: AiContent
  // false면 지난 말풍선: 버튼·입력칸을 숨기고 내용만 보여준다
  active: boolean
  actions: ChatActions
}

// AI 말풍선 껍데기
export function AiBubble({ children, tone }: { children: ReactNode; tone?: 'warning' | 'danger' }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary-500 to-primary-700 text-[11px] font-extrabold tracking-wide text-white shadow-sm">
        AI
      </span>
      <div
        className={cn(
          'min-w-0 flex-1 rounded-[20px] rounded-tl-md px-4 py-3',
          tone === 'warning'
            ? 'bg-warning-soft'
            : tone === 'danger'
              ? 'bg-danger-soft'
              : 'border border-line/70 bg-surface shadow-card',
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function TypingBubble({ label }: { label: string }) {
  return (
    <AiBubble>
      <p className="flex items-center gap-2 text-muted">
        <span className="flex gap-1">
          {[0, 150, 300].map((d) => (
            <span key={d} className="size-1.5 animate-bounce rounded-full bg-primary-500" style={{ animationDelay: `${d}ms` }} />
          ))}
        </span>
        {label}
      </p>
    </AiBubble>
  )
}

// AI 문구 표시: 줄바꿈을 살리고 **굵게**만 처리한다
function Rich({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-line">
      {text.split('**').map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>))}
    </p>
  )
}

// 진행 단계 표시: 막힌 곳 찾기 → 구체화하기 → 질문 고르기
function StepLabel({ step }: { step: 1 | 2 | 3 }) {
  const labels = ['막힌 곳 찾기', '구체화하기', '질문 고르고 고치기']
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="rounded-full bg-primary-50 px-2 py-0.5 text-caption font-bold text-primary-600">
        질문 다듬기 {step}/3
      </span>
      <span className="text-caption font-semibold text-ink">{labels[step - 1]}</span>
    </div>
  )
}

export default function AiMessage({ content, active, actions }: Props) {
  const navigate = useNavigate()

  switch (content.kind) {
    // 1단계: 막힌 곳 찾기
    case 'stuck':
      return (
        <AiBubble>
          <StepLabel step={1} />
          <Rich text={content.prompt} />
          {active && content.examples.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5">
              <p className="text-caption text-muted">이런 식으로 답해도 돼요 (누르면 아래 입력창에 채워져요)</p>
              {content.examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => actions.fillComposer(ex)}
                  className="rounded-2xl border border-line bg-page px-3 py-2 text-left text-caption text-ink transition-colors hover:border-primary-200 hover:bg-primary-50"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
          {active && <p className="mt-2 text-caption text-muted">아래 입력창에 편하게 적어 주세요.</p>}
          {active && <SkipButton onClick={actions.skipToFinal} />}
        </AiBubble>
      )

    // 2단계: 구체화하기
    case 'example':
      return (
        <AiBubble>
          <StepLabel step={2} />
          <Rich text={content.prompt} />
          {active && <p className="mt-2 text-caption text-muted">아래 입력창에 실제 문장이나 문제를 그대로 적어 주세요.</p>}
          {active && <SkipButton onClick={actions.skipToFinal} />}
        </AiBubble>
      )

    // 건너뛰기: 지금까지 답한 내용으로 AI가 만든 질문 하나 → 고쳐서 보내기
    case 'suggested':
      return (
        <AiBubble>
          <p>지금까지 이야기한 내용으로 질문을 정리했어요. 필요하면 고쳐서 보내 주세요.</p>
          {active ? (
            <SuggestionBox suggestion={content.suggestion} onSend={actions.finalize} />
          ) : (
            <p className="mt-2 rounded-2xl bg-page p-3 text-ink">{content.suggestion}</p>
          )}
        </AiBubble>
      )

    // 3단계: 질문 틀 보여주기 → 학생이 고르고 고치기
    case 'pick':
      return (
        <AiBubble>
          <StepLabel step={3} />
          <Rich text={content.prompt} />
          {active && <CandidatePicker candidates={content.candidates} onSend={actions.finalize} />}
        </AiBubble>
      )

    case 'needs_subject':
      return (
        <AiBubble>
          <p>어느 과목 질문인가요? 고르면 그 과목 선생님께 보낼게요.</p>
          {active && <SubjectPicker getSubjects={actions.getSubjects} onChoose={actions.chooseSubject} />}
        </AiBubble>
      )

    case 'assigned':
      if (content.crisisMessage) {
        return (
          <AiBubble tone="warning">
            <p>{content.crisisMessage}</p>
            <div className="mt-3">
              <HotlineCard />
            </div>
          </AiBubble>
        )
      }
      return (
        <AiBubble>
          <p>
            <b>{content.toLabel}</b> 질문함으로 보냈어요. 답이 오면 알려줄게요.
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => navigate(ROUTES.STUDENT.QUESTION_DETAIL(content.questionId))}
          >
            내 질문 보기
          </Button>
        </AiBubble>
      )

    case 'notice_answered':
      return (
        <AiBubble>
          <p className="whitespace-pre-line">{content.answer}</p>
          <SourceList sources={content.sources} />
          {active && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={actions.resolve}>
                해결됐어요
              </Button>
              {content.canEscalate && actions.escalate && (
                <Button size="sm" variant="secondary" onClick={actions.escalate}>
                  선생님께 물어볼래요
                </Button>
              )}
            </div>
          )}
        </AiBubble>
      )

    case 'failed':
      return (
        <AiBubble>
          <p>질문을 처리하다 잠깐 문제가 생겼어요. 쓴 내용은 저장돼 있으니 다시 시도해 볼까요?</p>
          {active && (
            <Button size="sm" className="mt-3" onClick={actions.retry}>
              다시 시도하기
            </Button>
          )}
        </AiBubble>
      )

    case 'blocked':
      return (
        <AiBubble tone="danger">
          <p className="font-semibold text-danger">이 질문은 보내지 않았어요</p>
          <p className="mt-1">{content.reason}</p>
        </AiBubble>
      )

    case 'crisis':
      return (
        <AiBubble tone="warning">
          <p>
            이야기해 줘서 고마워요. 이 내용은 챗봇 대신 <b>담임·상담 선생님께 바로</b> 전할게요.
          </p>
          {active && (
            <>
              <p className="mt-2 text-caption text-muted">선생님이 먼저 연락할 수 있게 이름을 알려도 괜찮을까요?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => actions.requestCounseling(true)}>
                  이름을 알리고 연락받기
                </Button>
                <Button size="sm" variant="secondary" onClick={() => actions.requestCounseling(false)}>
                  익명으로 알리기만 하기
                </Button>
              </div>
            </>
          )}
          <div className="mt-3">
            <HotlineCard />
          </div>
        </AiBubble>
      )

    case 'crisis_sent':
      return (
        <AiBubble tone="warning">
          <p>담임·상담 선생님께 바로 알렸어요. 곧 선생님이 먼저 연락할 거예요.</p>
        </AiBubble>
      )

    case 'resolved':
      return (
        <AiBubble>
          <p>도움이 됐다니 다행이에요. 또 궁금한 게 있으면 언제든 물어보세요.</p>
        </AiBubble>
      )

    case 'other':
      return (
        <AiBubble>
          <p>질문을 받았어요. 진행 상황은 내 질문에서 확인할 수 있어요.</p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => navigate(ROUTES.STUDENT.QUESTION_DETAIL(content.questionId))}
          >
            내 질문 보기
          </Button>
        </AiBubble>
      )

    case 'error':
      return (
        <AiBubble tone="danger">
          <p className="text-danger">{content.message}</p>
        </AiBubble>
      )
  }
}

// 1·2단계 말풍선 아래: 남은 단계를 건너뛰고 바로 보내기
function SkipButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2">
      <p className="text-caption text-muted">이 정도면 충분하다면</p>
      <Button size="sm" variant="ghost" className="text-primary-600" onClick={onClick}>
        건너뛰고 바로 보내기 →
      </Button>
    </div>
  )
}

// 건너뛰기로 받은 추천 질문: 편집창에 채워서 고친 뒤 확정한다
function SuggestionBox({ suggestion, onSend }: { suggestion: string; onSend: (content: string) => void }) {
  const [draft, setDraft] = useState(suggestion)
  return (
    <div className="mt-3 flex flex-col gap-2">
      <TextArea label="AI가 정리한 질문" value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} />
      <Button size="sm" disabled={!draft.trim()} onClick={() => onSend(draft.trim())}>
        이 질문으로 보내기
      </Button>
    </div>
  )
}

// 질문 후보 카드 → 하나를 고르면 편집창에 채워지고, 고친 뒤 확정한다. 처음부터 직접 쓸 수도 있다.
function CandidatePicker({ candidates, onSend }: { candidates: QuestionCandidate[]; onSend: (content: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const select = (id: string, text: string) => {
    setSelectedId(id)
    setDraft(text)
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {candidates.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => select(c.id, c.question)}
          className={cn(
            'rounded-2xl border bg-page p-3 text-left transition-colors',
            selectedId === c.id ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-100' : 'border-line hover:border-primary-200',
          )}
        >
          <div className="mb-1 flex flex-wrap gap-1">
            <span className="rounded-md bg-primary-50 px-1.5 py-0.5 text-caption font-semibold text-primary-700">{c.type}</span>
            <span className="rounded-md bg-surface px-1.5 py-0.5 text-caption text-muted">{c.level}</span>
          </div>
          <p className="text-ink">{c.question}</p>
        </button>
      ))}
      <button
        type="button"
        onClick={() => select('custom', '')}
        className={cn(
          'rounded-2xl border border-dashed bg-page px-3 py-2 text-left text-caption',
          selectedId === 'custom' ? 'border-primary-600 text-primary-700' : 'border-line text-muted hover:border-primary-200 hover:text-ink',
        )}
      >
        + 마음에 드는 게 없으면 직접 쓸래요
      </button>

      {selectedId && (
        <div className="mt-1 flex flex-col gap-2">
          <TextArea
            label="내 상황에 맞게 고쳐 보세요"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder="선생님께 보낼 질문을 적어 주세요"
          />
          <Button size="sm" disabled={!draft.trim()} onClick={() => onSend(draft.trim())}>
            이 질문으로 보내기
          </Button>
        </div>
      )}
    </div>
  )
}

// 과목 고르기
function SubjectPicker({
  getSubjects,
  onChoose,
}: {
  getSubjects: () => Promise<Subject[]>
  onChoose: (subject: Subject) => void
}) {
  const [subjects, setSubjects] = useState<Subject[] | null>(null)
  const [error, setError] = useState<string | null>(null)

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
  }, [getSubjects])

  if (error) return <p className="mt-2 text-caption text-danger">{error}</p>
  if (!subjects) return <p className="mt-2 text-caption text-muted">과목 목록을 불러오고 있어요…</p>

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {subjects.map((s) => (
        <Button key={s.id} size="sm" variant="secondary" onClick={() => onChoose(s)}>
          {s.name}
        </Button>
      ))}
    </div>
  )
}
