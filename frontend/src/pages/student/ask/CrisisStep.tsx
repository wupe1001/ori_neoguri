import { useState } from 'react'
import { requestCounseling } from '../../../api/crisis'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import HotlineCard from '../../../components/HotlineCard'
import { useStudent } from '../../../session/session'

type Props = {
  // 학생이 쓴 내용 (홈의 "도움이 필요해요"에서 왔으면 빈 문자열)
  text: string
  isAnonymous: boolean
  onBack: () => void
}

// 고민·위기 신호: AI 답 없이 담임·상담 선생님께 바로 연결한다.
export default function CrisisStep({ text, isAnonymous, onBack }: Props) {
  const student = useStudent()
  const [requested, setRequested] = useState(false)
  const [sending, setSending] = useState(false)

  const request = async (revealName: boolean) => {
    setSending(true)
    try {
      await requestCounseling(student, text, revealName)
      setRequested(true)
    } finally {
      setSending(false)
    }
  }

  if (requested) {
    return (
      <div className="flex flex-col gap-4">
        <h1>연결을 요청했어요</h1>
        <Card>
          <p>담임·상담 선생님께 바로 알렸어요. 곧 선생님이 먼저 연락할 거예요.</p>
        </Card>
        <HotlineCard />
        <Button variant="ghost" fullWidth onClick={onBack}>
          처음으로
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1>많이 힘들었겠어요</h1>
      <p>
        이야기해 줘서 고마워요. 챗봇이나 질문함을 거치지 않고 <b>담임·상담 선생님께 바로</b> 전할게요.
      </p>

      {isAnonymous && (
        <Card className="border-warning bg-warning-soft">
          <p className="text-caption text-ink">
            익명이면 선생님이 누구인지 알 수 없어서 먼저 연락하기 어려워요. 이름을 알려도 괜찮은지 선택해 주세요.
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        <Button fullWidth disabled={sending} onClick={() => request(true)}>
          {isAnonymous ? '이름을 알리고 연락받기' : '상담 선생님께 연결하기'}
        </Button>
        {isAnonymous && (
          <Button variant="secondary" fullWidth disabled={sending} onClick={() => request(false)}>
            익명으로 알리기만 하기
          </Button>
        )}
      </div>

      <HotlineCard />

      <Button variant="ghost" fullWidth onClick={onBack}>
        돌아가기
      </Button>
    </div>
  )
}

