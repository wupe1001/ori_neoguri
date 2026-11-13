import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import type { Subject } from '../../../api/backend/types'
import Button from '../../../components/Button'
import { cn } from '../../../components/cn'
import HotlineCard from '../../../components/HotlineCard'
import SourceList from '../../../components/SourceList'
import { Input, TextArea } from '../../../components/TextField'
import { ROUTES } from '../../../routes'
import type { FiveW1H } from '../../../types/question'
import type { AiContent } from './types'

export type ChatActions = {
  requireAllDetails: boolean
  getSubjects: () => Promise<Subject[]>
  submitDetails: (f: FiveW1H) => void
  confirm: (content: string) => void
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
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-caption font-bold text-white">
        AI
      </span>
      <div
        className={cn(
          'min-w-0 flex-1 rounded-2xl rounded-tl-sm px-3.5 py-2.5',
          tone === 'warning' ? 'bg-warning-soft' : tone === 'danger' ? 'bg-danger-soft' : 'bg-page',
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

export default function AiMessage({ content, active, actions }: Props) {
  const navigate = useNavigate()

  switch (content.kind) {
    case 'needs_details':
      return (
        <AiBubble>
          <p>
            {content.askedAgain
              ? '아직 정보가 조금 부족해요. 아래 칸을 조금 더 구체적으로 채워 주세요.'
              : '선생님이 한 번에 이해할 수 있게 조금만 더 알려 주세요.'}
          </p>
          {active && <DetailsForm prefill={content.prefill} requireAll={actions.requireAllDetails} onSubmit={actions.submitDetails} />}
        </AiBubble>
      )

    case 'confirm':
      return (
        <AiBubble>
          <p>이렇게 정리해서 보낼까요?</p>
          <ConfirmBox rewritten={content.rewritten} active={active} onSend={actions.confirm} />
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
          <p>질문을 처리하다 잠깐 문제가 생겼어요. 쓴 질문은 저장돼 있으니 다시 시도해 볼까요?</p>
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

const FIELDS: { key: keyof FiveW1H; label: string; placeholder: string }[] = [
  { key: 'who', label: '누가', placeholder: '예: 저와 같은 반 학생들이' },
  { key: 'when', label: '언제', placeholder: '예: 11월 20일' },
  { key: 'where', label: '어디서', placeholder: '예: 제주도' },
  { key: 'what', label: '무엇을', placeholder: '예: 체험학습 신청서 제출을' },
  { key: 'how', label: '어떻게', placeholder: '예: 종이로? 앱으로?' },
  { key: 'why', label: '왜', placeholder: '예: 가족 여행' },
]

// 육하원칙 입력칸
function DetailsForm({
  prefill,
  requireAll,
  onSubmit,
}: {
  prefill: FiveW1H
  requireAll: boolean
  onSubmit: (f: FiveW1H) => void
}) {
  const [values, setValues] = useState<FiveW1H>(prefill)
  const allFilled = FIELDS.every((f) => values[f.key]?.trim())

  return (
    <div className="mt-3 flex flex-col gap-2">
      {FIELDS.map((f) => (
        <Input
          key={f.key}
          label={f.label}
          placeholder={f.placeholder}
          value={values[f.key] ?? ''}
          onChange={(e) => setValues({ ...values, [f.key]: e.target.value || null })}
        />
      ))}
      <p className="text-caption text-muted">
        {requireAll ? "모르거나 해당하지 않으면 '모름'이라고 적어 주세요" : '해당하지 않으면 비워둬도 돼요'}
      </p>
      <Button fullWidth size="sm" disabled={requireAll && !allFilled} onClick={() => onSubmit(values)}>
        다 채웠어요
      </Button>
    </div>
  )
}

// "이렇게 보낼까요?" → 이대로 보내기 / 직접 고치기
function ConfirmBox({ rewritten, active, onSend }: { rewritten: string; active: boolean; onSend: (content: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(rewritten)

  if (!active) {
    return <p className="mt-2 rounded-xl bg-surface p-3 text-ink">{rewritten}</p>
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {editing ? (
        <TextArea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} />
      ) : (
        <p className="rounded-xl border border-primary-200 bg-surface p-3 text-ink">{rewritten}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button size="sm" disabled={!draft.trim()} onClick={() => onSend(draft.trim())}>
              고친 대로 보내기
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              취소
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={() => onSend(rewritten)}>
              이대로 보내기
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              직접 고치기
            </Button>
          </>
        )}
      </div>
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
