import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'navigation' | 'text-link' | 'danger'
  size?: 'sm' | 'md'
}

const navigationSurfaceClass =
  'border border-[#dedbd5] bg-white text-[#57544d] shadow-[0_1px_2px_rgba(20,20,19,0.04)] hover:border-[#c9b4a8] hover:bg-[#f7f2ec] hover:text-[#141413] active:bg-[#efe9de]'

export const navigationButtonClass =
  `group/nav inline-flex h-9 items-center justify-center gap-2 rounded-md px-3.5 text-sm font-medium transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 ${navigationSurfaceClass}`

export const navigationBackIconClass =
  'shrink-0 transition-transform duration-150 group-hover/nav:-translate-x-0.5'

export const navigationForwardIconClass =
  'shrink-0 transition-transform duration-150 group-hover/nav:translate-x-0.5'

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  const base =
    'group/nav inline-flex items-center justify-center gap-2 font-medium rounded-[var(--ponko-radius,8px)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ponko-primary,#cc785c)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

  const sizes = {
    sm: 'px-3 py-1.5 text-sm h-8',
    md: 'px-5 py-3 text-sm h-10',
  }

  const variants = {
    primary:
      'bg-[var(--ponko-primary,#cc785c)] text-white hover:bg-[var(--ponko-primary-active,#a9583e)] active:bg-[var(--ponko-primary-active,#a9583e)]',
    secondary:
      'bg-[#efe9de] text-[#141413] border border-[#e6dfd8] hover:bg-[#e8e0d2] active:bg-[#e8e0d2]',
    navigation: navigationSurfaceClass,
    'text-link':
      'bg-transparent text-[var(--ponko-primary,#cc785c)] hover:text-[var(--ponko-primary-active,#a9583e)] px-0',
    danger: 'bg-[#c64545] text-white hover:bg-[#a33434] active:bg-[#a33434]',
  }

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  )
}
