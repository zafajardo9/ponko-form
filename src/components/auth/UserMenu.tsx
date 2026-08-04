import { Link } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { authClient, useSession } from '../../lib/auth-client'

export function UserMenu() {
  const { data } = useSession()
  const user = data?.user
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const email = user?.email
  const name = user?.name || email || 'Account'
  const avatar = user?.image

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  async function signOut() {
    await authClient.signOut()
    window.location.assign('/')
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Open account menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#e9ded5] text-sm font-semibold text-[#8c4936] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2"
      >
        {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-[#e6dfd8] bg-white p-2 shadow-[0_16px_40px_rgba(20,20,19,0.16)]">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-[#282622]">{name}</p>
            {email ? <p className="truncate text-xs text-[#817d76]">{email}</p> : null}
          </div>
          <div className="my-1 border-t border-[#ece6de]" />
          <Link to="/dashboard" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-[#3d3d3a] hover:bg-[#f5f0e8]">Dashboard</Link>
          <button type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#b33e35] hover:bg-[#fdf0f0]">
            <LogOut size={15} aria-hidden="true" /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}
