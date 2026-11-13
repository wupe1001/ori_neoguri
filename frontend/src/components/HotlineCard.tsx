import Card from './Card'

// 고민·위기 상황에서 바로 연락할 수 있는 상담 전화
export default function HotlineCard() {
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
