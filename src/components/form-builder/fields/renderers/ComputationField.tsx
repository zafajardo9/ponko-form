import type { FieldConfig, FieldValue } from '../../../../lib/form-field-types'

interface Props {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
}

export function ComputationField({ field, value }: Props) {
  const comp = field.validationRules?.computation
  // Hidden computation — still runs server-side but not shown to respondent
  if (comp?.visible === false) return null

  const isText = comp?.outputMode === 'text'
  const strVal = String(value ?? '')
  const amount = Number(value ?? 0)
  const decimalPlaces = Math.min(10, Math.max(0, Number(comp?.decimalPlaces ?? 2)))
  const display = isText
    ? strVal || '\u2014'
    : Number.isFinite(amount)
      ? new Intl.NumberFormat(undefined, comp?.numericType === 'integer'
        ? { maximumFractionDigits: 0 }
        : comp?.numericType === 'decimal'
          ? { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }
          : { maximumFractionDigits: 10 }).format(amount)
      : '0'

  const label = field.label || (isText ? 'Combined' : 'Total')

  return (
    <div className="overflow-hidden rounded-[var(--ponko-radius-card,16px)] border border-[#e6dfd8] bg-white shadow-[0_1px_2px_rgba(20,20,19,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#e6dfd8] bg-[#faf9f5] px-4 py-2.5">
        <p className="text-sm font-medium text-[var(--ponko-foreground,#141413)]">{label}</p>
        <span className="rounded-full bg-[var(--ponko-primary-soft,#cc785c29)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ponko-primary,#cc785c)]">
          Auto
        </span>
      </div>
      <div className="px-4 py-3.5">
        <p
          className={
            isText
              ? 'text-base leading-relaxed text-[var(--ponko-foreground,#141413)]'
              : 'text-2xl font-semibold tracking-tight text-[var(--ponko-foreground,#141413)]'
          }
        >
          {display}
        </p>
        {field.placeholder && (
          <p className="mt-1.5 text-xs leading-5 text-[var(--ponko-foreground-faint,#8e8b82)]">{field.placeholder}</p>
        )}
      </div>
    </div>
  )
}
