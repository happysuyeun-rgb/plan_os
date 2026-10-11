import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  showCount?: boolean
}

export function Input({
  label,
  error,
  showCount,
  maxLength,
  value,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id ?? label?.replace(/\s/g, '-').toLowerCase()
  const count = typeof value === 'string' ? value.length : 0

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        value={value}
        maxLength={maxLength}
        className={cn(
          'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors',
          'focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
          error ? 'border-red-400' : 'border-gray-200',
          className,
        )}
        {...props}
      />
      <div className="flex justify-between">
        {error && <p className="text-xs text-red-500">{error}</p>}
        {showCount && maxLength && (
          <p className="ml-auto text-xs text-gray-400">
            {count}/{maxLength}
          </p>
        )}
      </div>
    </div>
  )
}
