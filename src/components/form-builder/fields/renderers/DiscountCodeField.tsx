import { useState } from 'react'
import { Check, Loader2, Tag, X } from 'lucide-react'
import type { FieldConfig, FieldValue } from '../../../../lib/form-field-types'
import { inputBase, getStrValue } from './utils'

export interface DiscountFieldContext {
  formId?: number
  amountMajor?: number
  respondentEmail?: string
  validate?: (code: string, amountMinor: number, respondentEmail?: string) => Promise<{
    valid: boolean
    reason?: string
    code?: string
    description?: string | null
    type?: 'percentage' | 'fixed'
    value?: number
    discountAmount?: number
    originalAmount?: number
    finalAmount?: number
  }>
  onDiscountApplied?: (discount: {
    code: string
    description: string | null
    type: 'percentage' | 'fixed'
    value: number
    discountAmount: number
    originalAmount: number
    finalAmount: number
  } | null) => void
}

interface Props {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
  hideLabel?: boolean
  context?: DiscountFieldContext
}

export function DiscountCodeField({ field, value, onChange, readOnly, hideLabel, context }: Props) {
  const code = getStrValue(value)
  const [message, setMessage] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)
  const [pending, setPending] = useState(false)
  const inputId = `field-input-${field.id}`

  async function apply() {
    if (!context?.formId || !context.validate) {
      setMessage('Discount codes are unavailable in preview mode.')
      return
    }
    setPending(true)
    setMessage(null)
    try {
      const result = await context.validate(code, Math.round((context.amountMajor ?? 0) * 100), context.respondentEmail)
      if (!result.valid || !result.code) {
        setApplied(false)
        context.onDiscountApplied?.(null)
        setMessage(result.reason ?? 'Invalid discount code')
        return
      }
      setApplied(true)
      context.onDiscountApplied?.({
        code: result.code,
        description: result.description ?? null,
        type: result.type ?? 'fixed',
        value: result.value ?? 0,
        discountAmount: result.discountAmount ?? 0,
        originalAmount: result.originalAmount ?? 0,
        finalAmount: result.finalAmount ?? 0,
      })
      setMessage(`Code applied — ${(result.discountAmount ?? 0) / 100} off`)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Unable to validate this code')
    } finally {
      setPending(false)
    }
  }

  function clear() {
    onChange('')
    setApplied(false)
    setMessage(null)
    context?.onDiscountApplied?.(null)
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {!hideLabel && (
        <label htmlFor={inputId} className="text-sm font-medium text-[#141413]">
          <span className="inline-flex items-center gap-1.5"><Tag size={14} className="text-[#cc785c]" />{field.label || 'Discount code'}</span>
          {field.required && <span aria-hidden="true" className="ml-1 text-[#c64545]">*</span>}
        </label>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id={inputId} type="text" placeholder={field.placeholder ?? 'Enter code'} value={code}
          onChange={(event) => {
            onChange(event.target.value.toUpperCase())
            setApplied(false)
            setMessage(null)
            context?.onDiscountApplied?.(null)
          }} disabled={readOnly || pending} required={field.required}
          aria-invalid={message && !applied ? true : undefined} className={`${inputBase} h-10 flex-1 ${message && !applied ? 'border-[#c64545]' : ''}`} />
        {applied ? (
          <button type="button" onClick={clear} disabled={readOnly || pending} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#b8dfc0] px-3 text-sm font-medium text-[#2d7a3e] hover:bg-[#edf7ef]"><X size={14} /> Remove</button>
        ) : (
          <button type="button" onClick={apply} disabled={readOnly || pending || !code.trim()} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-[#141413] px-4 text-sm font-medium text-white hover:bg-[#2b2b28] disabled:opacity-50">{pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Apply</button>
        )}
      </div>
      {message && <p role="status" className={`text-xs ${applied ? 'text-[#2d7a3e]' : 'text-[#c64545]'}`}>{message}</p>}
    </div>
  )
}
