import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'dark'
}

export function Card({ variant = 'default', className = '', ...props }: CardProps) {
  const variants = {
    default: 'bg-[#efe9de] border border-[#e6dfd8]',
    dark: 'bg-[#181715] text-[#faf9f5]',
  }

  return (
    <div
      className={`rounded-xl p-8 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}
