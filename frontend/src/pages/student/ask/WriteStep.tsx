import Button from '../../../components/Button'
import Card from '../../../components/Card'
import Checkbox from '../../../components/Checkbox'
import { TextArea } from '../../../components/TextField'

type Props = {
  text: string
  onTextChange: (text: string) => void
  // 익명 체크박스 (백엔드가 익명을 지원하지 않으면 넘기지 않는다)
  anonymous?: { value: boolean; onChange: (value: boolean) => void }
  // 욕설·비방으로 걸렸을 때 이유
  blockedReason: string | null
  // 있으면 [챗봇에게] [선생님께] 두 버튼, 없으면 [질문 보내기] 하나 (AI가 공지로 답할지 판단)
  onAskChatbot?: () => void
  onAskTeacher: () => void
}

export default function WriteStep({ text, onTextChange, anonymous, blockedReason, onAskChatbot, onAskTeacher }: Props) {
  const canSubmit = text.trim().length > 0

  return (
    <div className="flex flex-col gap-4">
      <h1>질문하기</h1>

      <TextArea
        label="무엇이 궁금한가요?"
        placeholder="예: 체험학습 신청서 언제까지 내요?"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        rows={5}
        maxLength={500}
      />

      {anonymous && (
        <Checkbox
          label="익명 (학년·반만 보임)"
          checked={anonymous.value}
          onChange={(e) => anonymous.onChange(e.target.checked)}
        />
      )}

      {blockedReason && (
        <Card className="border-danger bg-danger-soft">
          <p className="font-semibold text-danger">이 질문은 보내지 않았어요</p>
          <p className="mt-1 text-caption text-ink">{blockedReason}</p>
        </Card>
      )}

      {onAskChatbot ? (
        <div className="flex flex-col gap-2">
          <Button variant="secondary" fullWidth disabled={!canSubmit} onClick={onAskChatbot}>
            챗봇에게 질문하기
          </Button>
          <Button fullWidth disabled={!canSubmit} onClick={onAskTeacher}>
            선생님께 질문하기
          </Button>
          <p className="text-center text-caption text-muted">
            챗봇은 공지와 선생님이 승인한 답에서 찾아 바로 알려줘요
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button fullWidth disabled={!canSubmit} onClick={onAskTeacher}>
            질문 보내기
          </Button>
          <p className="text-center text-caption text-muted">
            AI가 공지에서 답을 먼저 찾고, 없으면 담당 선생님께 전해 줘요
          </p>
        </div>
      )}
    </div>
  )
}
