import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useId, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, FileText, Percent, Plus, Power, Search, Tag, Trash2, X } from 'lucide-react'
import { requireAuth } from '@/lib/server-fns/auth'
import { createDiscountCode, deleteDiscountCode, getDiscountWorkspace, toggleDiscountCode, updateDiscountCode } from '@/lib/server-fns/discounts'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Switch } from '@/components/ui/Switch'
import { useTransitionClose } from '@/components/ui/useTransitionClose'

export const Route = createFileRoute('/discounts')({ beforeLoad: ({ location }) => requireAuth({ data: { returnTo: location.href } }), component: DiscountsPage })
type Code = Awaited<ReturnType<typeof getDiscountWorkspace>>['codes'][number]
type FormOption = Awaited<ReturnType<typeof getDiscountWorkspace>>['forms'][number]
type Draft = { id?: number; code: string; description: string; type: 'percentage' | 'fixed'; value: string; maxDiscount: string; minAmount: string; maxUses: string; startsAt: string; expiresAt: string; isActive: boolean; formIds: number[] }
const emptyDraft: Draft = { code: '', description: '', type: 'percentage', value: '10', maxDiscount: '', minAmount: '', maxUses: '', startsAt: '', expiresAt: '', isActive: true, formIds: [] }
function dateInput(value: Date | null) { return value ? new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '' }
function fromCode(code: Code): Draft { return { id: code.id, code: code.code, description: code.description ?? '', type: code.type, value: String(code.type === 'fixed' ? code.value / 100 : code.value), maxDiscount: code.maxDiscount == null ? '' : String(code.maxDiscount / 100), minAmount: code.minAmount == null ? '' : String(code.minAmount / 100), maxUses: code.maxUses == null ? '' : String(code.maxUses), startsAt: dateInput(code.startsAt), expiresAt: dateInput(code.expiresAt), isActive: code.isActive, formIds: code.formIds } }
function minor(value: string) { return value.trim() ? Math.round(Number(value) * 100) : null }

function DiscountsPage() {
  const queryClient = useQueryClient(); const query = useQuery({ queryKey: ['discount-workspace'], queryFn: () => getDiscountWorkspace() }); const [draft, setDraft] = useState<Draft | null>(null)
  const codes = query.data?.codes ?? []; const forms = query.data?.forms ?? []; const canEdit = forms.some((form) => form.canEdit)
  const mutation = useMutation({ mutationFn: (value: Draft) => { const payload = { code: value.code, description: value.description, type: value.type, value: value.type === 'fixed' ? Math.round(Number(value.value) * 100) : Number(value.value), maxDiscount: value.type === 'percentage' ? minor(value.maxDiscount) : null, minAmount: minor(value.minAmount), maxUses: value.maxUses.trim() ? Number(value.maxUses) : null, startsAt: value.startsAt || null, expiresAt: value.expiresAt || null, isActive: value.isActive, formIds: value.formIds }; return value.id ? updateDiscountCode({ data: { ...payload, id: value.id } }) : createDiscountCode({ data: payload }) }, onSuccess: async () => { setDraft(null); await queryClient.invalidateQueries({ queryKey: ['discount-workspace'] }) } })
  const toggle = useMutation({ mutationFn: (code: Code) => toggleDiscountCode({ data: { id: code.id, isActive: !code.isActive } }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discount-workspace'] }) })
  const remove = useMutation({ mutationFn: (code: Code) => deleteDiscountCode({ data: { id: code.id } }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discount-workspace'] }) })
  if (query.isLoading) return <DiscountLoading />
  if (query.error || !query.data) return <DiscountError onRetry={() => query.refetch()} />

  const activeCount = codes.filter((code) => code.isActive).length
  const redemptionCount = codes.reduce((total, code) => total + code.currentUses, 0)

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-[#f7f4ef]">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#a9583e]">
              <Percent size={16} aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.13em]">Pricing tools</p>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[#242320] sm:text-[2.6rem]">Discounts</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6c6962] sm:text-base">Create reusable codes, set their rules, and choose the forms where customers can use them.</p>
          </div>
          {canEdit && <Button type="button" onClick={() => setDraft({ ...emptyDraft })} className="h-11 shrink-0 self-start rounded-lg px-5 sm:self-auto"><Plus size={17} aria-hidden="true" />New discount</Button>}
        </header>

        <section aria-label="Discount overview" className="mt-8 overflow-hidden rounded-xl bg-[#242320] text-white shadow-[0_14px_34px_rgba(36,35,32,0.12)]">
          <div className="grid divide-y divide-white/10 sm:grid-cols-[1.4fr_1fr_1fr] sm:divide-x sm:divide-y-0">
            <div className="flex items-start gap-3 px-5 py-5 sm:px-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#e7a58f]"><Tag size={18} aria-hidden="true" /></span>
              <div><p className="text-sm font-semibold">One code, multiple forms</p><p className="mt-1 text-xs leading-5 text-[#aaa69f]">Run one promotion across any forms you choose.</p></div>
            </div>
            <DiscountStat value={activeCount} label="Active codes" />
            <DiscountStat value={redemptionCount} label="Total uses" />
          </div>
        </section>

        <div className="mb-4 mt-9 flex items-end justify-between gap-4">
          <div><h2 className="text-lg font-semibold text-[#242320]">Your discount codes</h2><p className="mt-1 text-sm text-[#77736c]">Edit availability, assignments, and campaign limits.</p></div>
          {codes.length > 0 && <span className="rounded-full border border-[#ded8cf] bg-white px-3 py-1 text-xs font-medium text-[#77736c]">{codes.length} {codes.length === 1 ? 'code' : 'codes'}</span>}
        </div>

        {codes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#cfc6ba] bg-white px-6 py-14 text-center sm:py-16">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5eee8] text-[#a9583e]"><Percent size={22} aria-hidden="true" /></span>
            <h2 className="mt-4 text-lg font-semibold text-[#242320]">Create your first discount</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6c6962]">Set a percentage or fixed amount, then assign the code to one or more forms.</p>
            {canEdit && <Button type="button" className="mt-6" onClick={() => setDraft({ ...emptyDraft })}><Plus size={16} aria-hidden="true" />Create discount</Button>}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {codes.map((code) => (
              <article key={code.id} className="flex min-h-52 flex-col rounded-xl border border-[#e1dbd2] bg-white p-5 shadow-[0_1px_2px_rgba(20,20,19,0.03)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><code className="rounded-md bg-[#f5f0e8] px-2.5 py-1.5 text-sm font-semibold tracking-[0.08em] text-[#242320]">{code.code}</code><Badge variant={code.isActive ? 'published' : 'draft'}>{code.isActive ? 'Active' : 'Inactive'}</Badge></div><p className="mt-3 text-sm leading-6 text-[#6c6962]">{code.description}</p></div>
                  <div className="shrink-0 text-right"><p className="text-xl font-semibold tabular-nums text-[#242320]">{code.type === 'percentage' ? `${code.value}%` : code.value % 100 === 0 ? (code.value / 100).toFixed(0) : (code.value / 100).toFixed(2)}</p><p className="text-xs text-[#8e8b82]">off</p></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#eee9e2] pt-4">
                  {code.formNames.map((name, index) => <span key={code.formIds[index] ?? `${name}-${index}`} className="rounded-full bg-[#f5f0e8] px-2.5 py-1 text-xs font-medium text-[#6c6962]">{name}</span>)}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#8e8b82]"><span>{code.currentUses}{code.maxUses == null ? '' : ` / ${code.maxUses}`} uses</span>{code.expiresAt && <span>Expires {code.expiresAt.toLocaleDateString()}</span>}</div>
                {canEdit && <div className="mt-auto flex flex-wrap gap-2 pt-5"><Button type="button" variant="secondary" size="sm" onClick={() => setDraft(fromCode(code))}>Edit</Button><Button type="button" variant="secondary" size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate(code)}><Power size={13} aria-hidden="true" />{code.isActive ? 'Disable' : 'Enable'}</Button><button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-[#b33d3d] transition-colors hover:bg-[#fdf0f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c64545]/40" onClick={() => { if (confirm(`Delete ${code.code}?`)) remove.mutate(code) }}><Trash2 size={13} aria-hidden="true" />Delete</button></div>}
              </article>
            ))}
          </div>
        )}
      </div>
      {draft && <DiscountDialog draft={draft} forms={forms} pending={mutation.isPending} error={mutation.error instanceof Error ? mutation.error.message : null} onChange={(next) => { mutation.reset(); setDraft(next) }} onClose={() => { mutation.reset(); setDraft(null) }} onSave={() => mutation.mutate(draft)} />}
    </main>
  )
}

const controlClass = 'h-10 w-full rounded-md border border-[#ded8cf] bg-[#fdfcf9] px-3 text-sm text-[#242320] outline-none transition placeholder:text-[#918c84] focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15'
const labelClass = 'mb-1.5 block text-sm font-medium text-[#35322e]'

function DiscountDialog({ draft, forms, pending, error, onChange, onClose, onSave }: { draft: Draft; forms: FormOption[]; pending: boolean; error: string | null; onChange: (draft: Draft) => void; onClose: () => void; onSave: () => void }) {
  const titleId = useId()
  const [formSelectorOpen, setFormSelectorOpen] = useState(false)
  const { requestClose, transitionClass } = useTransitionClose(onClose)
  const editableForms = forms.filter((form) => form.canEdit)
  const update = (patch: Partial<Draft>) => onChange({ ...draft, ...patch })
  const isValid = Boolean(draft.code.trim() && Number(draft.value) > 0 && draft.description.trim() && draft.formIds.length)

  useEffect(() => {
    if (formSelectorOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      requestClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [formSelectorOpen, requestClose])

  return (
    <>
    <div className={`t-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 backdrop-blur-[2px] sm:items-center sm:p-4 ${transitionClass}`} onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose() }} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-hidden={formSelectorOpen || undefined}>
      <div className={`t-modal flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/60 bg-[#f7f4ef] shadow-[0_28px_90px_rgba(20,20,19,0.26)] sm:max-h-[92vh] ${transitionClass}`}>
        <div className="flex items-center justify-between border-b border-[#3b3935] bg-[#242320] px-5 py-4 text-white sm:px-6">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-[#e7a58f]"><Percent size={18} aria-hidden="true" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#aaa69f]">Pricing rule</p><h2 id={titleId} className="mt-0.5 text-base font-semibold">{draft.id ? 'Edit discount' : 'Create discount'}</h2></div></div>
          <div className="flex items-center gap-2">
            <Switch checked={draft.isActive} onCheckedChange={(isActive) => update({ isActive })} checkedLabel="Active" uncheckedLabel="Inactive" stateLabel="responsive" variant="inverse" aria-label={`Discount status: ${draft.isActive ? 'Active' : 'Inactive'}`} />
            <button type="button" onClick={requestClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#aaa69f] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7a58f]" aria-label="Close"><X size={18} /></button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <div className="space-y-5">
            <section aria-labelledby={`${titleId}-value`} className="rounded-xl border border-[#dfd8ce] bg-white p-4 sm:p-5">
              <SectionHeading id={`${titleId}-value`} icon={<Tag size={17} />} title="Code and value" detail="Choose what customers enter and how much it deducts." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Discount code" htmlFor="discount-code"><input id="discount-code" autoFocus className={`${controlClass} font-semibold uppercase tracking-[0.08em]`} placeholder="EARLYBIRD" value={draft.code} onChange={(event) => update({ code: event.target.value.toUpperCase() })} /></Field>
                <Field label="Discount type" htmlFor="discount-type"><select id="discount-type" className={controlClass} value={draft.type} onChange={(event) => update({ type: event.target.value as Draft['type'], maxDiscount: event.target.value === 'fixed' ? '' : draft.maxDiscount })}><option value="percentage">Percentage off</option><option value="fixed">Fixed amount off</option></select></Field>
                <Field label={draft.type === 'percentage' ? 'Percent off' : 'Amount off'} htmlFor="discount-value" hint={draft.type === 'percentage' ? 'Enter a value from 1 to 100.' : 'Enter the amount in your form currency.'}><div className="relative"><input id="discount-value" type="number" min="0" max={draft.type === 'percentage' ? 100 : undefined} step="0.01" className={`${controlClass} pr-12 tabular-nums`} placeholder={draft.type === 'percentage' ? '10' : '500'} value={draft.value} onChange={(event) => update({ value: event.target.value })} /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-[#8e8b82]">{draft.type === 'percentage' ? '%' : 'amount'}</span></div></Field>
                <Field label="Maximum uses" htmlFor="discount-max-uses" optional><input id="discount-max-uses" type="number" min="1" step="1" className={`${controlClass} tabular-nums`} value={draft.maxUses} onChange={(event) => update({ maxUses: event.target.value })} placeholder="Unlimited" /></Field>
                {draft.type === 'percentage' && <Field label="Maximum discount" htmlFor="discount-cap" optional hint="Caps the amount deducted from large orders."><input id="discount-cap" type="number" min="0" step="0.01" className={`${controlClass} tabular-nums`} value={draft.maxDiscount} onChange={(event) => update({ maxDiscount: event.target.value })} placeholder="No cap" /></Field>}
                <Field label="Minimum order" htmlFor="discount-minimum" optional><input id="discount-minimum" type="number" min="0" step="0.01" className={`${controlClass} tabular-nums`} value={draft.minAmount} onChange={(event) => update({ minAmount: event.target.value })} placeholder="No minimum" /></Field>
                <div className="sm:col-span-2"><Field label="Description" htmlFor="discount-description"><textarea id="discount-description" rows={3} className={`${controlClass} h-auto resize-none py-2.5 leading-6`} placeholder="Early-bird offer for workshop registrations" value={draft.description} onChange={(event) => update({ description: event.target.value })} /></Field></div>
              </div>
            </section>

            <section aria-labelledby={`${titleId}-forms`} className="rounded-xl border border-[#dfd8ce] bg-white p-4 sm:p-5">
              <SectionHeading id={`${titleId}-forms`} icon={<CheckCircle2 size={17} />} title="Form availability" detail="Choose where customers can use this code." />
              <button type="button" onClick={() => setFormSelectorOpen(true)} disabled={editableForms.length === 0} className="group flex w-full items-center gap-3 rounded-lg border border-[#e3ddd4] bg-[#faf8f4] p-3.5 text-left transition-colors hover:border-[#d3b2a5] hover:bg-[#fff8f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/25 disabled:cursor-not-allowed disabled:opacity-60">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${draft.formIds.length ? 'bg-[#f5e8e2] text-[#a9583e]' : 'bg-[#eeeae4] text-[#77736c]'}`}><FileText size={17} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#35322e]">{draft.formIds.length ? `${draft.formIds.length} ${draft.formIds.length === 1 ? 'form selected' : 'forms selected'}` : 'Select forms'}</span><span className="mt-0.5 block truncate text-xs text-[#858078]">{draft.formIds.length ? editableForms.filter((form) => draft.formIds.includes(form.id)).map((form) => form.title).join(' · ') : editableForms.length ? `${editableForms.length} available` : 'No editable forms available'}</span></span>
                <span className="flex items-center gap-1 text-xs font-medium text-[#a9583e]">Manage<ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
              </button>
              {!draft.formIds.length && <p className="mt-2 text-xs text-[#b33d3d]">Select at least one form.</p>}
            </section>

            <section aria-labelledby={`${titleId}-schedule`} className="rounded-xl border border-[#dfd8ce] bg-white p-4 sm:p-5">
              <SectionHeading id={`${titleId}-schedule`} icon={<CalendarDays size={17} />} title="Schedule" detail="Leave the dates blank to keep the code available indefinitely." />
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Starts at" htmlFor="discount-start" optional><input id="discount-start" type="datetime-local" className={controlClass} value={draft.startsAt} onChange={(event) => update({ startsAt: event.target.value })} /></Field><Field label="Expires at" htmlFor="discount-end" optional><input id="discount-end" type="datetime-local" className={controlClass} value={draft.expiresAt} onChange={(event) => update({ expiresAt: event.target.value })} /></Field></div>
            </section>

            {error && <div role="alert" className="rounded-lg border border-[#e3c5bd] bg-[#fff7f5] px-4 py-3 text-sm text-[#8a4034]">{error}</div>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#e1dbd2] bg-white px-5 py-4 sm:px-6"><Button type="button" variant="secondary" onClick={requestClose}>Cancel</Button><Button type="button" onClick={onSave} disabled={pending || !isValid}>{pending ? 'Saving…' : <><Check size={15} aria-hidden="true" />Save discount</>}</Button></div>
      </div>
    </div>
    {formSelectorOpen && <FormSelector forms={editableForms} selectedIds={draft.formIds} onSelectedIdsChange={(formIds) => update({ formIds })} onClose={() => setFormSelectorOpen(false)} />}
    </>
  )
}

const formPageSize = 5

function FormSelector({ forms, selectedIds, onSelectedIdsChange, onClose }: { forms: FormOption[]; selectedIds: number[]; onSelectedIdsChange: (ids: number[]) => void; onClose: () => void }) {
  const titleId = useId()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { phase, requestClose, transitionClass } = useTransitionClose(onClose, '--panel-close-dur', 350)
  const normalizedSearch = search.trim().toLowerCase()
  const filteredForms = useMemo(() => forms.filter((form) => {
    if (!normalizedSearch) return true
    const paymentText = form.payment ? `${form.payment.mode} ${form.payment.gatewayName ?? 'customer choice'} ${form.payment.currency} ${form.payment.pricingMode}` : 'no payment'
    return `${form.title} ${form.description ?? ''} ${form.status} ${form.accessRole} ${paymentText}`.toLowerCase().includes(normalizedSearch)
  }), [forms, normalizedSearch])
  const totalPages = Math.max(1, Math.ceil(filteredForms.length / formPageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleForms = filteredForms.slice((currentPage - 1) * formPageSize, currentPage * formPageSize)
  const allResultsSelected = filteredForms.length > 0 && filteredForms.every((form) => selectedIds.includes(form.id))

  useEffect(() => { setPage((current) => Math.min(current, totalPages)) }, [totalPages])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') requestClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [requestClose])

  function toggleForm(formId: number) {
    onSelectedIdsChange(selectedIds.includes(formId) ? selectedIds.filter((id) => id !== formId) : [...selectedIds, formId])
  }

  function toggleAllResults() {
    const resultIds = new Set(filteredForms.map((form) => form.id))
    if (allResultsSelected) onSelectedIdsChange(selectedIds.filter((id) => !resultIds.has(id)))
    else onSelectedIdsChange([...new Set([...selectedIds, ...resultIds])])
  }

  return (
    <div className={`t-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px] md:items-stretch md:justify-end md:p-0 ${transitionClass}`} onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose() }} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div data-open={phase === 'open'} className="t-panel-slide discount-form-drawer flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/60 bg-[#f7f4ef] shadow-[0_28px_90px_rgba(20,20,19,0.3)] md:h-full md:max-h-none md:max-w-xl md:rounded-none md:border-y-0 md:border-r-0 md:border-l-[#d9d2c9]">
        <div className="flex items-center justify-between border-b border-[#3b3935] bg-[#242320] px-5 py-4 text-white sm:px-6">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#aaa69f]">Discount availability</p><h2 id={titleId} className="mt-0.5 text-lg font-semibold">Choose forms</h2></div>
          <button type="button" onClick={requestClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#aaa69f] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7a58f]" aria-label="Close form selector"><X size={18} /></button>
        </div>

        <div className="border-b border-[#e1dbd2] bg-white px-4 py-4 sm:px-6">
          <div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#918c84]" aria-hidden="true" /><input autoFocus type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search forms, payments, or status" aria-label="Search forms" className={`${controlClass} pl-9`} /></div>
          <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-[#77736c]">{filteredForms.length} {filteredForms.length === 1 ? 'form' : 'forms'} · {selectedIds.length} selected</p>{filteredForms.length > 0 && <button type="button" onClick={toggleAllResults} className="text-xs font-medium text-[#a9583e] hover:text-[#7f432f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30">{allResultsSelected ? 'Clear results' : 'Select all results'}</button>}</div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {visibleForms.length ? <div className="space-y-3">{visibleForms.map((form, index) => {
            const selected = selectedIds.includes(form.id)
            return (
              <label key={form.id} style={{ animationDelay: `${70 + index * 32}ms` }} className={`ponko-list-item-enter block cursor-pointer rounded-xl border p-4 transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.995] ${selected ? 'border-[#d5a28f] bg-[#fff8f5] shadow-[0_0_0_1px_rgba(204,120,92,0.08)]' : 'border-[#dfd8ce] bg-white hover:-translate-y-0.5 hover:border-[#cfc5b9] hover:shadow-[0_5px_16px_rgba(20,20,19,0.06)]'}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selected} onChange={() => toggleForm(form.id)} className="mt-1 h-4 w-4 shrink-0 rounded border-[#d9d0c5] text-[#cc785c] focus:ring-[#cc785c]/30" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#242320]">{form.title}</span><Badge variant={form.status === 'published' ? 'published' : 'draft'}>{form.status === 'published' ? 'Published' : 'Draft'}</Badge></span>
                    {form.description && <span className="mt-1 block line-clamp-2 text-xs leading-5 text-[#77736c]">{form.description}</span>}
                    <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#eee8e0] pt-3 text-xs text-[#77736c]">
                      {form.payment ? <><span className="inline-flex items-center gap-1.5 font-medium text-[#4d4943]"><CreditCard size={14} className="text-[#a9583e]" aria-hidden="true" />{form.payment.mode === 'subscription' ? 'Subscription' : 'One-time payment'}</span><span>{form.payment.gatewayName ?? 'Customer chooses gateway'}</span><span>{form.payment.currency}</span><span>{pricingModeLabel(form.payment.pricingMode)}</span></> : <span className="inline-flex items-center gap-1.5"><CreditCard size={14} aria-hidden="true" />No payment</span>}
                      <span className="capitalize">{form.accessRole}</span>
                    </span>
                  </span>
                  {selected && <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#cc785c] text-white"><Check size={14} aria-hidden="true" /></span>}
                </div>
              </label>
            )
          })}</div> : <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[#d7cfc5] bg-white px-6 text-center"><Search size={22} className="text-[#b4ada4]" aria-hidden="true" /><h3 className="mt-3 text-sm font-semibold text-[#35322e]">No matching forms</h3><p className="mt-1 text-xs leading-5 text-[#858078]">Try a form name, payment type, gateway, or status.</p></div>}
        </div>

        <div className="border-t border-[#e1dbd2] bg-white px-4 py-3 sm:px-6">
          {totalPages > 1 && <div className="mb-3 flex items-center justify-between"><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="inline-flex h-8 items-center gap-1 rounded-md border border-[#ded8cf] px-2.5 text-xs font-medium text-[#57544d] disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={14} aria-hidden="true" />Previous</button><span className="text-xs tabular-nums text-[#77736c]">Page {currentPage} of {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="inline-flex h-8 items-center gap-1 rounded-md border border-[#ded8cf] px-2.5 text-xs font-medium text-[#57544d] disabled:cursor-not-allowed disabled:opacity-40">Next<ChevronRight size={14} aria-hidden="true" /></button></div>}
          <Button type="button" onClick={requestClose} className="w-full">Done · {selectedIds.length} selected</Button>
        </div>
      </div>
    </div>
  )
}

function pricingModeLabel(mode: string) {
  return ({ fixed: 'Fixed price', formula: 'Formula', field: 'Field amount', sum_priced_options: 'Priced options', sum_number_fields: 'Number fields', configured: 'Configured amount' } as Record<string, string>)[mode] ?? 'Configured amount'
}

function Field({ label, htmlFor, optional, hint, children }: { label: string; htmlFor: string; optional?: boolean; hint?: string; children: React.ReactNode }) {
  return <div><label htmlFor={htmlFor} className={labelClass}>{label}{optional && <span className="font-normal text-[#918c84]"> (optional)</span>}</label>{children}{hint && <p className="mt-1.5 text-xs leading-5 text-[#858078]">{hint}</p>}</div>
}

function SectionHeading({ id, icon, title, detail, className = 'mb-4' }: { id: string; icon: React.ReactNode; title: string; detail: string; className?: string }) {
  return <div className={`flex items-center gap-2.5 ${className}`}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f5eee8] text-[#a9583e]">{icon}</span><div><h3 id={id} className="text-sm font-semibold text-[#242320]">{title}</h3><p className="mt-0.5 text-xs text-[#858078]">{detail}</p></div></div>
}

function DiscountStat({ value, label }: { value: number; label: string }) {
  return <div className="flex flex-col justify-center px-6 py-4 text-center sm:py-5"><p className="text-xl font-semibold tabular-nums">{value}</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#aaa69f]">{label}</p></div>
}

function DiscountLoading() {
  return <main className="min-h-[calc(100dvh-4rem)] bg-[#f7f4ef]"><div className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><div role="status" aria-label="Loading discounts" className="space-y-6"><div className="h-24 animate-pulse rounded-xl bg-white motion-reduce:animate-none" /><div className="h-32 animate-pulse rounded-xl bg-[#242320]/15 motion-reduce:animate-none" /><div className="grid gap-4 lg:grid-cols-2"><div className="h-52 animate-pulse rounded-xl bg-white motion-reduce:animate-none" /><div className="h-52 animate-pulse rounded-xl bg-white motion-reduce:animate-none" /></div></div></div></main>
}

function DiscountError({ onRetry }: { onRetry: () => void }) {
  return <main className="min-h-[calc(100dvh-4rem)] bg-[#f7f4ef]"><div className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><div role="alert" className="rounded-xl border border-[#d7a84c] bg-[#fff8e7] p-6 text-[#6b4f16]"><h1 className="font-semibold text-[#242320]">Discounts couldn&apos;t be loaded</h1><p className="mt-1 text-sm">Check your connection and try loading this page again.</p><Button type="button" variant="secondary" className="mt-4" onClick={onRetry}>Try again</Button></div></div></main>
}
