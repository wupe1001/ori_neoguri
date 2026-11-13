import Button from '../../../components/Button'
import Card from '../../../components/Card'
import { Input } from '../../../components/TextField'
import type { FiveW1H } from '../../../types/question'

const FIELDS: { key: keyof FiveW1H; label: string; placeholder: string }[] = [
  { key: 'who', label: '누가', placeholder: '' },
  { key: 'when', label: '언제', placeholder: '예: 11월 20일' },
  { key: 'where', label: '어디서', placeholder: '예: 제주도' },
  { key: 'what', label: '무엇을', placeholder: '' },
  { key: 'how', label: '어떻게', placeholder: '예: 종이로? 앱으로?' },
  { key: 'why', label: '왜', placeholder: '예: 가족 여행' },
]

type Props = {
  // AI가 처음 정리한 내용. 여기서 null이었던 칸만 입력창으로 보여준다.
  aiResult: FiveW1H
  values: FiveW1H
  onChange: (values: FiveW1H) => void
  onNext: () => void
  onBack: () => void
}

export default function RefineStep({ aiResult, values, onChange, onNext, onBack }: Props) {
  const blanks = FIELDS.filter((f) => aiResult[f.key] === null)
  const filled = FIELDS.filter((f) => aiResult[f.key] !== null)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1>질문을 정리했어요</h1>
        <p className="mt-1 text-muted">선생님이 한 번에 이해할 수 있게 육하원칙으로 나눴어요.</p>
      </div>

      <Card title="AI가 정리한 내용">
        <dl className="grid grid-cols-[4rem_1fr] gap-y-2">
          {filled.map((f) => (
            <div key={f.key} className="contents">
              <dt className="text-caption font-semibold text-muted">{f.label}</dt>
              <dd>{aiResult[f.key]}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {blanks.length > 0 && (
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">빠진 칸을 채워 주세요</h2>
            <p className="text-caption text-muted">해당하지 않으면 비워둬도 돼요</p>
          </div>
          {blanks.map((f) => (
            <Input
              key={f.key}
              label={f.label}
              placeholder={f.placeholder}
              value={values[f.key] ?? ''}
              onChange={(e) => onChange({ ...values, [f.key]: e.target.value || null })}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button fullWidth onClick={onNext}>
          다음
        </Button>
        <Button variant="ghost" fullWidth onClick={onBack}>
          질문 다시 쓰기
        </Button>
      </div>
    </div>
  )
}
