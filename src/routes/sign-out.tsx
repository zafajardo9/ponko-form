import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/sign-out')({
  component: SignOutPage,
})

function SignOutPage() {
  useEffect(() => {
    authClient.signOut().finally(() => {
      window.location.assign('/')
    })
  }, [])
  return <p role="status" className="p-8 text-center text-sm text-[#6c6a64]">Signing you out…</p>
}
