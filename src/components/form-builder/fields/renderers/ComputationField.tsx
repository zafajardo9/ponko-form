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

  return (
    <div className="rounded-[var(--ponko-radius,6px)] border border-[#e6dfd8] bg-[#faf9f5] p-4">
      <p className="text-sm font-medium text-[#141413]">{field.label || (isText ? 'Combined' : 'Total')}</p>
      {field.placeholder && <p className="mt-1 text-xs text-[#8e8b82]">{field.placeholder}</p>}
      <p className={isText ? 'mt-2 text-lg font-medium text-[#141413]' : 'mt-3 text-3xl font-medium text-[#141413]'}>
        {display}
      </p>
    </div>
  )
}
