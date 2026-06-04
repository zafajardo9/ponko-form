import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-[#141413]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`h-10 rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-3.5 py-2.5 text-sm text-[#141413] placeholder:text-[#8e8b82] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20 transition-colors ${error ? 'border-[#c64545] focus:border-[#c64545] focus:ring-[#c64545]/20' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-[#c64545]">{error}</p>}
    </div>
  )
}
