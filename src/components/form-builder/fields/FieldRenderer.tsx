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
  price?: number | null
  priceReference?: string | null
  additionalPrice?: number | null
  additionalPriceReference?: string | null
}

export interface FieldConfig {
  id: number
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'payment' | 'date' | 'time' | 'datetime' | 'content' | 'media' | 'address' | 'computation' | 'file_upload'
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

export function FieldRenderer({ field, value, onChange, error, readOnly }: FieldRendererProps) {
  const inputBase =
    'w-full rounded-[var(--ponko-radius,6px)] border border-[#e6dfd8] bg-[#faf9f5] px-3.5 py-2.5 text-sm text-[#141413] placeholder:text-[#8e8b82] outline-none focus:border-[var(--ponko-primary,#cc785c)] focus:ring-2 focus:ring-[var(--ponko-primary-soft,#cc785c29)] transition-colors disabled:opacity-60'

  const errorClass = error ? 'border-[#c64545] focus:border-[#c64545] focus:ring-[#c64545]/20' : ''

  const strValue = Array.isArray(value)
    ? typeof value[0] === 'string' ? value[0] : ''
    : value && typeof value === 'object'
      ? ''
      : String(value ?? '')
  const arrValue = Array.isArray(value) ? value : []
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
      <div className="rounded-[var(--ponko-radius,6px)] border border-[#e6dfd8] bg-[#faf9f5] p-4">
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
