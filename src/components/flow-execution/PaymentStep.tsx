import { useState } from 'react'
import { Button } from '../ui/Button'

/**
 * PaymentStep
 *
 * Renders the payment interface during flow execution. It shows the amount to
 * charge and the selected gateway, then hands off to the gateway.
 *
 * NOTE: The live gateway redirect/inline flow belongs to the main plan's
 * payment phase (Phase 6 — Payment-Enabled Forms), which is not yet built.
 * Until that exists, this performs a clearly-labeled simulated charge so the
 * flow runtime is fully exercisable end-to-end. When the real payment API
 * lands, replace `processPayment` with a call to createPayment + gateway
 * redirect, then resolve via the redirect-back handler.
 */
interface PaymentStepProps {
  amount: number | string
  currency: string
  gatewayName?: string
  onResult: (result: { success: boolean; gatewayPaymentId?: string }) => void
}

export function PaymentStep({ amount, currency, gatewayName, onResult }: PaymentStepProps) {
  const [status, setStatus] = useState<'idle' | 'processing' | 'failed'>('idle')

  const formattedAmount =
    typeof amount === 'number'
      ? amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : amount

  async function processPayment() {
    setStatus('processing')
    // Simulated gateway handoff — see note above.
    await new Promise((r) => setTimeout(r, 900))
    const ref = `SIM_${Date.now().toString(36).toUpperCase()}`
    onResult({ success: true, gatewayPaymentId: ref })
  }

  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div>
        <p className="text-sm text-[#6c6a64]">Amount due</p>
        <p className="mt-1 text-4xl font-semibold text-[#141413]">
          {currency} {formattedAmount}
        </p>
      </div>

      {gatewayName && (
        <p className="text-sm text-[#6c6a64]">
          Paying via <span className="font-medium text-[#141413]">{gatewayName}</span>
        </p>
      )}

      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button onClick={processPayment} disabled={status === 'processing'}>
          {status === 'processing' ? 'Processing…' : `Pay ${currency} ${formattedAmount}`}
        </Button>
        <Button
          variant="text-link"
          size="sm"
          disabled={status === 'processing'}
          onClick={() => onResult({ success: false })}
        >
          Payment failed / cancel
        </Button>
      </div>

      {status === 'failed' && (
        <p className="text-sm text-[#c64545]">Payment did not complete. Please try again.</p>
      )}

      <p className="flex items-center gap-1.5 text-xs text-[#8e8b82]">
        <span aria-hidden>🔒</span> Secure checkout
      </p>
    </div>
  )
}
