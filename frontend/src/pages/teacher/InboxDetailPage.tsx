import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { findSimilarQuestions, getAnswerDraft, recommendDepartment } from '../../api/ai'
import { approveAnswer, CAN_FORWARD, forwardQuestion, getTeacherQuestion } from '../../api/questions'
import Button from '../../components/Button'
import Card from '../../components/Card'
import Checkbox from '../../components/Checkbox'
import CategoryBadge from '../../components/CategoryBadge'
import { cn } from '../../components/cn'
import Loading from '../../components/Loading'
import SourceList from '../../components/SourceList'
import StatusBadge from '../../components/StatusBadge'
import { Input, TextArea } from '../../components/TextField'
import { answerAuthor, authorLabel, timeAgo } from '../../lib/format'
import { ROUTES } from '../../routes'
import { useTeacher } from '../../session/session'
import type { AnswerDraft, FiveW1H, Question } from '../../types/question'
import type { Department } from '../../types/user'

const FIVE_W1H_LABELS: [keyof FiveW1H, string][] = [
  ['who', '누가'],
  ['when', '언제'],
  ['where', '어디서'],
  ['what', '무엇을'],
  ['how', '어떻게'],
  ['why', '왜'],
]
const DEPARTMENTS: Department[] = ['교무부', '학생부', '행정실', '상담실']

export default function InboxDetailPage() {
  const { id = '' } = useParams()
  const teacher = useTeacher()
  const navigate = useNavigate()

  const [question, setQuestion] = useState<Question | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState<AnswerDraft | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [mode, setMode] = useState<'answer' | 'forward'>('answer')
  const [saving, setSaving] = useState(false)
  const [justAnswered, setJustAnswered] = useState<number | null>(null) // 함께 답한 질문 수
  const [actionError, setActionError] = useState<string | null>(null)
  // 아직 답하지 않은 비슷한 질문. 승인하면 선택한 질문에도 같은 답이 간다
  const [similar, setSimilar] = useState<Question[]>([])
  const [alsoIds, setAlsoIds] = useState<string[]>([])

  // 질문을 불러오고, 아직 답하지 않았으면 AI 답 초안과 비슷한 질문도 불러온다
  useEffect(() => {
    let cancelled = false
    getTeacherQuestion(id)
      .then(async (q) => {
        if (cancelled) return
        setQuestion(q)
        if (q.status === 'answered') return
        const [d, similarList] = await Promise.all([getAnswerDraft(q.rewrittenText), findSimilarQuestions(q.id)])
        if (cancelled) return
        setDraft(d)
        setAnswerText(d.text)
        setSimilar(similarList)
        setAlsoIds(similarList.map((x) => x.id))
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loadError) return <p className="py-16 text-center text-muted">{loadError}</p>
  if (!question) return <Loading message="질문을 불러오고 있어요…" />

  const handleApprove = async () => {
    setSaving(true)
    try {
      setActionError(null)
      setQuestion(await approveAnswer(question.id, teacher, answerText.trim(), draft?.sources ?? [], alsoIds))
      setJustAnswered(alsoIds.length)
      window.scrollTo({ top: 0 })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '답을 보내지 못했어요. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  const handleForward = async (department: Department, reason: string) => {
    setSaving(true)
    try {
      await forwardQuestion(question.id, department, reason)
      navigate(ROUTES.TEACHER.INBOX, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => navigate(-1)} className="self-start text-caption text-muted">
        ← 질문함
      </button>

      {actionError && <p className="rounded-xl bg-danger-soft p-3 text-caption text-danger">{actionError}</p>}

      {justAnswered !== null && (
        <p className="rounded-xl bg-success-soft p-3 text-caption text-success">
          답을 보냈어요. 학생 화면에 '답변 완료'로 표시돼요.
          {justAnswered > 0 && ` 비슷한 질문 ${justAnswered}개에도 같은 답을 함께 보냈어요.`}
        </p>
      )}

      {/* 질문 정보 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <CategoryBadge category={question.category} />
          {question.subjectName && <span className="text-caption font-semibold text-primary-700">{question.subjectName}</span>}
          <StatusBadge status={question.status} />
        </div>
        <p className="text-caption text-muted">
          {authorLabel(question.author)} · {timeAgo(question.createdAt)}
        </p>
      </div>

      <Card title="질문" className="border-primary-200 bg-primary-50">
        <p>{question.rewrittenText}</p>
        {question.originalText && question.originalText !== question.rewrittenText && (
          <p className="mt-2 text-caption text-muted">학생이 처음 쓴 질문: {question.originalText}</p>
        )}
      </Card>

      {/* 정보가 충분해서 육하원칙을 거치지 않은 질문은 칸이 모두 비어 있다 */}
      {Object.values(question.fiveW1H).some(Boolean) && (
        <Card title="육하원칙으로 정리">
          <dl className="grid grid-cols-[4rem_1fr] gap-y-1.5">
            {FIVE_W1H_LABELS.map(([key, label]) => (
              <div key={key} className="contents">
                <dt className="text-caption font-semibold text-muted">{label}</dt>
                <dd className={cn(!question.fiveW1H[key] && 'text-muted')}>{question.fiveW1H[key] ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {question.forwardReason && (
        <Card title="넘어온 사유" className="border-warning bg-warning-soft">
          <p>{question.forwardReason}</p>
        </Card>
      )}

      {/* 답변 완료: 보낸 답 */}
      {question.answer ? (
        <Card title={`보낸 답 · ${answerAuthor(question.answer)}`} className="border-success bg-success-soft">
          <p className="whitespace-pre-line">{question.answer.text}</p>
          <SourceList sources={question.answer.sources} />
        </Card>
      ) : question.status === 'answered' ? (
        // 실제 백엔드는 교사 화면에 보낸 답 내용을 주지 않는다
        <Card className="border-success bg-success-soft">
          <p className="font-semibold text-success">이미 답을 보낸 질문이에요</p>
        </Card>
      ) : !draft ? (
        <Loading message="AI가 답 초안을 쓰고 있어요…" />
      ) : mode === 'answer' ? (
        <AnswerPanel
          draft={draft}
          value={answerText}
          onChange={setAnswerText}
          similar={similar}
          alsoIds={alsoIds}
          onAlsoIdsChange={setAlsoIds}
          saving={saving}
          onApprove={handleApprove}
          onForward={CAN_FORWARD ? () => setMode('forward') : undefined}
        />
      ) : (
        <ForwardPanel
          questionText={question.rewrittenText}
          saving={saving}
          onForward={handleForward}
          onCancel={() => setMode('answer')}
        />
      )}
    </div>
  )
}

type AnswerPanelProps = {
  draft: AnswerDraft
  value: string
  onChange: (value: string) => void
  similar: Question[]
  alsoIds: string[]
  onAlsoIdsChange: (ids: string[]) => void
  saving: boolean
  onApprove: () => void
  // 없으면 [다른 부서로 넘기기]를 숨긴다 (실제 백엔드에 아직 없음)
  onForward?: () => void
}

// 내 담당이면: AI 초안을 검토하고 고친 뒤 승인
function AnswerPanel({
  draft,
  value,
  onChange,
  similar,
  alsoIds,
  onAlsoIdsChange,
  saving,
  onApprove,
  onForward,
}: AnswerPanelProps) {
  const toggle = (qid: string) =>
    onAlsoIdsChange(alsoIds.includes(qid) ? alsoIds.filter((x) => x !== qid) : [...alsoIds, qid])

  return (
    <div className="flex flex-col gap-3">
      <TextArea
        label={draft.text ? 'AI 답 초안 (고쳐서 보낼 수 있어요)' : '답 작성'}
        hint={draft.text ? undefined : '관련 공지나 승인된 답을 찾지 못했어요. 직접 작성해 주세요.'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
      />
      {draft.sources.length > 0 && (
        <Card>
          <SourceList sources={draft.sources} />
        </Card>
      )}
      {similar.length > 0 && (
        <Card title={`AI가 찾은 비슷한 질문 ${similar.length}개 · 같은 답을 함께 보내요`}>
          <ul className="flex flex-col gap-2">
            {similar.map((q) => (
              <li key={q.id} className="flex flex-col gap-0.5">
                <Checkbox
                  label={authorLabel(q.author)}
                  checked={alsoIds.includes(q.id)}
                  onChange={() => toggle(q.id)}
                />
                <p className="line-clamp-2 pl-6 text-caption text-muted">{q.rewrittenText}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Button fullWidth disabled={!value.trim() || saving} onClick={onApprove}>
        {saving ? '보내는 중…' : alsoIds.length > 0 ? `승인하고 ${alsoIds.length + 1}명에게 보내기` : '승인하고 보내기'}
      </Button>
      {onForward && (
        <Button variant="secondary" fullWidth disabled={saving} onClick={onForward}>
          내 담당이 아니에요 · 다른 부서로 넘기기
        </Button>
      )}
    </div>
  )
}

type ForwardPanelProps = {
  questionText: string
  saving: boolean
  onForward: (department: Department, reason: string) => void
  onCancel: () => void
}

// 내 담당이 아니면: AI 추천 부서를 확인하고 사유 한 줄과 함께 넘긴다
function ForwardPanel({ questionText, saving, onForward, onCancel }: ForwardPanelProps) {
  const [recommended, setRecommended] = useState<{ department: Department; reason: string } | null>(null)
  const [department, setDepartment] = useState<Department | null>(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    let cancelled = false
    recommendDepartment(questionText).then((r) => {
      if (cancelled) return
      setRecommended(r)
      setDepartment(r.department)
    })
    return () => {
      cancelled = true
    }
  }, [questionText])

  if (!recommended) return <Loading message="AI가 맞는 부서를 찾고 있어요…" />

  return (
    <Card title="다른 부서로 넘기기">
      <p className="text-caption text-muted">
        AI 추천: <b className="text-primary-700">{recommended.department}</b> · {recommended.reason}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {DEPARTMENTS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDepartment(d)}
            className={cn(
              'rounded-xl border py-2 text-body',
              department === d ? 'border-primary-600 bg-primary-50 font-semibold text-primary-700' : 'border-line',
            )}
          >
            {d}
            {d === recommended.department && <span className="ml-1 text-caption">(추천)</span>}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <Input
          label="사유 한 줄"
          placeholder={recommended.reason}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          hint="학생에게는 '○○부로 전달됨'으로 알려줘요"
        />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Button
          fullWidth
          disabled={!department || saving}
          onClick={() => department && onForward(department, reason.trim() || recommended.reason)}
        >
          {saving ? '넘기는 중…' : `${department ?? ''}로 넘기기`}
        </Button>
        <Button variant="ghost" fullWidth onClick={onCancel}>
          취소
        </Button>
      </div>
    </Card>
  )
}
