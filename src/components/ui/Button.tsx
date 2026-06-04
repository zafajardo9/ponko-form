import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'text-link' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  const sizes = {
    sm: 'px-3 py-1.5 text-sm h-8',
    md: 'px-5 py-3 text-sm h-10',
  }

  const variants = {
    primary: 'bg-[#cc785c] text-white hover:bg-[#a9583e] active:bg-[#a9583e]',
    secondary:
      'bg-[#efe9de] text-[#141413] border border-[#e6dfd8] hover:bg-[#e8e0d2] active:bg-[#e8e0d2]',
    'text-link': 'bg-transparent text-[#cc785c] hover:text-[#a9583e] px-0',
    danger: 'bg-[#c64545] text-white hover:bg-[#a33434] active:bg-[#a33434]',
  }

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  )
}
