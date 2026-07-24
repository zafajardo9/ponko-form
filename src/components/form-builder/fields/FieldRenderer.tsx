import { useState } from 'react'
import { StarIcon } from '../../ui/StarIcon'
import { SVG_STAR_MARKER } from '../../../lib/page-builder/satisfaction'
import type { FieldValidationRules } from '../../../lib/page-builder/types'

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
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'payment' | 'date' | 'time' | 'datetime' | 'content' | 'media' | 'address' | 'computation' | 'file_upload' | 'satisfaction' | 'recaptcha'
  label: string
  placeholder?: string | null
  required: boolean
  options?: FieldOption[] | null | undefined
  validationRules?: FieldValidationRules | null
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
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const inputId = `field-input-${field.id}`
  const labelId = `field-label-${field.id}`
  const errorId = `field-error-${field.id}`
  const hasSingleInput = [
    'text',
    'email',
    'number',
    'textarea',
    'select',
    'date',
    'time',
    'datetime',
    'file_upload',
  ].includes(field.type)
  const inputAccessibility = {
    id: inputId,
    required: field.required,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
  }
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
  const usesSvgStars = options.length > 0 && options.every((opt) => (opt.emoji?.trim() ?? '') === SVG_STAR_MARKER)
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
    const comp = field.validationRules?.computation
    // Hidden computation — still runs server-side but not shown to respondent
    if (comp?.visible === false) return null

    const isText = comp?.outputMode === 'text'
    const strVal = String(value ?? '')
    const amount = Number(value ?? 0)
    const decimalPlaces = Math.min(10, Math.max(0, Number(comp?.decimalPlaces ?? 2)))
    const display = isText
      ? strVal || '—'
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

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {hasSingleInput ? (
        <>
          <label htmlFor={inputId} id={labelId} className="text-sm font-medium text-[#141413]">
            {field.label || 'Untitled field'}
            {field.required && <span aria-hidden="true" className="ml-1 text-[#c64545]">*</span>}
          </label>
          {error && (
            <p id={errorId} role="alert" className="text-sm text-[#c64545]">
              {error}
            </p>
          )}
          {field.type === 'text' && (
            <input
              type="text"
              placeholder={field.placeholder ?? ''}
              value={strValue}
              onChange={(e) => onChange(e.target.value)}
              disabled={readOnly}
              className={`${inputBase} ${errorClass} h-10`}
              {...inputAccessibility}
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
              {...inputAccessibility}
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
              {...inputAccessibility}
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
              {...inputAccessibility}
            />
          )}

          {field.type === 'select' && (
            <select
              value={strValue}
              onChange={(e) => onChange(e.target.value)}
              disabled={readOnly}
              className={`${inputBase} ${errorClass} h-10`}
              {...inputAccessibility}
            >
              {!field.required && <option value="">{field.placeholder || 'Select…'}</option>}
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} {opt.price != null ? formatMoney(opt.price, 'PHP') : ''}
                </option>
              ))}
            </select>
          )}

          {field.type === 'date' && (
            <div className={readOnly ? 'opacity-60' : ''}>
              <div className="flex items-stretch gap-2">
                <label
                  className={`flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[var(--ponko-radius,8px)] border bg-[#faf9f5] px-3 transition-all hover:border-[#cfc4b8] focus-within:border-[var(--ponko-primary,#cc785c)] focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--ponko-primary-soft,#cc785c29)] ${
                    error ? 'border-[#c64545]' : 'border-[#e6dfd8]'
                  } ${readOnly ? 'cursor-not-allowed' : ''}`}
                >
                  <input
                    type="date"
                    value={strValue}
                    aria-label={field.label}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={readOnly}
                    className="min-w-0 flex-1 cursor-pointer bg-transparent py-3 text-sm font-medium text-[#141413] outline-none [color-scheme:light] disabled:cursor-not-allowed"
                    {...inputAccessibility}
                  />
                </label>
                {strValue && !readOnly && (
                  <button
                    type="button"
                    onClick={() => onChange('')}
                    className="flex h-12 w-10 items-center justify-center rounded-[var(--ponko-radius,8px)] text-[#8e8b82] transition-colors hover:text-[#141413] focus:ring-2 focus:ring-[var(--ponko-primary-soft,#cc785c29)]"
                    aria-label={`Clear ${field.label || 'date'}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              {strValue && <p className="mt-1.5 text-xs text-[#6c6a64]">{formatDateValue(strValue)}</p>}
            </div>
          )}

          {field.type === 'time' && (
            <input
              type="time"
              value={strValue}
              onChange={(e) => onChange(e.target.value)}
              disabled={readOnly}
              className={`${inputBase} ${errorClass} h-10`}
              {...inputAccessibility}
            />
          )}

          {field.type === 'datetime' && (
            <input
              type="datetime-local"
              value={strValue}
              onChange={(e) => onChange(e.target.value)}
              disabled={readOnly}
              className={`${inputBase} ${errorClass} h-10`}
              {...inputAccessibility}
            />
          )}

          {field.type === 'file_upload' && (
            <div className="flex flex-col gap-2">
              <label
                className={`flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-[var(--ponko-radius,8px)] border-2 border-dashed px-4 py-3 text-sm text-[#6c6a64] transition-colors hover:border-[var(--ponko-primary,#cc785c)] hover:text-[var(--ponko-primary,#cc785c)] ${
                  error ? 'border-[#c64545]' : 'border-[#e6dfd8]'
                } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {uploadMultiple ? 'Upload files' : 'Upload a file'}
                <input
                  type="file"
                  accept={uploadAccept || undefined}
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                  multiple={uploadMultiple}
                  disabled={readOnly}
                  className="sr-only"
                />
              </label>
              {uploadAccept && <p className="text-xs text-[#8e8b82]">Accepted: {uploadAccept}</p>}
              {uploadFiles.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {uploadFiles.map((file, i) => (
                    <div
                      key={`${file.name}-${file.lastModified}`}
                      className="flex items-center gap-3 rounded-[var(--ponko-radius,8px)] border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-[#141413]">{file.name}</p>
                        <p className="text-xs text-[#8e8b82]">{formatFileSize(file.size)}</p>
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            onChange(
                              uploadMultiple
                                ? uploadFiles.filter((_, fi) => fi !== i)
                                : '',
                            )
                          }
                          className="shrink-0 text-[#c64545]"
                          aria-label={`Remove ${file.name}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <fieldset className="flex min-w-0 flex-col gap-1.5">
            <legend className="text-sm font-medium text-[#141413]">
              {field.label || 'Untitled field'}
              {field.required && <span aria-hidden="true" className="ml-1 text-[#c64545]">*</span>}
            </legend>

            {field.type === 'checkbox' && (
              <div
                className="flex min-w-0 flex-col gap-3"
                role="group"
                aria-labelledby={labelId}
              >
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
                        className="h-4 w-4 rounded border-[#cfc4b8] text-[var(--ponko-primary,#cc785c)] focus:ring-[var(--ponko-primary-soft,#cc785c29)]"
                        {...inputAccessibility}
                      />
                      <span className={`text-sm ${selected ? 'font-medium text-[#141413]' : 'text-[#6c6a64]'}`}>{opt.label}</span>
                    </label>
                  )
                })}
              </div>
            )}

            {field.type === 'radio' && (
              <div
                className="flex min-w-0 flex-col gap-3"
                role="radiogroup"
                aria-labelledby={labelId}
              >
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
                        {...inputAccessibility}
                      />
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors peer-checked:border-[var(--ponko-primary,#cc785c)] peer-checked:bg-[var(--ponko-primary,#cc785c)] group-hover:border-[var(--ponko-primary,#cc785c)]">
                        <span className={`h-2 w-2 rounded-full bg-white transition-transform ${selected ? 'scale-100' : 'scale-0'}`} />
                      </span>
                      <span className={`text-sm ${selected ? 'font-medium text-[#3d3d3a]' : 'text-[#141413]'}`}>{opt.label}</span>
                    </label>
                  )
                })}
              </div>
            )}

            {field.type === 'satisfaction' && (
              <div
                className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(2.5rem,1fr))] gap-1 sm:gap-2"
                role="radiogroup"
                aria-label={field.label}
              >
                {options.map((opt) => {
                  const actualRating = hoveredRating ?? Number(strValue)
                  const isCurrent = strValue === opt.value
                  const isHovering = hoveredRating !== null
                  const visual = opt.emoji?.trim() || opt.value
                  const ratingValue = Number(opt.value)
                  return (
                    <label
                      key={opt.value}
                      title={opt.label}
                      className={`group flex min-h-11 min-w-0 cursor-pointer items-center justify-center rounded-full p-1 text-center transition-all focus-within:ring-2 focus-within:ring-[var(--ponko-primary-soft,#cc785c29)] sm:min-h-14 sm:p-2 ${
                        isHovering
                          ? strValue === opt.value
                            ? 'scale-110 opacity-100 drop-shadow-sm'
                            : Number(opt.value) <= actualRating
                              ? 'scale-105 opacity-85'
                              : 'opacity-65'
                          : isCurrent
                            ? 'scale-110 opacity-100 drop-shadow-sm'
                            : 'opacity-65 hover:scale-105 hover:opacity-100'
                      } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                      onMouseEnter={readOnly ? undefined : () => setHoveredRating(ratingValue)}
                      onMouseLeave={readOnly ? undefined : () => setHoveredRating(null)}
                    >
                      <input
                        type="radio"
                        name={`field-${field.id}`}
                        value={opt.value}
                        checked={isCurrent}
                        disabled={readOnly}
                        onChange={() => onChange(opt.value)}
                        className="peer sr-only"
                      />
                      {usesSvgStars ? (
                        <StarIcon
                          size={28}
                          filled={ratingValue <= actualRating}
                          className={`h-7 w-7 sm:h-8 sm:w-8 ${
                            ratingValue <= actualRating
                              ? 'text-[var(--ponko-primary,#cc785c)]'
                              : 'text-[#c8beb3]'
                          }`}
                        />
                      ) : isImageUrl(visual) ? (
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

            {field.type === 'address' && (
              <div className="flex flex-col gap-3" role="group" aria-labelledby={labelId}>
                {(!readOnly || addressValue.currentAddress) && (
                  <input
                    type="text"
                    value={addressValue.currentAddress ?? ''}
                    onChange={(e) => onChange({ ...addressValue, currentAddress: e.target.value })}
                    disabled={readOnly}
                    className={`${inputBase} ${errorClass} h-10`}
                    placeholder="Current Address"
                    aria-label="Current Address"
                  />
                )}
                {(!readOnly || addressValue.apartment) && (
                  <input
                    type="text"
                    value={addressValue.apartment ?? ''}
                    onChange={(e) => onChange({ ...addressValue, apartment: e.target.value })}
                    disabled={readOnly}
                    className={`${inputBase} ${errorClass} h-10`}
                    placeholder="Apartment, suite, etc."
                    aria-label="Apartment"
                  />
                )}
                {(!readOnly || addressValue.country) && (
                  <input
                    type="text"
                    value={addressValue.country ?? ''}
                    onChange={(e) => onChange({ ...addressValue, country: e.target.value })}
                    disabled={readOnly}
                    className={`${inputBase} ${errorClass} h-10`}
                    placeholder="Country"
                    aria-label="Country"
                  />
                )}
                {(!readOnly || addressValue.city) && (
                  <input
                    type="text"
                    value={addressValue.city ?? ''}
                    onChange={(e) => onChange({ ...addressValue, city: e.target.value })}
                    disabled={readOnly}
                    className={`${inputBase} ${errorClass} h-10`}
                    placeholder="City"
                    aria-label="City"
                  />
                )}
                {(!readOnly || addressValue.stateProvince) && (
                  <input
                    type="text"
                    value={addressValue.stateProvince ?? ''}
                    onChange={(e) => onChange({ ...addressValue, stateProvince: e.target.value })}
                    disabled={readOnly}
                    className={`${inputBase} ${errorClass} h-10`}
                    placeholder="State/Province"
                    aria-label="State/Province"
                  />
                )}
                {(!readOnly || addressValue.zipPostalCode) && (
                  <input
                    type="text"
                    value={addressValue.zipPostalCode ?? ''}
                    onChange={(e) => onChange({ ...addressValue, zipPostalCode: e.target.value })}
                    disabled={readOnly}
                    className={`${inputBase} ${errorClass} h-10`}
                    placeholder="ZIP/Postal Code"
                    aria-label="ZIP/Postal Code"
                  />
                )}
              </div>
            )}

            {field.type === 'recaptcha' && (
              <div className="rounded-[var(--ponko-radius,6px)] border border-[#e6dfd8] bg-[#faf9f5] px-3.5 py-2.5 text-sm text-[#6c6a64]">
                reCAPTCHA verification is required to continue.
              </div>
            )}
          </fieldset>
        </>
      )}
    </div>
  )
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(amount)
}
