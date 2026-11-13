import { useState } from 'react'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import { TextArea } from '../../../components/TextField'

type Props = {
  rewrittenText: string
  isAnonymous: boolean
  // 선생님께 보이는 이름 (예: "2학년 3반 오리")
  authorLabel: string
  sending: boolean
  onSend: (finalText: string) => void
  onBack: () => void
}

// "이렇게 보낼까요?" → 이대로 보내기 / 직접 고치기
export default function ConfirmStep({ rewrittenText, isAnonymous, authorLabel, sending, onSend, onBack }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(rewrittenText)

  return (
    <div className="flex flex-col gap-4">
      <h1>이렇게 보낼까요?</h1>

      {editing ? (
        <TextArea label="직접 고치기" value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} />
      ) : (
        <Card title="AI가 다시 쓴 질문" className="border-primary-200 bg-primary-50">
          <p>{rewrittenText}</p>
        </Card>
      )}

      <p className="text-caption text-muted">
        선생님께는 <b className="text-ink">{authorLabel}</b>(으)로 보여요.
        {isAnonymous && ' 익명이라 닉네임은 보이지 않아요.'}
      </p>

      <div className="flex flex-col gap-2">
        {editing ? (
          <>
            <Button fullWidth disabled={!draft.trim() || sending} onClick={() => onSend(draft.trim())}>
              {sending ? '보내는 중…' : '고친 대로 보내기'}
            </Button>
            <Button variant="ghost" fullWidth onClick={() => setEditing(false)}>
              AI가 쓴 질문으로 돌아가기
            </Button>
          </>
        ) : (
          <>
            <Button fullWidth disabled={sending} onClick={() => onSend(rewrittenText)}>
              {sending ? '보내는 중…' : '이대로 보내기'}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setEditing(true)}>
              직접 고치기
            </Button>
            <Button variant="ghost" fullWidth onClick={onBack}>
              빈칸 다시 채우기
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
