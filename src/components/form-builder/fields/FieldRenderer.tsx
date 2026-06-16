export interface FieldConfig {
  id: number
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'payment' | 'date' | 'time' | 'datetime'
  label: string
  placeholder?: string | null
  required: boolean
  options?: { label: string; value: string }[] | null | undefined
}

interface FieldRendererProps {
  field: FieldConfig
  value: string | string[]
  onChange: (value: string | string[]) => void
  error?: string
  readOnly?: boolean
}

export function FieldRenderer({ field, value, onChange, error, readOnly }: FieldRendererProps) {
  const inputBase =
    'w-full rounded-[var(--ponko-radius,6px)] border border-[#e6dfd8] bg-[#faf9f5] px-3.5 py-2.5 text-sm text-[#141413] placeholder:text-[#8e8b82] outline-none focus:border-[var(--ponko-primary,#cc785c)] focus:ring-2 focus:ring-[var(--ponko-primary-soft,#cc785c29)] transition-colors disabled:opacity-60'

  const errorClass = error ? 'border-[#c64545] focus:border-[#c64545] focus:ring-[#c64545]/20' : ''

  const strValue = Array.isArray(value) ? value[0] ?? '' : value
  const arrValue = Array.isArray(value) ? value : []

  const options =
    (field.options as { label: string; value: string }[] | null | undefined) ?? []

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#141413]">
        {field.label}
        {field.required && <span className="ml-0.5 text-[#c64545]">*</span>}
      </label>

      {field.type === 'text' && (
        <input
          type="text"
          placeholder={field.placeholder ?? ''}
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          className={`${inputBase} ${errorClass} h-10`}
        />
      )}

      {field.type === 'email' && (
        <input
          type="email"
          placeholder={field.placeholder ?? 'email@example.com'}
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          className={`${inputBase} ${errorClass} h-10`}
        />
      )}

      {field.type === 'number' && (
        <input
          type="number"
          placeholder={field.placeholder ?? ''}
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          className={`${inputBase} ${errorClass} h-10`}
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          placeholder={field.placeholder ?? ''}
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          rows={4}
          className={`${inputBase} ${errorClass} resize-none`}
        />
      )}

      {field.type === 'select' && (
        <select
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          className={`${inputBase} ${errorClass} h-10`}
        >
          <option value="">Select an option…</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {field.type === 'checkbox' && (
        <div className="flex flex-col gap-2">
          {options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                value={opt.value}
                checked={arrValue.includes(opt.value)}
                disabled={readOnly}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange([...arrValue, opt.value])
                  } else {
                    onChange(arrValue.filter((v) => v !== opt.value))
                  }
                }}
                className="h-4 w-4 rounded border-[#e6dfd8] accent-[var(--ponko-primary,#cc785c)]"
              />
              <span className="text-sm text-[#3d3d3a]">{opt.label}</span>
            </label>
          ))}
        </div>
      )}

      {field.type === 'radio' && (
        <div className="flex flex-col gap-2">
          {options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value={opt.value}
                checked={strValue === opt.value}
                disabled={readOnly}
                onChange={() => onChange(opt.value)}
                className="h-4 w-4 border-[#e6dfd8] accent-[var(--ponko-primary,#cc785c)]"
              />
              <span className="text-sm text-[#3d3d3a]">{opt.label}</span>
            </label>
          ))}
        </div>
      )}

      {field.type === 'date' && (
        <input
          type="date"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          className={`${inputBase} ${errorClass} h-10`}
        />
      )}

      {field.type === 'time' && (
        <input
          type="time"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          className={`${inputBase} ${errorClass} h-10`}
        />
      )}

      {field.type === 'datetime' && (
        <input
          type="datetime-local"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          className={`${inputBase} ${errorClass} h-10`}
        />
      )}

      {error && <p className="text-xs text-[#c64545]">{error}</p>}
    </div>
  )
}
