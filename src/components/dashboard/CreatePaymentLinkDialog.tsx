import { useEffect, useState } from 'react'
import { CircleDollarSign, CreditCard, Link2, ReceiptText, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface CreatePaymentLinkDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    title: string
    description?: string
    amount: number
    currency: string
    paymentGatewaySlug: 'paypal' | 'xendit'
    allowCustomAmount?: boolean
    minAmount?: number
    maxAmount?: number
    redirectUrl?: string
    successMessage?: string
  }) => void
  isSubmitting?: boolean
  errorMessage?: string | null
}

export function CreatePaymentLinkDialog({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  errorMessage,
}: CreatePaymentLinkDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('PHP')
  const [gateway, setGateway] = useState<'paypal' | 'xendit'>('xendit')
  const [allowCustomAmount, setAllowCustomAmount] = useState(false)
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [redirectUrl, setRedirectUrl] = useState('')
  const customRangeInvalid = allowCustomAmount && minAmount !== '' && maxAmount !== ''
    && Number(minAmount) > Number(maxAmount)

  useEffect(() => {
    if (open) return
    setTitle('')
    setDescription('')
    setAmount('')
    setCurrency('PHP')
    setGateway('xendit')
    setAllowCustomAmount(false)
    setMinAmount('')
    setMaxAmount('')
    setSuccessMessage('')
    setRedirectUrl('')
  }, [open])

  if (!open) return null

  const handleSubmit = () => {
    if (!title.trim() || !amount || Number(amount) <= 0) return
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      amount: Number(amount),
      currency,
      paymentGatewaySlug: gateway,
      allowCustomAmount,
      minAmount: allowCustomAmount && minAmount ? Number(minAmount) : undefined,
      maxAmount: allowCustomAmount && maxAmount ? Number(maxAmount) : undefined,
      redirectUrl: redirectUrl.trim() || undefined,
      successMessage: successMessage.trim() || undefined,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Create payment link"
    >
      <div className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/60 bg-[#f7f4ef] shadow-[0_28px_90px_rgba(20,20,19,0.26)] sm:max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#3b3935] bg-[#242320] px-5 py-4 text-white sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-[#e7a58f]">
              <ReceiptText size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#aaa69f]">New checkout</p>
              <h2 className="mt-0.5 text-base font-semibold">Create one-time payment link</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#aaa69f] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7a58f]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto">
          <div className="border-b border-[#e1dbd2] bg-white px-5 py-4 sm:px-6">
            <p className="text-sm leading-6 text-[#65615a]">
              This link collects <strong className="font-semibold text-[#35322e]">one payment only</strong>.
              It does not create a subscription or ask the customer to complete a form.
            </p>
          </div>

          <div className="space-y-6 px-5 py-5 sm:px-6 sm:py-6">
            <section aria-labelledby="payment-details-heading" className="rounded-xl border border-[#dfd8ce] bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5eee8] text-[#a9583e]">
                  <CircleDollarSign size={17} aria-hidden="true" />
                </span>
                <div>
                  <h3 id="payment-details-heading" className="text-sm font-semibold text-[#242320]">Payment details</h3>
                  <p className="mt-0.5 text-xs text-[#858078]">Tell the customer what they are paying for.</p>
                </div>
              </div>

              <div>
            <label htmlFor="payment-link-title" className="mb-1.5 block text-sm font-medium text-[#35322e]">Payment title *</label>
            <input
              id="payment-link-title"
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Workshop ticket, deposit, invoice #1042…"
              className="h-10 w-full rounded-md border border-[#ded8cf] bg-[#fdfcf9] px-3 text-sm text-[#242320] outline-none transition focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15"
            />
          </div>

          <div className="mt-4">
            <label htmlFor="payment-link-description" className="mb-1.5 block text-sm font-medium text-[#35322e]">Description <span className="font-normal text-[#918c84]">(optional)</span></label>
            <textarea
              id="payment-link-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a short note so the customer can confirm the payment."
              rows={2}
              className="w-full resize-none rounded-md border border-[#ded8cf] bg-[#fdfcf9] px-3 py-2 text-sm text-[#242320] outline-none transition focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15"
            />
          </div>

          <div className="mt-4 grid grid-cols-[1fr_7rem] gap-3">
            <div>
              <label htmlFor="payment-link-amount" className="mb-1.5 block text-sm font-medium text-[#35322e]">One-time amount *</label>
              <input
                id="payment-link-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="3500"
                min="1"
                className="h-10 w-full rounded-md border border-[#ded8cf] bg-[#fdfcf9] px-3 text-sm font-semibold tabular-nums text-[#242320] outline-none transition focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15"
              />
            </div>
            <div>
              <label htmlFor="payment-link-currency" className="mb-1.5 block text-sm font-medium text-[#35322e]">Currency</label>
              <select
                id="payment-link-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-10 w-full rounded-md border border-[#ded8cf] bg-[#fdfcf9] px-3 text-sm text-[#242320] outline-none transition focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15"
              >
                <option value="PHP">PHP</option>
                {gateway === 'paypal' && <option value="USD">USD</option>}
              </select>
            </div>
          </div>
            </section>

          <section aria-labelledby="checkout-options-heading" className="rounded-xl border border-[#dfd8ce] bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef1ed] text-[#56705c]">
                <CreditCard size={17} aria-hidden="true" />
              </span>
              <div>
                <h3 id="checkout-options-heading" className="text-sm font-semibold text-[#242320]">Checkout options</h3>
                <p className="mt-0.5 text-xs text-[#858078]">Choose where payment is completed.</p>
              </div>
            </div>

          <div>
            <label htmlFor="payment-link-gateway" className="mb-1.5 block text-sm font-medium text-[#35322e]">Payment provider</label>
            <select
              id="payment-link-gateway"
              value={gateway}
              onChange={(e) => {
                const nextGateway = e.target.value as 'paypal' | 'xendit'
                setGateway(nextGateway)
                if (nextGateway === 'xendit') setCurrency('PHP')
              }}
              className="h-10 w-full rounded-md border border-[#ded8cf] bg-[#fdfcf9] px-3 text-sm text-[#242320] outline-none transition focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15"
            >
              <option value="xendit">Xendit (GCash, bank transfer, cards)</option>
              <option value="paypal">PayPal</option>
            </select>
          </div>

          <label className="mt-4 flex items-start gap-3 rounded-lg border border-[#e6e0d7] bg-[#faf8f4] p-3.5">
            <input
              type="checkbox"
              checked={allowCustomAmount}
              onChange={(e) => setAllowCustomAmount(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#d9d0c5] text-[#cc785c] focus:ring-[#cc785c]/30"
            />
            <span>
              <span className="block text-sm font-medium text-[#35322e]">Let the customer choose the amount</span>
              <span className="mt-0.5 block text-xs leading-5 text-[#858078]">Useful for donations, tips, or flexible deposits. It is still charged once.</span>
            </span>
          </label>

          {allowCustomAmount && (
            <div className="mt-3 pl-0 sm:pl-7">
              <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="payment-link-min-amount" className="mb-1 block text-xs font-medium text-[#6c6962]">
                  Minimum <span className="font-normal text-[#918c84]">(optional)</span>
                </label>
                <input
                  id="payment-link-min-amount"
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="500"
                  min="0"
                  className="h-10 w-full rounded-md border border-[#ded8cf] bg-[#fdfcf9] px-3 text-sm tabular-nums text-[#242320] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15"
                />
              </div>
              <div>
                <label htmlFor="payment-link-max-amount" className="mb-1 block text-xs font-medium text-[#6c6962]">
                  Maximum <span className="font-normal text-[#918c84]">(optional)</span>
                </label>
                <input
                  id="payment-link-max-amount"
                  type="number"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  placeholder="10000"
                  min="0"
                  className="h-10 w-full rounded-md border border-[#ded8cf] bg-[#fdfcf9] px-3 text-sm tabular-nums text-[#242320] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15"
                />
              </div>
              </div>
              {customRangeInvalid && (
                <p role="alert" className="mt-2 text-xs text-[#b33d3d]">
                  Maximum amount must be greater than or equal to the minimum.
                </p>
              )}
            </div>
          )}
          </section>

          <section aria-labelledby="after-payment-heading" className="rounded-xl border border-[#dfd8ce] bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f1eee8] text-[#796f63]">
                <Link2 size={17} aria-hidden="true" />
              </span>
              <div>
                <h3 id="after-payment-heading" className="text-sm font-semibold text-[#242320]">After payment</h3>
                <p className="mt-0.5 text-xs text-[#858078]">Customize what the customer sees next.</p>
              </div>
            </div>

          <div>
            <label htmlFor="payment-link-success-message" className="mb-1.5 block text-sm font-medium text-[#35322e]">
              Confirmation message <span className="font-normal text-[#918c84]">(optional)</span>
            </label>
            <input
              id="payment-link-success-message"
              type="text"
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
              placeholder="Thank you for your payment!"
              className="h-10 w-full rounded-md border border-[#ded8cf] bg-[#fdfcf9] px-3 text-sm text-[#242320] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15"
            />
          </div>

          <div className="mt-4">
            <label htmlFor="payment-link-redirect-url" className="mb-1.5 block text-sm font-medium text-[#35322e]">
              Continue to a page <span className="font-normal text-[#918c84]">(optional)</span>
            </label>
            <input
              id="payment-link-redirect-url"
              type="url"
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              placeholder="https://example.com/thank-you"
              className="h-10 w-full rounded-md border border-[#ded8cf] bg-[#fdfcf9] px-3 text-sm text-[#242320] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15"
            />
            <p className="mt-1.5 text-xs leading-5 text-[#858078]">
              We show the confirmation first, then send them to this URL.
            </p>
          </div>
          </section>

          {errorMessage && (
            <div role="alert" className="rounded-lg border border-[#e8b9aa] bg-[#fff3ef] px-4 py-3 text-sm text-[#824735]">
              {errorMessage}
            </div>
          )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[#dfd8ce] bg-white px-5 py-4 sm:px-6">
          <p className="hidden text-xs text-[#858078] sm:block">One link · One checkout · No recurring charge</p>
          <div className="ml-auto flex items-center gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !amount || Number(amount) <= 0 || customRangeInvalid}
          >
            {isSubmitting ? 'Creating\u2026' : 'Create payment link'}
          </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
