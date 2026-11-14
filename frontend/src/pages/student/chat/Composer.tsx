import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { PhotoButton, PickedPhotos } from '../../../components/Attachments'
import { addImages } from '../../../lib/attachments'
import { cn } from '../../../components/cn'

export type ChatMode = 'ai' | 'teacher'

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
  // AI 채팅 / 선생님 대화 전환. badge는 안 읽은 선생님 답 수
  mode?: { value: ChatMode; onChange: (value: ChatMode) => void; badge?: number }
  // 사진 첨부 (새 질문을 보낼 때만. 질문 다듬기 중에는 넘기지 않는다)
  attach?: { files: File[]; onChange: (files: File[]) => void }
}

// 질문 입력창: Enter로 보내고 Shift+Enter로 줄을 바꾼다
export default function Composer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  size = 'compact',
  anonymous,
  mode,
  attach,
}: Props) {
  const [attachError, setAttachError] = useState<string | null>(null)

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
        'rounded-[22px] border border-line bg-surface shadow-lg shadow-navy/5 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100',
        size === 'large' ? 'p-3' : 'p-2',
      )}
    >
      {attach && (
        <PickedPhotos
          files={attach.files}
          onRemove={(i) => {
            attach.onChange(attach.files.filter((_, j) => j !== i))
            setAttachError(null)
          }}
        />
      )}
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
      {attachError && <p className="px-1 pt-1 text-caption text-danger">{attachError}</p>}
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {attach && (
            <PhotoButton
              disabled={disabled}
              onPick={(picked) => {
                const { files, error } = addImages(attach.files, picked)
                attach.onChange(files)
                setAttachError(error)
              }}
            />
          )}
          {anonymous && (
            <button
              type="button"
              onClick={() => anonymous.onChange(!anonymous.value)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-caption',
                anonymous.value ? 'border-primary-600 bg-primary-50 font-semibold text-primary-700' : 'border-line text-muted hover:border-primary-200 hover:text-ink',
              )}
            >
              {anonymous.value ? '익명 켜짐' : '익명 꺼짐'}
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {mode && <ModeToggle {...mode} />}
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label="보내기"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white enabled:hover:-translate-y-px enabled:hover:bg-primary-700 enabled:hover:shadow-md enabled:hover:shadow-primary-600/30 disabled:bg-line disabled:text-muted"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}

const MODES = [
  ['ai', 'AI'],
  ['teacher', '선생님'],
] as const

// 화면이 바뀌면 입력창이 새로 그려지므로, 마지막 모드를 기억해 두고 그 자리에서 미끄러져 온다
// (방금 전환한 경우에만. 다른 탭에 다녀오면 미끄러지지 않고 바로 자리 잡는다)
let lastMode: { value: ChatMode; at: number } | null = null

// AI / 선생님 전환: 파란 알약이 선택한 쪽으로 미끄러진다
function ModeToggle({ value, onChange, badge }: NonNullable<Props['mode']>) {
  const refs = useRef<Partial<Record<ChatMode, HTMLButtonElement | null>>>({})
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)
  const [animate, setAnimate] = useState(false)

  useLayoutEffect(() => {
    const place = (m: ChatMode) => {
      const el = refs.current[m]
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth })
    }
    const recent = lastMode && performance.now() - lastMode.at < 1000
    const from = recent && lastMode ? lastMode.value : value
    if (from === value) {
      place(value)
      const id = requestAnimationFrame(() => setAnimate(true))
      return () => cancelAnimationFrame(id)
    }
    // 이전 모드 자리에서 시작해 다음 프레임에 새 자리로 옮긴다
    place(from)
    let id2 = 0
    const id1 = requestAnimationFrame(() => {
      setAnimate(true)
      id2 = requestAnimationFrame(() => place(value))
    })
    return () => {
      cancelAnimationFrame(id1)
      cancelAnimationFrame(id2)
    }
  }, [value, badge])

  return (
    <div className="relative flex rounded-full bg-track p-0.5 text-[11px] font-semibold">
      {pill && (
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-0.5 rounded-full bg-primary-600 shadow-sm',
            animate && 'transition-all duration-300 ease-out',
          )}
          style={pill}
        />
      )}
      {MODES.map(([m, label]) => (
        <button
          key={m}
          ref={(el) => {
            refs.current[m] = el
          }}
          type="button"
          onClick={() => {
            lastMode = { value, at: performance.now() }
            onChange(m)
          }}
          aria-pressed={value === m}
          className={cn(
            'relative flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors duration-300',
            value === m ? 'text-white' : 'text-muted hover:text-ink',
          )}
        >
          {label}
          {m === 'teacher' && !!badge && (
            <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[11px] leading-4 font-bold text-white">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
