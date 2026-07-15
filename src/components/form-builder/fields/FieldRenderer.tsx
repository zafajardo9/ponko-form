export interface AddressValue {
  currentAddress?: string
  apartment?: string
  country?: string
  city?: string
  stateProvince?: string
  zipPostalCode?: string
}

export interface UploadFileValue {
  name: string
  size: number
  type: string
  lastModified: number
  dataUrl?: string
}

export type FieldValue = string | string[] | number | AddressValue | UploadFileValue[]

export interface FieldOption {
  label: string
  value: string
  emoji?: string | null
  price?: number | null
  priceReference?: string | null
  additionalPrice?: number | null
  additionalPriceReference?: string | null
}

export interface FieldConfig {
  id: number
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'payment' | 'date' | 'time' | 'datetime' | 'content' | 'media' | 'address' | 'computation' | 'file_upload' | 'satisfaction'
  label: string
  placeholder?: string | null
  required: boolean
  options?: FieldOption[] | null | undefined
}

interface FieldRendererProps {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
}

function sanitizeRichTextHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\shref=["']javascript:[^"']*["']/gi, '')
    .replace(/\ssrc=["']javascript:[^"']*["']/gi, '')
}

export function richTextHtml(value: string | null | undefined): string {
  if (!value) return ''
  const htmlLike = /<\/?[a-z][\s\S]*>/i.test(value)
  const html = htmlLike
    ? value
    : value
        .split('\n')
        .map((line) => `<p>${line}</p>`)
        .join('')
  return sanitizeRichTextHtml(html)
}

function formatDateValue(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function isImageUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

export function FieldRenderer({ field, value, onChange, error, readOnly }: FieldRendererProps) {
  const inputBase =
    'w-full rounded-[var(--ponko-radius,6px)] border border-[#e6dfd8] bg-[#faf9f5] px-3.5 py-2.5 text-sm text-[#141413] placeholder:text-[#8e8b82] outline-none focus:border-[var(--ponko-primary,#cc785c)] focus:ring-2 focus:ring-[var(--ponko-primary-soft,#cc785c29)] transition-colors disabled:opacity-60'

  const errorClass = error ? 'border-[#c64545] focus:border-[#c64545] focus:ring-[#c64545]/20' : ''

  const strValue = Array.isArray(value)
    ? typeof value[0] === 'string' ? value[0] : ''
    : value && typeof value === 'object'
      ? ''
      : String(value ?? '')
  const arrValue: string[] = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
  const addressValue =
    value && typeof value === 'object' && !Array.isArray(value)
      ? { country: 'Philippines', ...value }
      : { country: 'Philippines' }

  const options =
    (field.options as FieldOption[] | null | undefined) ?? []
  const mediaType = options.find((option) => option.label === 'type')?.value ?? 'image'
  const caption = options.find((option) => option.label === 'caption')?.value ?? ''

  const uploadConfig = Object.fromEntries(options.map((option) => [option.label, option.value]))
  const uploadAccept =
    uploadConfig.accept === 'image'
      ? 'image/*'
      : uploadConfig.accept === 'document'
        ? '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv'
        : uploadConfig.accept === 'custom'
          ? uploadConfig.acceptCustom ?? ''
          : ''
  const uploadMultiple = uploadConfig.multiple === 'true'
  const uploadFiles = Array.isArray(value) && value.every((item) => typeof item === 'object')
    ? (value as UploadFileValue[])
    : []

  function readFile(file: File): Promise<UploadFileValue> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        resolve({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
        })
      }
      reader.onerror = () => {
        resolve({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        })
      }
      reader.readAsDataURL(file)
    })
  }

  async function handleFiles(files: FileList | File[]) {
    const list = await Promise.all(Array.from(files).map(readFile))
    onChange(uploadMultiple ? list : list.slice(0, 1))
  }

  function formatFileSize(size: number) {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / 1024 / 1024).toFixed(1)} MB`
  }

  if (field.type === 'content') {
    const html = richTextHtml(field.placeholder)
    return (
      <div>
        {html && (
          <div
            className="rich-text-content text-sm leading-6 text-[#6c6a64]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    )
  }

  if (field.type === 'media') {
    return (
      <figure className="overflow-hidden rounded-[var(--ponko-radius,6px)] border border-[#e6dfd8] bg-[#faf9f5]">
        {field.label && <figcaption className="border-b border-[#e6dfd8] px-4 py-3 text-sm font-medium text-[#141413]">{field.label}</figcaption>}
        {field.placeholder ? (
          mediaType === 'video' ? (
            <video src={field.placeholder} controls className="max-h-[420px] w-full bg-black" />
          ) : mediaType === 'embed' ? (
            <iframe
              src={field.placeholder}
              title={field.label || 'Embedded media'}
              className="h-72 w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <img src={field.placeholder} alt={caption || field.label} className="max-h-[520px] w-full object-contain" />
          )
        ) : (
          <div className="flex h-36 items-center justify-center text-sm text-[#8e8b82]">No media URL set.</div>
        )}
        {caption && <figcaption className="px-4 py-3 text-sm text-[#6c6a64]">{caption}</figcaption>}
      </figure>
    )
  }

  if (field.type === 'computation') {
    const amount = Number(value ?? 0)
    const display = Number.isFinite(amount)
      ? new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
      : '0.00'
    return (
      <div className="rounded-[var(--ponko-radius,6px)] border border-[#e6dfd8] bg-[#faf9f5] p-4">
        <p className="text-sm font-medium text-[#141413]">{field.label || 'Total'}</p>
        {field.placeholder && <p className="mt-1 text-xs text-[#8e8b82]">{field.placeholder}</p>}
        <p className="mt-3 text-3xl font-medium text-[#141413]">{display}</p>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="break-words text-sm font-medium text-[#141413]">
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label={field.label}>
          {options.map((opt) => {
            const selected = arrValue.includes(opt.value)
            return (
            <label
              key={opt.value}
              className={`group flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--ponko-radius,8px)] border px-3.5 py-3 transition-all focus-within:ring-2 focus-within:ring-[var(--ponko-primary-soft,#cc785c29)] ${
                selected
                  ? 'border-[var(--ponko-primary,#cc785c)] bg-[var(--ponko-primary-soft,#cc785c29)] shadow-sm'
                  : 'border-[#e6dfd8] bg-[#faf9f5] hover:border-[#cfc4b8] hover:bg-white'
              } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="checkbox"
                value={opt.value}
                checked={selected}
                disabled={readOnly}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange([...arrValue, opt.value])
                  } else {
                    onChange(arrValue.filter((v) => v !== opt.value))
                  }
                }}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 flex-none items-center justify-center rounded-md border transition-colors ${
                  selected
                    ? 'border-[var(--ponko-primary,#cc785c)] bg-[var(--ponko-primary,#cc785c)] text-white'
                    : 'border-[#cfc4b8] bg-white text-transparent group-hover:border-[var(--ponko-primary,#cc785c)]'
                }`}
              >
                <Check size={14} strokeWidth={3} />
              </span>
              <span className="text-sm font-medium leading-5 text-[#3d3d3a]">{opt.label}</span>
            </label>
          )})}
        </div>
      )}

      {field.type === 'radio' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label={field.label}>
          {options.map((opt) => {
            const selected = strValue === opt.value
            return (
            <label
              key={opt.value}
              className={`group flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--ponko-radius,8px)] border px-3.5 py-3 transition-all focus-within:ring-2 focus-within:ring-[var(--ponko-primary-soft,#cc785c29)] ${
                selected
                  ? 'border-[var(--ponko-primary,#cc785c)] bg-[var(--ponko-primary-soft,#cc785c29)] shadow-sm'
                  : 'border-[#e6dfd8] bg-[#faf9f5] hover:border-[#cfc4b8] hover:bg-white'
              } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="radio"
                name={`field-${field.id}`}
                value={opt.value}
                checked={selected}
                disabled={readOnly}
                onChange={() => onChange(opt.value)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border transition-colors ${
                  selected
                    ? 'border-[var(--ponko-primary,#cc785c)] bg-white'
                    : 'border-[#cfc4b8] bg-white group-hover:border-[var(--ponko-primary,#cc785c)]'
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full bg-[var(--ponko-primary,#cc785c)] transition-transform ${selected ? 'scale-100' : 'scale-0'}`} />
              </span>
              <span className="text-sm font-medium leading-5 text-[#3d3d3a]">{opt.label}</span>
            </label>
          )})}
        </div>
      )}

      {field.type === 'satisfaction' && (
        <div
          className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(2.5rem,1fr))] gap-1 sm:gap-2"
          role="radiogroup"
          aria-label={field.label}
        >
          {options.map((opt) => {
            const selected = strValue === opt.value
            const visual = opt.emoji?.trim() || opt.value
            return (
              <label
                key={opt.value}
                title={opt.label}
                className={`group flex min-h-11 min-w-0 cursor-pointer items-center justify-center rounded-full p-1 text-center transition-all focus-within:ring-2 focus-within:ring-[var(--ponko-primary-soft,#cc785c29)] sm:min-h-14 sm:p-2 ${
                  selected
                    ? 'scale-110 opacity-100 drop-shadow-sm'
                    : 'opacity-65 hover:scale-105 hover:opacity-100'
                } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name={`field-${field.id}`}
                  value={opt.value}
                  checked={selected}
                  disabled={readOnly}
                  onChange={() => onChange(opt.value)}
                  className="peer sr-only"
                />
                {isImageUrl(visual) ? (
                  <img src={visual} alt="" className="h-7 w-7 object-contain sm:h-9 sm:w-9" />
                ) : (
                  <span aria-hidden="true" className="whitespace-nowrap text-xl leading-none text-[#d59b25] sm:text-2xl">
                    {visual}
                  </span>
                )}
                <span className="sr-only">{opt.label}</span>
              </label>
            )
          })}
        </div>
      )}

      {field.type === 'date' && (
        <div className={readOnly ? 'opacity-60' : ''}>
          <div className="flex items-stretch gap-2">
            <label
              className={`flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[var(--ponko-radius,8px)] border bg-[#faf9f5] px-3 transition-all hover:border-[#cfc4b8] focus-within:border-[var(--ponko-primary,#cc785c)] focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--ponko-primary-soft,#cc785c29)] ${
                error ? 'border-[#c64545]' : 'border-[#e6dfd8]'
              } ${readOnly ? 'cursor-not-allowed' : ''}`}
            >
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[var(--ponko-primary-soft,#cc785c29)] text-[var(--ponko-primary,#cc785c)]">
                <CalendarDays size={18} />
              </span>
              <input
                type="date"
                value={strValue}
                aria-label={field.label}
                onChange={(e) => onChange(e.target.value)}
                disabled={readOnly}
                className="min-w-0 flex-1 cursor-pointer bg-transparent py-3 text-sm font-medium text-[#141413] outline-none [color-scheme:light] disabled:cursor-not-allowed"
              />
            </label>
            {strValue && !readOnly && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="flex w-12 flex-none items-center justify-center rounded-[var(--ponko-radius,8px)] border border-[#e6dfd8] bg-[#faf9f5] text-[#8e8b82] transition-colors hover:border-[#cfc4b8] hover:bg-white hover:text-[#141413] focus:outline-none focus:ring-2 focus:ring-[var(--ponko-primary-soft,#cc785c29)]"
                aria-label={`Clear ${field.label}`}
              >
                <X size={16} />
              </button>
            )}
          </div>
          {strValue && (
            <p className="mt-1.5 text-xs text-[#6c6a64]">Selected: {formatDateValue(strValue)}</p>
          )}
        </div>
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

      {field.type === 'address' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-[#6c6a64]">Current Address</span>
            <input
              type="text"
              value={addressValue.currentAddress ?? ''}
              onChange={(e) => onChange({ ...addressValue, currentAddress: e.target.value })}
              disabled={readOnly}
              className={`${inputBase} ${errorClass} h-10`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#6c6a64]">Apartment</span>
            <input
              type="text"
              value={addressValue.apartment ?? ''}
              onChange={(e) => onChange({ ...addressValue, apartment: e.target.value })}
              disabled={readOnly}
              className={`${inputBase} ${errorClass} h-10`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#6c6a64]">City</span>
            <input
              type="text"
              value={addressValue.city ?? ''}
              onChange={(e) => onChange({ ...addressValue, city: e.target.value })}
              disabled={readOnly}
              className={`${inputBase} ${errorClass} h-10`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#6c6a64]">State/Province</span>
            <input
              type="text"
              value={addressValue.stateProvince ?? ''}
              onChange={(e) => onChange({ ...addressValue, stateProvince: e.target.value })}
              disabled={readOnly}
              className={`${inputBase} ${errorClass} h-10`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#6c6a64]">ZIP/Postal Code</span>
            <input
              type="text"
              value={addressValue.zipPostalCode ?? ''}
              onChange={(e) => onChange({ ...addressValue, zipPostalCode: e.target.value })}
              disabled={readOnly}
              className={`${inputBase} ${errorClass} h-10`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#6c6a64]">Country</span>
            <input
              type="text"
              value={addressValue.country ?? 'Philippines'}
              onChange={(e) => onChange({ ...addressValue, country: e.target.value })}
              disabled={readOnly}
              className={`${inputBase} ${errorClass} h-10`}
            />
          </label>
        </div>
      )}

      {field.type === 'file_upload' && (
        <div className="flex flex-col gap-3">
          <label
            onDragOver={(event) => {
              event.preventDefault()
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (!readOnly) handleFiles(event.dataTransfer.files)
            }}
            className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-[var(--ponko-radius,8px)] border border-dashed bg-[#faf9f5] px-4 py-6 text-center transition-colors ${
              error
                ? 'border-[#c64545] ring-2 ring-[#c64545]/10'
                : 'border-[#d8cec3] hover:border-[var(--ponko-primary,#cc785c)] hover:bg-white'
            } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <input
              type="file"
              accept={uploadAccept}
              multiple={uploadMultiple}
              disabled={readOnly}
              onChange={(event) => event.target.files && handleFiles(event.target.files)}
              className="sr-only"
            />
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ponko-primary-soft,#cc785c29)] text-lg text-[var(--ponko-primary,#cc785c)]">
              ↑
            </span>
            <span className="mt-3 text-sm font-medium text-[#141413]">
              Drop files here or click to browse
            </span>
            <span className="mt-1 text-xs text-[#8e8b82]">
              {uploadMultiple ? 'Multiple files allowed' : 'One file allowed'}
              {uploadAccept ? ` · ${uploadAccept}` : ''}
            </span>
          </label>
          {uploadFiles.length > 0 && (
            <div className="rounded-[var(--ponko-radius,8px)] border border-[#e6dfd8] bg-white">
              {uploadFiles.map((file, index) => (
                <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3 border-b border-[#efe9de] px-3 py-2 last:border-b-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#141413]">{file.name}</p>
                    <p className="text-xs text-[#8e8b82]">{formatFileSize(file.size)}{file.type ? ` · ${file.type}` : ''}</p>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => onChange(uploadFiles.filter((_, itemIndex) => itemIndex !== index))}
                      className="rounded-md px-2 py-1 text-xs text-[#c64545] hover:bg-[#fbeaea]"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-[#c64545]">{error}</p>}
    </div>
  )
}
import { CalendarDays, Check, X } from 'lucide-react'
