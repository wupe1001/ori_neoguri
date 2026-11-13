import Button from '../../../components/Button'
import Card from '../../../components/Card'
import type { ChatbotReply } from '../../../types/question'
import SourceList from '../../../components/SourceList'

type Props = {
  question: string
  reply: ChatbotReply
  onResolved: () => void
  // 없으면 [선생님께 넘기기]를 숨긴다 (실제 백엔드는 공지로 답한 뒤 넘기는 기능이 없다)
  onAskTeacher?: () => void
}

export default function ChatbotStep({ question, reply, onResolved, onAskTeacher }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <h1>챗봇 답</h1>

      <Card title="내 질문">
        <p>{question}</p>
      </Card>

      {reply.answer ? (
        <Card title="챗봇" className="border-primary-200 bg-primary-50">
          <p>{reply.answer}</p>
          <SourceList sources={reply.sources} />
        </Card>
      ) : (
        <Card>
          <p>공지나 선생님이 승인한 답에서 근거를 찾지 못했어요.</p>
          <p className="mt-1 text-caption text-muted">선생님께 넘기면 담당 선생님이 직접 답해 줄 거예요.</p>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {reply.answer && (
          <Button fullWidth onClick={onResolved}>
            해결됐어요
          </Button>
        )}
        {onAskTeacher ? (
          <Button variant={reply.answer ? 'secondary' : 'primary'} fullWidth onClick={onAskTeacher}>
            선생님께 넘기기
          </Button>
        ) : (
          <p className="text-center text-caption text-muted">
            답이 부족하면 더 구체적으로 다시 질문해 주세요. 공지에 없는 내용은 선생님께 전달돼요.
          </p>
        )}
      </div>
    </div>
  )
}
