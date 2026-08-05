import type { ReactNode } from 'react'
import { LockKeyhole } from 'lucide-react'
import { appConfig } from '../../utils/app-config'
import { AppLogo } from '../ui/AppLogo'

interface PublicPaymentShellProps {
  children: ReactNode
}

export function PublicPaymentShell({ children }: PublicPaymentShellProps) {
  return (
    <main className="payment-checkout-canvas relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f1eb] px-4 py-8 sm:px-6 sm:py-12">
      <div className="relative z-10 w-full max-w-[34rem]">
        <div className="mb-5 flex items-center justify-center gap-2.5 text-[#252523]">
          <AppLogo className="h-8 w-8 rounded-lg" fallbackClassName="bg-[#cc785c] text-sm font-bold text-white shadow-[0_5px_16px_rgba(169,88,62,0.22)]" />
          <span className="text-sm font-semibold tracking-tight">{appConfig.name}</span>
        </div>

        {children}

        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-[#77736c]">
          <LockKeyhole size={13} aria-hidden="true" />
          <span>Secure one-time checkout</span>
          <span aria-hidden="true">·</span>
          <span>Powered by {appConfig.name}</span>
        </div>
      </div>
    </main>
  )
}
