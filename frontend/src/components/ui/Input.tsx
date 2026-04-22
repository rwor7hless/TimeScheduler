import { type InputHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={clsx('ts-input', error && 'ts-input--err', className)}
        {...props}
      />
      {error && (
        <p className="text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
)

Input.displayName = 'Input'
export default Input
