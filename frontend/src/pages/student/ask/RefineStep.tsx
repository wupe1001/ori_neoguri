import Button from '../../../components/Button'
import Card from '../../../components/Card'
import { Input } from '../../../components/TextField'
import type { FiveW1H } from '../../../types/question'

const FIELDS: { key: keyof FiveW1H; label: string; placeholder: string }[] = [
  { key: 'who', label: '누가', placeholder: '예: 저와 같은 반 학생들이' },
  { key: 'when', label: '언제', placeholder: '예: 11월 20일' },
  { key: 'where', label: '어디서', placeholder: '예: 제주도' },
  { key: 'what', label: '무엇을', placeholder: '예: 체험학습 신청서 제출을' },
  { key: 'how', label: '어떻게', placeholder: '예: 종이로? 앱으로?' },
  { key: 'why', label: '왜', placeholder: '예: 가족 여행' },
]

type Props = {
  // AI가 처음 정리한 내용. 여기서 null이었던 칸만 입력창으로 보여준다.
  aiResult: FiveW1H
  values: FiveW1H
  onChange: (values: FiveW1H) => void
  // true면 빈칸을 모두 채워야 다음으로 갈 수 있다 (실제 백엔드는 여섯 칸 모두 필수)
  requireAll?: boolean
  // 이전에 채웠는데 AI가 다시 보완을 요청한 경우
  askedAgain?: boolean
  submitting?: boolean
  onNext: () => void
  onBack: () => void
}

export default function RefineStep({
  aiResult,
  values,
  onChange,
  requireAll,
  askedAgain,
  submitting,
  onNext,
  onBack,
}: Props) {
  const blanks = FIELDS.filter((f) => aiResult[f.key] === null)
  const filled = FIELDS.filter((f) => aiResult[f.key] !== null)
  const allFilled = blanks.every((f) => values[f.key]?.trim())

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1>{filled.length > 0 ? '질문을 정리했어요' : '조금만 더 알려 주세요'}</h1>
        <p className="mt-1 text-muted">선생님이 한 번에 이해할 수 있게 육하원칙으로 나눠요.</p>
      </div>

      {askedAgain && (
        <Card className="border-warning bg-warning-soft">
          <p className="text-caption text-ink">AI가 아직 정보가 부족하다고 판단했어요. 칸을 조금 더 구체적으로 채워 주세요.</p>
        </Card>
      )}

      {filled.length > 0 && (
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
      )}

      {blanks.length > 0 && (
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">{filled.length > 0 ? '빠진 칸을 채워 주세요' : '여섯 칸을 채워 주세요'}</h2>
            <p className="text-caption text-muted">
              {requireAll ? "모르거나 해당하지 않으면 '모름'이라고 적어 주세요" : '해당하지 않으면 비워둬도 돼요'}
            </p>
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
        <Button fullWidth disabled={(requireAll && !allFilled) || submitting} onClick={onNext}>
          {submitting ? 'AI가 질문을 다시 쓰고 있어요…' : '다음'}
        </Button>
        <Button variant="ghost" fullWidth onClick={onBack}>
          질문 다시 쓰기
        </Button>
      </div>
    </div>
  )
}
