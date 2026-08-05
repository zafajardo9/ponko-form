import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, CircleDollarSign, Link2, Plus, ReceiptText, Share2 } from 'lucide-react'
import { requireAuth } from '@/lib/server-fns/auth'
import {
  createPaymentLink,
  deletePaymentLink,
  getPaymentLinks,
  togglePaymentLink,
} from '@/lib/server-fns/payment-links'
import { PaymentLinkCard } from '@/components/dashboard/PaymentLinkCard'
import { CreatePaymentLinkDialog } from '@/components/dashboard/CreatePaymentLinkDialog'
import { Button, navigationBackIconClass, navigationButtonClass } from '@/components/ui/Button'
import { appConfig } from '@/utils/app-config'

export const Route = createFileRoute('/dashboard/payment-links')({
  beforeLoad: ({ location }) => requireAuth({ data: { returnTo: location.href } }),
  component: PaymentLinksPage,
})

function PaymentLinksPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: links, isLoading, isError, refetch } = useQuery({
    queryKey: ['payment-links'],
    queryFn: () => getPaymentLinks(),
  })

  const createMutation = useMutation({
    mutationFn: createPaymentLink,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payment-links'] })
      setCreateOpen(false)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (data: { id: number; isActive: boolean }) => togglePaymentLink({ data }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payment-links'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePaymentLink({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payment-links'] })
    },
  })
  const linkCount = links?.length ?? 0
  const activeCount = links?.filter((link) => link.isActive).length ?? 0
  const paymentCount = links?.reduce((total, link) => total + link.totalPayments, 0) ?? 0

  return (
    <main className="min-h-full bg-[#f7f4ef]">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
        <Link to="/dashboard" className={navigationButtonClass}>
          <ArrowLeft size={15} className={navigationBackIconClass} aria-hidden="true" />
          Dashboard
        </Link>

        <header className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#a9583e]">
              <ReceiptText size={16} aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.13em]">Collect a payment</p>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[#242320] sm:text-[2.6rem]">
              One-time payment links
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6c6962] sm:text-base">
              Set an amount, share the link, and let your customer pay once through
              your connected provider. No form or subscription required.
            </p>
          </div>
          <Button type="button" onClick={() => setCreateOpen(true)} className="h-11 shrink-0 gap-2 self-start rounded-lg px-5 sm:self-auto">
            <Plus size={17} aria-hidden="true" />
            New payment link
          </Button>
        </header>

        <section aria-label="How payment links work" className="mt-8 overflow-hidden rounded-xl bg-[#242320] text-white shadow-[0_14px_34px_rgba(36,35,32,0.12)]">
          <div className="grid divide-y divide-white/10 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:divide-x md:divide-y-0">
            <PaymentLinkStep icon={<CircleDollarSign size={18} />} label="1. Set the amount" detail="Choose a fixed or customer-entered amount." />
            <ArrowRight className="hidden self-center text-white/25 md:block" size={16} aria-hidden="true" />
            <PaymentLinkStep icon={<Share2 size={18} />} label="2. Share the link" detail="Send it in chat, email, or place it on a page." />
            <ArrowRight className="hidden self-center text-white/25 md:block" size={16} aria-hidden="true" />
            <PaymentLinkStep icon={<Link2 size={18} />} label="3. Get paid once" detail={`The provider handles payment; ${appConfig.name} records it.`} />
          </div>
          {!isLoading && !isError && linkCount > 0 && (
            <div className="grid grid-cols-3 border-t border-white/10 bg-white/[0.035]">
              <PaymentLinkStat value={linkCount} label="Total links" />
              <PaymentLinkStat value={activeCount} label="Live now" />
              <PaymentLinkStat value={paymentCount} label="Payments" />
            </div>
          )}
        </section>

        <div className="mb-4 mt-9 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#242320]">Your payment links</h2>
            <p className="mt-1 text-sm text-[#77736c]">Manage, pause, copy, or open each checkout.</p>
          </div>
          {linkCount > 0 && (
            <span className="rounded-full border border-[#ded8cf] bg-white px-3 py-1 text-xs font-medium text-[#77736c]">
              {linkCount} {linkCount === 1 ? 'link' : 'links'}
            </span>
          )}
        </div>

        {isLoading ? (
          <div role="status" aria-label="Loading payment links" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-xl border border-[#e4ddd3] bg-white motion-reduce:animate-none" />
            ))}
          </div>
        ) : isError ? (
          <div role="alert" className="rounded-xl border border-[#d7a84c] bg-[#fff8e7] p-6 text-[#6b4f16]">
            <h2 className="font-semibold text-[#242320]">Payment links couldn&apos;t be loaded</h2>
            <p className="mt-1 text-sm">Check your connection and try loading this list again.</p>
            <Button type="button" variant="secondary" className="mt-4" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : !links || links.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#cfc6ba] bg-white px-6 py-14 text-center sm:py-16">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5eee8] text-[#a9583e]">
              <ReceiptText size={22} aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-[#242320]">Create your first one-time checkout</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6c6962]">
              Use it for an invoice, deposit, donation, product, or any payment
              that should happen once.
            </p>
            <Button type="button" className="mt-6 gap-2" onClick={() => setCreateOpen(true)}>
              <Plus size={16} aria-hidden="true" />
              Create payment link
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {links.map((link) => (
              <PaymentLinkCard
                key={link.id}
                link={{
                  id: link.id,
                  publicId: link.publicId,
                  title: link.title,
                  description: link.description,
                  amount: link.amount,
                  currency: link.currency,
                  isActive: link.isActive,
                  totalPayments: link.totalPayments,
                  totalRevenue: link.totalRevenue,
                  createdAt: link.createdAt.toISOString(),
                }}
                onToggle={(id, active) => toggleMutation.mutate({ id, isActive: active })}
                onDelete={(id) => { if (confirm('Delete this payment link?')) deleteMutation.mutate(id) }}
              />
            ))}
          </div>
        )}
      </div>

      <CreatePaymentLinkDialog
        open={createOpen}
        onClose={() => {
          createMutation.reset()
          setCreateOpen(false)
        }}
        onSubmit={(data) => createMutation.mutate({ data })}
        isSubmitting={createMutation.isPending}
        errorMessage={createMutation.error instanceof Error ? createMutation.error.message : null}
      />
    </main>
  )
}

function PaymentLinkStep({
  icon,
  label,
  detail,
}: {
  icon: ReactNode
  label: string
  detail: string
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-5 sm:px-6">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#e7a58f]">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 text-xs leading-5 text-[#aaa69f]">{detail}</p>
      </div>
    </div>
  )
}

function PaymentLinkStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-4 py-3 text-center">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#aaa69f]">{label}</p>
    </div>
  )
}
