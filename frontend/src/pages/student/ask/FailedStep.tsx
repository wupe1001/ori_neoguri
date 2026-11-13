import Button from '../../../components/Button'
import Card from '../../../components/Card'

type Props = {
  retrying: boolean
  onRetry: () => void
  onRestart: () => void
}

// AI 처리에 실패했을 때: 실패한 단계부터 다시 시도한다
export default function FailedStep({ retrying, onRetry, onRestart }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <h1>잠깐 문제가 생겼어요</h1>
      <Card>
        <p>AI가 질문을 처리하다 멈췄어요. 쓴 질문은 저장돼 있으니 다시 시도해 주세요.</p>
      </Card>
      <Button fullWidth disabled={retrying} onClick={onRetry}>
        {retrying ? '다시 시도하는 중…' : '다시 시도하기'}
      </Button>
      <Button variant="ghost" fullWidth onClick={onRestart}>
        처음으로
      </Button>
    </div>
  )
}
