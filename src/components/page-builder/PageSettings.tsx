import { useState } from 'react'
import type {
  FormPage,
  FormReference,
  FormReferenceType,
  PageField,
  SubscriptionIntervalPreset,
} from '../../lib/page-builder/types'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Field, inputClass } from './Shared'
import { slugForBinding, slugForOptionValue, tempId } from './PageBuilderUtils'

interface PageSettingsProps {
  page: FormPage
  gateways: { id: number; name: string; slug: string }[]
  pages: FormPage[]
  references: FormReference[]
  onUpdate: (patch: Partial<FormPage>) => void
  onDelete: () => void
}

function referenceValueForType(type: FormReferenceType, value: string) {
  if (type === 'boolean') return value === 'true' ? 'true' : 'false'
  if (type === 'percentage') {
    const cleaned = value.replace('%', '').trim()
    return cleaned.endsWith('%') ? cleaned : `${cleaned || '0'}%`
  }
  return value
}

export function ReferencesPanel({
  formId,
  references,
  fields,
  onChange,
}: {
  formId: number
  references: FormReference[]
  fields: PageField[]
  onChange: (references: FormReference[]) => void
}) {
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState({
    key: '',
    type: 'number' as FormReferenceType,
    value: '0',
    label: '',
    description: '',
  })
  const fieldBindings = new Set(fields.map((field) => field.bindVariable))

  function startNew() {
    const used = new Set([...references.map((reference) => reference.key), ...fieldBindings])
    const key = slugForBinding('reference', used)
    setDraft({ key, type: 'number', value: '0', label: '', description: '' })
    setEditingId('new')
  }

  function startEdit(reference: FormReference) {
    setDraft({
      key: reference.key,
      type: reference.type,
      value: reference.type === 'percentage' ? reference.value.replace('%', '').trim() : reference.value,
      label: reference.label ?? '',
      description: reference.description ?? '',
    })
    setEditingId(reference.id)
  }

  function save() {
    const nextReference: FormReference = {
      id: editingId === 'new' ? tempId() : editingId as number,
      formId,
      key: draft.key,
      type: draft.type,
      value: referenceValueForType(draft.type, draft.value),
      label: draft.label || null,
      description: draft.description || null,
      position: editingId === 'new' ? references.length : references.findIndex((reference) => reference.id === editingId),
    }
    if (editingId === 'new') onChange([...references, nextReference])
    else onChange(references.map((reference) => (reference.id === editingId ? nextReference : reference)))
    setEditingId(null)
  }
  const duplicateKey = references.some((reference) => reference.id !== editingId && reference.key === draft.key)
  const bindingCollision = fieldBindings.has(draft.key)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-[#8e8b82]">References</p>
          <h3 className="mt-1 text-lg font-medium text-[#141413]">Reference variables</h3>
        </div>
        <Button type="button" size="sm" onClick={startNew}>
          Add
        </Button>
      </div>

      {(duplicateKey || bindingCollision) && editingId && (
        <p className="rounded-lg border border-[#f0c2b8] bg-[#fff3ef] p-3 text-sm text-[#c64545]">
          {bindingCollision ? 'This key is already used as a field binding.' : 'This key is already used by another reference.'}
        </p>
      )}

      {editingId && (
        <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3">
          <div className="grid grid-cols-1 gap-3">
            <Field label="Key">
              <input
                value={draft.key}
                onChange={(e) => setDraft((item) => ({ ...item, key: slugForOptionValue(e.target.value) }))}
                className={inputClass}
              />
            </Field>
            <Field label="Type">
              <select
                value={draft.type}
                onChange={(e) =>
                  setDraft((item) => ({
                    ...item,
                    type: e.target.value as FormReferenceType,
                    value: e.target.value === 'boolean'
                      ? 'false'
                      : e.target.value === 'number'
                        ? '0'
                        : e.target.value === 'percentage'
                          ? '12'
                          : '',
                  }))
                }
                className={inputClass}
              >
                <option value="number">Number</option>
                <option value="percentage">Percentage</option>
                <option value="text">Text</option>
                <option value="boolean">Boolean</option>
              </select>
            </Field>
            <Field label="Value">
              {draft.type === 'boolean' ? (
                <select
                  value={draft.value}
                  onChange={(e) => setDraft((item) => ({ ...item, value: e.target.value }))}
                  className={inputClass}
                >
                  <option value="false">False</option>
                  <option value="true">True</option>
                </select>
              ) : (
                <div className="relative">
                  <input
                    type={draft.type === 'number' || draft.type === 'percentage' ? 'number' : 'text'}
                    step={draft.type === 'number' || draft.type === 'percentage' ? '0.01' : undefined}
                    value={draft.value}
                    onChange={(e) => setDraft((item) => ({ ...item, value: e.target.value }))}
                    className={`${inputClass} ${draft.type === 'percentage' ? 'pr-10' : ''}`}
                    placeholder={draft.type === 'percentage' ? '12' : undefined}
                  />
                  {draft.type === 'percentage' && (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#8e8b82]">
                      %
                    </span>
                  )}
                </div>
              )}
            </Field>
            <Field label="Label">
              <input
                value={draft.label}
                onChange={(e) => setDraft((item) => ({ ...item, label: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((item) => ({ ...item, description: e.target.value }))}
                rows={3}
                className={`${inputClass} h-auto resize-none`}
              />
            </Field>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={save} disabled={duplicateKey || bindingCollision || !draft.key}>
                Save Reference
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {references.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#e6dfd8] bg-[#faf9f5] p-6 text-sm text-[#8e8b82]">
          Add prices, fees, VAT rates, and thresholds once, then reference them in options, payments, and logic.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {references.map((reference) => (
            <div key={reference.id} className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#141413]">{reference.label || reference.key}</p>
                  <p className="mt-0.5 text-xs text-[#8e8b82]">
                    {`{{${reference.key}}}`} · {reference.type} · {reference.value}
                  </p>
                  {reference.description && <p className="mt-2 text-xs text-[#6c6a64]">{reference.description}</p>}
                </div>
                <div className="flex flex-none gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(reference)}
                    className="rounded-md px-2 py-1 text-xs text-[#6c6a64] hover:bg-white hover:text-[#141413]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(references.filter((item) => item.id !== reference.id))}
                    className="rounded-md px-2 py-1 text-xs text-[#c64545] hover:bg-[#fff3ef]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function PageSettings({ page, gateways, pages, references, onUpdate, onDelete }: PageSettingsProps) {
  const numberReferences = references.filter((reference) => reference.type === 'number' || reference.type === 'percentage')
  const availablePaymentFields = pages
    .filter((candidate) => candidate.position <= page.position && !candidate.isFinal)
    .flatMap((candidate) => candidate.fields)
  const pricedOptionFields = availablePaymentFields.filter((field) =>
    ['select', 'checkbox', 'radio'].includes(field.fieldType) &&
    field.validationRules?.optionPricesEnabled &&
    field.options?.some((option) =>
      Number(option.price ?? 0) > 0 ||
      Number(option.additionalPrice ?? 0) > 0 ||
      Boolean(option.priceReference) ||
      Boolean(option.additionalPriceReference),
    ),
  )
  const numberFields = availablePaymentFields.filter((field) =>
    field.fieldType === 'number' ||
    (field.fieldType === 'computation' && field.validationRules?.computation?.outputMode !== 'text'),
  )
  const earlierFields = pages
    .filter((candidate) => candidate.position < page.position)
    .flatMap((candidate) => candidate.fields)
  const customerNameFields = earlierFields.filter((field) => ['text', 'textarea'].includes(field.fieldType))
  const customerEmailFields = earlierFields.filter((field) => field.fieldType === 'email')
  const xenditGateway = gateways.find((gateway) => gateway.slug === 'xendit')
  const subscriptionConfig = page.subscriptionConfig
  const paymentComputation = page.paymentComputation ?? {
    mode: page.paymentAmountVariable ? 'field' : 'sum_priced_options',
    fieldBindings: page.paymentAmountVariable ? [page.paymentAmountVariable] : [],
    fixedAmount: null,
  }

  function updatePaymentComputation(patch: Partial<NonNullable<FormPage['paymentComputation']>>) {
    const next = { ...paymentComputation, ...patch } as NonNullable<FormPage['paymentComputation']>
    onUpdate({
      paymentComputation: next,
      paymentAmountVariable: next.mode === 'field' ? next.fieldBindings?.[0] ?? null : null,
    })
  }

  function togglePaymentBinding(binding: string, checked: boolean) {
    const current = new Set(paymentComputation.fieldBindings ?? [])
    if (checked) current.add(binding)
    else current.delete(binding)
    updatePaymentComputation({ fieldBindings: [...current] })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium uppercase text-[#8e8b82]">
          {page.isFinal ? 'Final page' : 'Page settings'}
        </p>
        <h3 className="mt-1 text-lg font-medium text-[#141413]">{page.title}</h3>
      </div>

      <Field label="Title">
        <input value={page.title} onChange={(e) => onUpdate({ title: e.target.value })} className={inputClass} />
      </Field>

      {!page.isFinal && (
        <Field label="Description">
          <textarea
            value={page.description ?? ''}
            onChange={(e) => onUpdate({ description: e.target.value || null })}
            rows={3}
            className={`${inputClass} h-auto resize-none`}
          />
        </Field>
      )}

      {page.isFinal ? (
        <>
          <Field label="Template">
            <textarea
              value={page.finalTemplate ?? ''}
              onChange={(e) => onUpdate({ finalTemplate: e.target.value })}
              rows={6}
              className={`${inputClass} h-auto resize-none`}
            />
          </Field>
          <Field label="Redirect URL">
            <input
              value={page.finalRedirectUrl ?? ''}
              onChange={(e) => onUpdate({ finalRedirectUrl: e.target.value || null })}
              className={inputClass}
              placeholder="https://example.com/thanks"
            />
          </Field>
        </>
      ) : (
        <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3">
          <label className="flex items-center gap-2 text-sm text-[#141413]">
            <input
              type="checkbox"
              checked={page.hasPayment}
              onChange={(e) => onUpdate({ hasPayment: e.target.checked })}
              className="h-4 w-4 accent-[#cc785c]"
            />
            Payment page
          </label>
          {page.hasPayment && (
            <div className="mt-3 flex flex-col gap-3">
              <Field label="Gateway">
                <select
                  value={page.paymentGatewayId ?? ''}
                  onChange={(e) => onUpdate({ paymentGatewayId: e.target.value ? Number(e.target.value) : null })}
                  className={inputClass}
                  disabled={Boolean(page.subscriptionConfig)}
                >
                  {!page.subscriptionConfig && <option value="">Visitor chooses connected gateway</option>}
                  {gateways.filter((gateway) => !page.subscriptionConfig || gateway.slug === 'xendit').map((gateway) => (
                    <option key={gateway.id} value={gateway.id}>
                      {gateway.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Payment mode">
                <select
                  value={page.subscriptionConfig ? 'subscription' : 'one_time'}
                  onChange={(event) => {
                    if (event.target.value === 'one_time') {
                      onUpdate({ subscriptionConfig: null })
                      return
                    }
                    onUpdate({
                      paymentGatewayId: xenditGateway?.id ?? null,
                      paymentCurrency: 'PHP',
                      subscriptionConfig: {
                        enabled: true,
                        interval: 'monthly',
                        intervalUnit: 'MONTH',
                        intervalCount: 1,
                        trialPeriodDays: 0,
                        maxCycles: null,
                        customerNameField: customerNameFields[0]?.bindVariable ?? '',
                        customerEmailField: customerEmailFields[0]?.bindVariable ?? '',
                      },
                    })
                  }}
                  className={inputClass}
                >
                  <option value="one_time">One-time payment</option>
                  <option value="subscription">Subscription</option>
                </select>
              </Field>
              {subscriptionConfig && (
                <div className="rounded-lg border border-[#e6dfd8] bg-white p-3">
                  <p className="text-sm font-medium text-[#141413]">Subscription schedule</p>
                  {!xenditGateway && (
                    <p className="mt-2 text-xs text-[#a9583e]">Xendit must be active before this form can be saved.</p>
                  )}
                  <div className="mt-3 flex flex-col gap-3">
                    <Field label="Billing interval">
                      <select
                        value={subscriptionConfig.interval}
                        onChange={(event) => {
                          const interval = event.target.value as SubscriptionIntervalPreset
                          const mapping = {
                            weekly: { intervalUnit: 'WEEK' as const, intervalCount: 1 },
                            monthly: { intervalUnit: 'MONTH' as const, intervalCount: 1 },
                            quarterly: { intervalUnit: 'MONTH' as const, intervalCount: 3 },
                            semiannual: { intervalUnit: 'MONTH' as const, intervalCount: 6 },
                            annual: { intervalUnit: 'MONTH' as const, intervalCount: 12 },
                          }[interval]
                          onUpdate({ subscriptionConfig: { ...subscriptionConfig, interval, ...mapping } })
                        }}
                        className={inputClass}
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="semiannual">Semiannual</option>
                        <option value="annual">Annual</option>
                      </select>
                    </Field>
                    <Field label="Customer name field">
                      <select
                        value={subscriptionConfig.customerNameField}
                        onChange={(event) => onUpdate({ subscriptionConfig: {
                          ...subscriptionConfig, customerNameField: event.target.value,
                        } })}
                        className={inputClass}
                      >
                        <option value="">Select an earlier name field...</option>
                        {customerNameFields.map((field) => <option key={field.id} value={field.bindVariable}>{field.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Customer email field">
                      <select
                        value={subscriptionConfig.customerEmailField}
                        onChange={(event) => onUpdate({ subscriptionConfig: {
                          ...subscriptionConfig, customerEmailField: event.target.value,
                        } })}
                        className={inputClass}
                      >
                        <option value="">Select an earlier email field...</option>
                        {customerEmailFields.map((field) => <option key={field.id} value={field.bindVariable}>{field.label}</option>)}
                      </select>
                    </Field>
                    {(customerNameFields.length === 0 || customerEmailFields.length === 0) && (
                      <p className="text-xs leading-relaxed text-[#a9583e]">
                        Add required Name (text) and Email fields on a page before this payment page.
                      </p>
                    )}
                    <Field label="Trial period (days)">
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={subscriptionConfig.trialPeriodDays}
                        onChange={(event) => onUpdate({ subscriptionConfig: {
                          ...subscriptionConfig, trialPeriodDays: Math.max(0, Number(event.target.value) || 0),
                        } })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Maximum billing cycles">
                      <input
                        type="number"
                        min={1}
                        max={32000}
                        value={subscriptionConfig.maxCycles ?? ''}
                        placeholder="No limit"
                        onChange={(event) => onUpdate({ subscriptionConfig: {
                          ...subscriptionConfig,
                          maxCycles: event.target.value === '' ? null : Math.max(1, Number(event.target.value) || 1),
                        } })}
                        className={inputClass}
                      />
                    </Field>
                    <p className="text-xs leading-relaxed text-[#8e8b82]">
                      Editing this schedule affects new subscribers only. Existing plans continue with their original schedule.
                    </p>
                  </div>
                </div>
              )}
              <div className="rounded-lg border border-[#e6dfd8] bg-white p-3">
                <p className="text-sm font-medium text-[#141413]">Payment computation</p>
                <div className="mt-3 flex flex-col gap-3">
                  <Field label="Amount mode">
                    <select
                      value={paymentComputation.mode}
                      onChange={(e) => {
                        const mode = e.target.value as NonNullable<FormPage['paymentComputation']>['mode']
                        updatePaymentComputation({
                          mode,
                          fieldBindings: mode === 'field'
                            ? [page.paymentAmountVariable ?? numberFields[0]?.bindVariable ?? ''].filter(Boolean)
                            : mode === 'sum_priced_options' || mode === 'formula'
                              ? pricedOptionFields.map((field) => field.bindVariable)
                              : mode === 'sum_number_fields'
                                ? numberFields.map((field) => field.bindVariable)
                            : [],
                          fixedAmount: mode === 'fixed' ? paymentComputation.fixedAmount ?? 0 : null,
                          adjustments: mode === 'formula' ? paymentComputation.adjustments ?? [] : [],
                        })
                      }}
                      className={inputClass}
                    >
                      <option value="sum_priced_options">Sum selected option prices</option>
                      <option value="sum_number_fields">Sum number fields</option>
                      <option value="formula">Formula builder</option>
                      <option value="field">Use one amount field</option>
                      <option value="fixed">Fixed amount</option>
                    </select>
                  </Field>

                  {paymentComputation.mode === 'field' && (
                    <Field label="Amount field">
                      <select
                        value={paymentComputation.fieldBindings?.[0] ?? ''}
                        onChange={(e) => updatePaymentComputation({ fieldBindings: e.target.value ? [e.target.value] : [] })}
                        className={inputClass}
                      >
                        <option value="">Select amount field...</option>
                        {numberFields.map((field) => (
                          <option key={field.id} value={field.bindVariable}>
                            {field.label || field.bindVariable} {`{{${field.bindVariable}}}`}
                          </option>
                        ))}
                      </select>
                      {numberFields.length === 0 && (
                        <p className="mt-1 text-xs leading-relaxed text-[#a9583e]">
                          Add a number field or a numeric calculation on this page or an earlier page.
                        </p>
                      )}
                    </Field>
                  )}

                  {paymentComputation.mode === 'fixed' && (
                    <Field label="Fixed amount">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={paymentComputation.fixedAmount ?? ''}
                        onChange={(e) => updatePaymentComputation({ fixedAmount: e.target.value === '' ? null : Number(e.target.value) })}
                        className={inputClass}
                      />
                    </Field>
                  )}

                  {paymentComputation.mode === 'sum_priced_options' && (
                    <PaymentFieldChecklist
                      fields={pricedOptionFields}
                      selected={paymentComputation.fieldBindings ?? []}
                      emptyText="No priced option fields yet. Enable option prices on a checkbox, radio, or dropdown field first."
                      onToggle={togglePaymentBinding}
                    />
                  )}

                  {paymentComputation.mode === 'sum_number_fields' && (
                    <PaymentFieldChecklist
                      fields={numberFields}
                      selected={paymentComputation.fieldBindings ?? []}
                      emptyText="No number fields yet."
                      onToggle={togglePaymentBinding}
                    />
                  )}

                  {paymentComputation.mode === 'formula' && (
                    <>
                      <PaymentFieldChecklist
                        fields={pricedOptionFields}
                        selected={paymentComputation.fieldBindings ?? []}
                        emptyText="No priced option fields yet. Enable option prices on a checkbox, radio, or dropdown field first."
                        onToggle={togglePaymentBinding}
                      />
                      <FormulaAdjustmentsEditor
                        references={numberReferences}
                        adjustments={paymentComputation.adjustments ?? []}
                        onChange={(adjustments) => updatePaymentComputation({ adjustments })}
                      />
                    </>
                  )}
                </div>
              </div>
              <Field label="Currency">
                <input
                  value={page.paymentCurrency}
                  onChange={(e) => onUpdate({ paymentCurrency: e.target.value.toUpperCase().slice(0, 3) })}
                  className={inputClass}
                  disabled={Boolean(page.subscriptionConfig)}
                />
              </Field>
              <label className="flex items-center gap-2 rounded-lg border border-[#e6dfd8] bg-white p-3 text-sm text-[#141413]">
                <input
                  type="checkbox"
                  checked={Boolean(paymentComputation.showBreakdown)}
                  onChange={(e) => updatePaymentComputation({ showBreakdown: e.target.checked })}
                  className="h-4 w-4 accent-[#cc785c]"
                />
                Show price breakdown before payment
              </label>
            </div>
          )}
        </div>
      )}

      {!page.isFinal && (
        <Button type="button" variant="danger" onClick={onDelete}>
          Delete Page
        </Button>
      )}
    </div>
  )
}

export function PaymentFieldChecklist({
  fields,
  selected,
  emptyText,
  onToggle,
}: {
  fields: PageField[]
  selected: string[]
  emptyText: string
  onToggle: (binding: string, checked: boolean) => void
}) {
  if (fields.length === 0) {
    return <p className="rounded-md bg-[#faf9f5] p-3 text-sm text-[#8e8b82]">{emptyText}</p>
  }

  const selectedSet = new Set(selected)
  return (
    <div className="rounded-md border border-[#e6dfd8] bg-[#faf9f5] p-3">
      <p className="mb-2 text-xs font-medium uppercase text-[#8e8b82]">Include fields</p>
      <div className="flex flex-col gap-2">
        {fields.map((field) => (
          <label key={field.id} className="flex items-center gap-2 text-sm text-[#3d3d3a]">
            <input
              type="checkbox"
              checked={selectedSet.has(field.bindVariable)}
              onChange={(e) => onToggle(field.bindVariable, e.target.checked)}
              className="h-4 w-4 accent-[#cc785c]"
            />
            {field.label || field.bindVariable}
          </label>
        ))}
      </div>
    </div>
  )
}

export function FormulaAdjustmentsEditor({
  references,
  adjustments,
  onChange,
}: {
  references: FormReference[]
  adjustments: NonNullable<FormPage['paymentComputation']>['adjustments']
  onChange: (adjustments: NonNullable<FormPage['paymentComputation']>['adjustments']) => void
}) {
  const items = adjustments ?? []

  function update(index: number, patch: Partial<{ type: 'add' | 'subtract' | 'multiply'; referenceKey: string }>) {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  function add() {
    const referenceKey = references[0]?.key ?? ''
    onChange([...items, { type: 'add', referenceKey }])
  }

  return (
    <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#141413]">Formula adjustments</p>
          <p className="mt-0.5 text-xs text-[#8e8b82]">Apply fees, discounts, VAT, or multipliers from number and percentage references.</p>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={references.length === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e6dfd8] bg-white px-2.5 text-xs font-medium text-[#3d3d3a] hover:border-[#cc785c] hover:text-[#141413] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={13} /> Add
        </button>
      </div>
      {references.length === 0 ? (
        <p className="text-sm text-[#8e8b82]">Create a number or percentage reference first.</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#8e8b82]">No adjustments yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item, index) => (
            <div key={`${item.referenceKey}-${index}`} className="grid grid-cols-[120px_minmax(0,1fr)_auto] gap-2">
              <select
                value={item.type}
                onChange={(e) => update(index, { type: e.target.value as 'add' | 'subtract' | 'multiply' })}
                className={inputClass}
              >
                <option value="add">+ Add</option>
                <option value="subtract">- Subtract</option>
                <option value="multiply">+ Percent</option>
              </select>
              <select
                value={item.referenceKey}
                onChange={(e) => update(index, { referenceKey: e.target.value })}
                className={inputClass}
              >
                {references.map((reference) => (
                  <option key={reference.id} value={reference.key}>
                    {reference.label || reference.key} = {reference.value}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                className="flex h-10 w-10 items-center justify-center rounded-md text-[#c64545] hover:bg-[#fff3ef]"
                title="Remove adjustment"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

