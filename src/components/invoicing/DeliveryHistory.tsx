import { Badge } from '../ui/Badge'
import type { DeliveryListItem } from '../../lib/invoicing/types'

function maskedEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!domain || !name) return email
  return `${name.slice(0, 2)}${name.length > 2 ? '•••' : ''}@${domain}`
}

export function DeliveryHistory({
  deliveries,
  retryingId,
  onRetry,
}: {
  deliveries: DeliveryListItem[]
  retryingId: number | null
  onRetry: (id: number) => void
}) {
  return (
    <section className="rounded-xl border border-[#e6dfd8] bg-white">
      <div className="border-b border-[#e6dfd8] px-5 py-4">
        <h2 className="font-medium text-[#141413]">Recent deliveries</h2>
        <p className="mt-1 text-xs text-[#8e8b82]">Provider acceptance and failed attempts for this form.</p>
      </div>
      {deliveries.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-[#8e8b82]">No emails have been sent yet.</p>
      ) : (
        <div className="divide-y divide-[#eee8df]">
          {deliveries.map((delivery) => (
            <div key={delivery.id} className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#141413]">
                    {delivery.templateName ?? (delivery.templateKind === 'invoice' ? 'Invoice' : 'Response email')}
                  </span>
                  {delivery.invoiceNumber && <span className="font-mono text-xs text-[#6c6a64]">{delivery.invoiceNumber}</span>}
                </div>
                <p className="mt-1 truncate text-xs text-[#8e8b82]">
                  {maskedEmail(delivery.recipientEmail)} · {new Date(delivery.createdAt).toLocaleString()}
                </p>
                {delivery.errorMessage && <p className="mt-1 text-xs text-[#a33f32]">{delivery.errorMessage}</p>}
              </div>
              <Badge variant={delivery.status === 'sent' ? 'paid' : delivery.status === 'failed' ? 'failed' : 'pending'}>
                {delivery.status}
              </Badge>
              {delivery.status === 'failed' && delivery.attemptCount < 5 && (
                <button
                  type="button"
                  disabled={retryingId === delivery.id}
                  onClick={() => onRetry(delivery.id)}
                  className="rounded-md border border-[#e6dfd8] px-3 py-1.5 text-xs text-[#6c6a64] hover:bg-[#f5f0e8] disabled:opacity-50"
                >
                  {retryingId === delivery.id ? 'Retrying…' : 'Retry'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
