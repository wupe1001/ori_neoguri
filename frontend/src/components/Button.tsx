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
  primary: 'bg-primary-600 text-white hover:bg-primary-700',
  secondary: 'border border-primary-600 bg-surface text-primary-700 hover:bg-primary-50',
  ghost: 'text-muted hover:bg-page',
  danger: 'bg-danger text-white hover:opacity-90',
}

const sizeClass: Record<Size, string> = {
  md: 'px-4 py-3 text-body',
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
        'rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        variantClass[variant],
        sizeClass[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    />
  )
}
