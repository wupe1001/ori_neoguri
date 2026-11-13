import { useNavigate } from 'react-router'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import StatusBadge from '../../../components/StatusBadge'
import { ROUTES } from '../../../routes'

type Props =
  | { kind: 'sent'; questionId: string; onRestart: () => void }
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

  return (
    <div className="flex flex-col gap-4">
      <h1>선생님께 보냈어요</h1>
      <Card>
        <div className="flex items-center justify-between gap-2">
          <p>담당 선생님 질문함으로 보냈어요.</p>
          <StatusBadge status="received" />
        </div>
        <p className="mt-2 text-caption text-muted">답이 오면 알려줄게요. 같은 질문을 한 친구들도 함께 받아요.</p>
      </Card>
      <Button fullWidth onClick={() => navigate(ROUTES.STUDENT.QUESTION_DETAIL(props.questionId))}>
        내 질문 보기
      </Button>
      <Button variant="ghost" fullWidth onClick={props.onRestart}>
        새 질문하기
      </Button>
    </div>
  )
}
