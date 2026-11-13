import { useNavigate } from 'react-router'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import HotlineCard from '../../../components/HotlineCard'
import StatusBadge from '../../../components/StatusBadge'
import { ROUTES } from '../../../routes'

type Props =
  | {
      kind: 'sent'
      questionId: string
      // 누구에게 갔는지 (예: "수학 선생님"). 없으면 "담당 선생님"
      toLabel?: string
      // 고민·위기 신호로 담임 선생님께 바로 간 경우 백엔드가 주는 안내 문구
      crisisMessage?: string | null
      onRestart: () => void
    }
  | { kind: 'resolved'; onRestart: () => void }

// 전송 완료 또는 챗봇으로 해결
export default function DoneStep(props: Props) {
  const navigate = useNavigate()

  if (props.kind === 'resolved') {
    return (
      <div className="flex flex-col gap-4">
        <h1>해결됐어요</h1>
        <Card>
          <p>도움이 됐다니 다행이에요. 질문 기록은 남겨둘게요.</p>
        </Card>
        <Button fullWidth onClick={props.onRestart}>
          새 질문하기
        </Button>
      </div>
    )
  }

  const goDetail = () => navigate(ROUTES.STUDENT.QUESTION_DETAIL(props.questionId))

  // 고민·위기 신호: 담임 선생님께 바로 전달
  if (props.crisisMessage) {
    return (
      <div className="flex flex-col gap-4">
        <h1>담임 선생님께 전했어요</h1>
        <Card className="border-warning bg-warning-soft">
          <p className="text-ink">{props.crisisMessage}</p>
        </Card>
        <HotlineCard />
        <Button fullWidth onClick={goDetail}>
          내 질문 보기
        </Button>
        <Button variant="ghost" fullWidth onClick={props.onRestart}>
          처음으로
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1>선생님께 보냈어요</h1>
      <Card>
        <div className="flex items-center justify-between gap-2">
          <p>{props.toLabel ?? '담당 선생님'} 질문함으로 보냈어요.</p>
          {/* 실제 백엔드는 보내는 즉시 담당 선생님께 배정(전달됨), 목업은 접수 상태로 시작 */}
          <StatusBadge status={props.toLabel ? 'forwarded' : 'received'} />
        </div>
        <p className="mt-2 text-caption text-muted">답이 오면 알려줄게요. 비슷한 질문을 한 친구가 있으면 같은 답을 함께 받아요.</p>
      </Card>
      <Button fullWidth onClick={goDetail}>
        내 질문 보기
      </Button>
      <Button variant="ghost" fullWidth onClick={props.onRestart}>
        새 질문하기
      </Button>
    </div>
  )
}
