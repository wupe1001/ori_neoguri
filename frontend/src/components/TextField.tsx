import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from './cn'

const fieldClass =
  'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-body text-ink placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100'

type LabelProps = {
  label?: string
  // 입력창 아래 안내 문구
  hint?: string
}

function Field({ id, label, hint, children }: LabelProps & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-caption font-semibold text-ink">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-caption text-muted">{hint}</p>}
    </div>
  )
}

// 한 줄 입력 (육하원칙 빈칸 등)
export function Input({ label, hint, className, ...rest }: LabelProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <Field id={id} label={label} hint={hint}>
      <input id={id} className={cn(fieldClass, className)} {...rest} />
    </Field>
  )
}

// 여러 줄 입력 (질문 쓰기, 답 수정 등)
export function TextArea({ label, hint, className, rows = 4, ...rest }: LabelProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <Field id={id} label={label} hint={hint}>
      <textarea id={id} rows={rows} className={cn(fieldClass, 'resize-none', className)} {...rest} />
    </Field>
  )
}
