import type { KeyboardEvent } from 'react'
import { cn } from '../../../components/cn'

type Props = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
  placeholder?: string
  // 첫 화면에서는 크게, 대화 중에는 한 줄로
  size?: 'large' | 'compact'
  // 익명 토글 (지원할 때만)
  anonymous?: { value: boolean; onChange: (value: boolean) => void }
}

// 질문 입력창: Enter로 보내고 Shift+Enter로 줄을 바꾼다
export default function Composer({ value, onChange, onSend, disabled, placeholder, size = 'compact', anonymous }: Props) {
  const canSend = value.trim().length > 0 && !disabled

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 한글 입력 중(조합 중)의 Enter는 무시한다
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (canSend) onSend()
    }
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-surface shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100',
        size === 'large' ? 'p-3' : 'p-2',
      )}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? '궁금한 걸 물어보세요'}
        rows={size === 'large' ? 3 : 1}
        maxLength={500}
        disabled={disabled}
        className="block w-full resize-none bg-transparent px-1 text-body text-ink placeholder:text-muted focus:outline-none"
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        {anonymous ? (
          <button
            type="button"
            onClick={() => anonymous.onChange(!anonymous.value)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-caption',
              anonymous.value ? 'border-primary-600 bg-primary-50 font-semibold text-primary-700' : 'border-line text-muted',
            )}
          >
            {anonymous.value ? '익명 켜짐' : '익명 꺼짐'}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          aria-label="보내기"
          className="flex size-9 items-center justify-center rounded-full bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:bg-line disabled:text-muted"
        >
          ↑
        </button>
      </div>
    </div>
  )
}
