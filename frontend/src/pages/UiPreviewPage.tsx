import Button from '../components/Button'
import Card from '../components/Card'
import Checkbox from '../components/Checkbox'
import StatusBadge from '../components/StatusBadge'
import { Input, TextArea } from '../components/TextField'

// 개발용: 공용 컴포넌트를 한눈에 확인하는 화면. 시연 전에 라우트에서 빼도 된다.
export default function UiPreviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-col gap-6 p-4">
      <h1>공용 컴포넌트</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-caption font-semibold text-muted">Button</h2>
        <Button fullWidth>선생님께 질문하기</Button>
        <Button variant="secondary" fullWidth>
          챗봇에게 질문하기
        </Button>
        <div className="flex gap-2">
          <Button size="sm">승인</Button>
          <Button size="sm" variant="secondary">
            넘기기
          </Button>
          <Button size="sm" variant="ghost">
            취소
          </Button>
          <Button size="sm" variant="danger">
            상담 연결
          </Button>
          <Button size="sm" disabled>
            비활성
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-caption font-semibold text-muted">StatusBadge</h2>
        <div className="flex gap-2">
          <StatusBadge status="received" />
          <StatusBadge status="forwarded" />
          <StatusBadge status="answered" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-caption font-semibold text-muted">TextField · Checkbox</h2>
        <TextArea label="질문" placeholder="궁금한 걸 적어 주세요" />
        <Input label="언제" placeholder="예: 11월 20일" hint="빠진 칸만 채우면 돼요" />
        <Checkbox label="익명 (학년·반만 보임)" />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-caption font-semibold text-muted">Card</h2>
        <Card title="AI 답 초안">
          <p>체험학습 신청서는 11월 15일까지 앱으로 제출하면 돼요.</p>
        </Card>
        <Card className="border-danger bg-danger-soft">
          <p className="font-semibold text-danger">위기 신호가 감지된 질문이 있어요</p>
        </Card>
      </section>
    </main>
  )
}
