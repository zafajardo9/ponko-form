import { Link } from '@tanstack/react-router'
import { Button } from '../ui/Button'

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#efe9de]">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="4" width="20" height="24" rx="2" stroke="#cc785c" strokeWidth="1.5" fill="none" />
          <line x1="10" y1="10" x2="22" y2="10" stroke="#cc785c" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="10" y1="14" x2="22" y2="14" stroke="#cc785c" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="10" y1="18" x2="17" y2="18" stroke="#cc785c" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="mb-2 text-xl font-medium text-[#141413]">No forms yet</h2>
      <p className="mb-8 max-w-sm text-[#6c6a64]">
        Create your first form to start collecting responses and payments.
      </p>
      <Link to="/forms/new">
        <Button>Create your first form</Button>
      </Link>
    </div>
  )
}
