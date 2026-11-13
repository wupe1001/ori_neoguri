import { useId, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
}

// 예: "익명 (학년·반만 보임)"
export default function Checkbox({ label, ...rest }: Props) {
  const id = useId()
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 text-body text-ink">
      <input id={id} type="checkbox" className="size-4 accent-primary-600" {...rest} />
      {label}
    </label>
  )
}
