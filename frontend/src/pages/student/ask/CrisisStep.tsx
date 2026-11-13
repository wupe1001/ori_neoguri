import { useState } from 'react'
import Button from '../../../components/Button'
import Card from '../../../components/Card'

type Props = {
  isAnonymous: boolean
  onBack: () => void
}

// 고민·위기 신호: AI 답 없이 담임·상담 선생님께 연결한다.
export default function CrisisStep({ isAnonymous, onBack }: Props) {
  const [requested, setRequested] = useState(false)

  // TODO(백엔드): 상담 연결 요청 API. 지금은 화면만 바뀐다.
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
        이야기해 줘서 고마워요. 이 질문은 챗봇이나 질문함 대신 <b>담임·상담 선생님께 바로</b> 전할게요.
      </p>

      {isAnonymous && (
        <Card className="border-warning bg-warning-soft">
          <p className="text-caption text-ink">
            지금은 익명이라 선생님이 누구인지 알 수 없어요. 연락을 받으려면 이름을 알려도 괜찮은지 선택해 주세요.
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        <Button fullWidth onClick={() => setRequested(true)}>
          {isAnonymous ? '이름을 알리고 연락받기' : '상담 선생님께 연결하기'}
        </Button>
        {isAnonymous && (
          <Button variant="secondary" fullWidth onClick={() => setRequested(true)}>
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

function HotlineCard() {
  return (
    <Card title="지금 바로 이야기하고 싶다면">
      <ul className="flex flex-col gap-1">
        <li>
          청소년 상담{' '}
          <a href="tel:1388" className="font-semibold text-primary-700">
            1388
          </a>
        </li>
        <li>
          자살예방 상담{' '}
          <a href="tel:109" className="font-semibold text-primary-700">
            109
          </a>
        </li>
      </ul>
      <p className="mt-2 text-caption text-muted">24시간, 익명으로 이야기할 수 있어요</p>
    </Card>
  )
}
