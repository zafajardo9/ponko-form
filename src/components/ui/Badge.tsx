interface BadgeProps {
  variant?: 'draft' | 'published' | 'paid' | 'pending' | 'failed' | 'refunded'
  children: React.ReactNode
}

export function Badge({ variant = 'draft', children }: BadgeProps) {
  const variants = {
    draft: 'bg-[#f5f0e8] text-[#6c6a64] border border-[#e6dfd8]',
    published: 'bg-[#edf7ef] text-[#2d7a3e] border border-[#b8dfc0]',
    paid: 'bg-[#edf7ef] text-[#2d7a3e] border border-[#b8dfc0]',
    pending: 'bg-[#fef9ec] text-[#8a6000] border border-[#f0d78a]',
    failed: 'bg-[#fdf0f0] text-[#c64545] border border-[#f0b8b8]',
    refunded: 'bg-[#f5f5f4] text-[#6c6a64] border border-[#e6dfd8]',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  )
}
