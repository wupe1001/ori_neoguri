import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'sm'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}

const variantClass: Record<Variant, string> = {
  primary: 'bg-primary-600 text-white shadow-sm shadow-primary-600/25 enabled:hover:bg-primary-700 enabled:hover:shadow-md enabled:hover:shadow-primary-600/30',
  secondary: 'border border-primary-200 bg-surface text-primary-700 enabled:hover:border-primary-600 enabled:hover:bg-primary-50',
  ghost: 'text-muted enabled:hover:bg-track/60 enabled:hover:text-ink',
  danger: 'bg-danger text-white enabled:hover:opacity-90 enabled:hover:shadow-md enabled:hover:shadow-danger/25',
}

const sizeClass: Record<Size, string> = {
  md: 'px-5 py-3 text-body',
  sm: 'px-3 py-1.5 text-caption',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        'rounded-full font-semibold enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
        variantClass[variant],
        sizeClass[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    />
  )
}
