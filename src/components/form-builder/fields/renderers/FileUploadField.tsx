import type { FieldConfig, FieldValue } from '../../../../lib/form-field-types'
import { getUploadMeta, getUploadFiles, formatFileSize, readFileDataUrl } from './utils'

interface Props {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
  hideLabel?: boolean
}

export function FileUploadField({ field, value, onChange, error, readOnly, hideLabel }: Props) {
  const { accept: uploadAccept, multiple: uploadMultiple } = getUploadMeta(field)
  const uploadFiles = getUploadFiles(value)
  const inputId = `field-input-${field.id}`
  const labelId = `field-label-${field.id}`
  const errorId = `field-error-${field.id}`

  async function handleFiles(files: FileList | File[]) {
    const list = await Promise.all(Array.from(files).map(readFileDataUrl))
    onChange(uploadMultiple ? list : list.slice(0, 1))
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {!hideLabel && (
        <label htmlFor={inputId} id={labelId} className="text-sm font-medium text-[var(--ponko-foreground,#141413)]">
          {field.label || 'Untitled field'}
          {field.required && <span aria-hidden="true" className="ml-1 text-[#c64545]">*</span>}
        </label>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-[#c64545]">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <label
          className={`flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-[var(--ponko-radius,8px)] border-2 border-dashed px-4 py-3 text-sm text-[var(--ponko-foreground-muted,#6c6a64)] transition-colors hover:border-[var(--ponko-primary,#cc785c)] hover:text-[var(--ponko-primary,#cc785c)] ${
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
        {uploadAccept && <p className="text-xs text-[var(--ponko-foreground-faint,#8e8b82)]">Accepted: {uploadAccept}</p>}
        {uploadFiles.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {uploadFiles.map((file, i) => (
              <div
                key={`${file.name}-${file.lastModified}`}
                className="flex items-center gap-3 rounded-[var(--ponko-radius,8px)] border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--ponko-foreground,#141413)]">{file.name}</p>
                  <p className="text-xs text-[var(--ponko-foreground-faint,#8e8b82)]">{formatFileSize(file.size)}</p>
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
    </div>
  )
}
