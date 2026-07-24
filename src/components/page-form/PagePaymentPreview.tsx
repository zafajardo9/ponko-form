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
      className="overflow-hidden rounded-xl border border-[#ddd4ca] bg-[#faf9f5]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6dfd8] bg-white px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8e8b82]">
            {isSubscription ? 'Subscription amount' : 'Amount due'}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[#141413]">
            {formatMoney(calculation.amount, page.paymentCurrency)}
            {subscription && (
              <span className="ml-1 text-sm font-normal tracking-normal text-[#6c6a64]">
                /{INTERVAL_LABELS[subscription.interval]}
              </span>
            )}
          </p>
        </div>
        <span className="rounded-full border border-[#d9c8bb] bg-[#f7eee8] px-2.5 py-1 text-xs font-medium text-[#9a533d]">
          Preview
        </span>
      </div>

      <div className="space-y-4 p-4">
        {subscription && (
          <div className="rounded-lg border border-[#e6dfd8] bg-white p-3 text-sm leading-relaxed text-[#5f5a53]">
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
            <div className="rounded-lg border border-[#e6dfd8] bg-white p-3">
              <p className="mb-2 text-sm font-medium text-[#141413]">
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
