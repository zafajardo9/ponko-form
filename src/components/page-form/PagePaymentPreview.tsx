import type {
  FormPage,
  FormReference,
  PageField,
} from '../../lib/page-builder/types'
import { calculatePagePayment } from '../../lib/page-builder/references'
import { Button } from '../ui/Button'
import { formatMoney } from './PagePaymentStep'

interface PagePaymentPreviewProps {
  page: FormPage
  fields: PageField[]
  dataScope: Record<string, unknown>
  references: FormReference[]
}

const INTERVAL_LABELS = {
  weekly: 'week',
  monthly: 'month',
  quarterly: '3 months',
  semiannual: '6 months',
  annual: 'year',
} as const

export function PagePaymentPreview({
  page,
  fields,
  dataScope,
  references,
}: PagePaymentPreviewProps) {
  const calculation = calculatePagePayment(
    page,
    fields,
    dataScope,
    references,
  )
  const subscription = page.subscriptionConfig
  const isSubscription = Boolean(subscription?.enabled)

  return (
    <section
      aria-label={
        isSubscription
          ? 'Subscription payment preview'
          : 'Payment preview'
      }
      className="rounded-2xl border border-[#e6dfd8] bg-white shadow-[0_1px_4px_rgba(20,20,19,0.08)]"
    >
      {/* Ticket stub — amount due */}
      <div className="rounded-t-2xl bg-[#faf9f5] px-5 pb-6 pt-5 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8e8b82]">
          {isSubscription ? 'Subscription amount' : 'Amount due'}
        </p>
        <p className="mt-2 text-4xl font-semibold tracking-tight text-[#141413]">
          {formatMoney(calculation.amount, page.paymentCurrency)}
          {subscription && (
            <span className="ml-1.5 text-lg font-normal text-[#6c6a64]">
              /{INTERVAL_LABELS[subscription.interval]}
            </span>
          )}
        </p>
        <span className="mt-3 inline-flex items-center rounded-full border border-[#d9c8bb] bg-[#f7eee8] px-2.5 py-1 text-xs font-medium text-[#9a533d]">
          Preview
        </span>
      </div>

      {/* Perforation */}
      <div className="relative flex items-center" aria-hidden="true">
        <span className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[var(--ponko-surface,#efe9de)]" />
        <span className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[var(--ponko-surface,#efe9de)]" />
        <div className="mx-4 flex-1 border-t-2 border-dashed border-[#ddd5cc]" />
      </div>

      {/* Ticket body */}
      <div className="flex flex-col gap-4 px-5 py-5">
        {subscription && (
          <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3 text-sm leading-relaxed text-[#5f5a53]">
            <p className="font-medium text-[#141413]">
              {subscription.trialPeriodDays > 0
                ? `${subscription.trialPeriodDays}-day trial`
                : 'Billing starts immediately'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#6c6a64]">
              Xendit securely links an eligible auto-debit payment method.
              {subscription.maxCycles
                ? ` This subscription ends after ${subscription.maxCycles} billing cycles.`
                : ' Billing continues until the subscription is cancelled.'}
            </p>
          </div>
        )}

        {page.paymentComputation?.showBreakdown &&
          calculation.breakdown.length > 0 && (
            <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8e8b82]">
                Price breakdown
              </p>
              <div className="space-y-1.5">
                {calculation.breakdown.map((line, index) => (
                  <div
                    key={`${line.label}-${index}`}
                    className={`flex items-center justify-between gap-3 text-sm ${
                      line.kind === 'total'
                        ? 'border-t border-[#e6dfd8] pt-2 font-medium text-[#141413]'
                        : 'text-[#6c6a64]'
                    }`}
                  >
                    <span>{line.label}</span>
                    <span>
                      {formatMoney(line.amount, page.paymentCurrency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        {calculation.missingReferences.length > 0 && (
          <p className="text-sm text-[#a9583e]">
            Add values for: {calculation.missingReferences.join(', ')}.
          </p>
        )}

        <Button type="button" disabled className="w-full sm:w-auto">
          {isSubscription ? 'Subscribe with Xendit' : 'Continue to payment'}
        </Button>
        <p className="text-xs leading-relaxed text-[#8e8b82]">
          Checkout is disabled in preview. Publish or open the shared form to
          test the secure payment handoff.
        </p>
      </div>
    </section>
  )
}
