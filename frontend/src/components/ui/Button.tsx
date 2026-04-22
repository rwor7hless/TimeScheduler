import { type ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'ts-btn',
        {
          'primary-btn': variant === 'primary',
          'secondary-btn': variant === 'secondary',
          'danger-btn': variant === 'danger',
          'ts-btn-ghost': variant === 'ghost',
        },
        {
          'ts-btn--sm': size === 'sm',
          'ts-btn--lg': size === 'lg',
        },
        className
      )}
      {...props}
    />
  )
}
