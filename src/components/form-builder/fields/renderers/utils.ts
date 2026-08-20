import type { AddressValue, FieldConfig, FieldOption, FieldValue, UploadFileValue } from '../../../../lib/form-field-types'

export const inputBase =
  'w-full rounded-[var(--ponko-radius,6px)] border border-[#e6dfd8] bg-[#faf9f5] px-3.5 py-2.5 text-sm text-[var(--ponko-foreground,#141413)] placeholder:text-[var(--ponko-foreground-faint,#8e8b82)] outline-none focus:border-[var(--ponko-primary,#cc785c)] focus:ring-2 focus:ring-[var(--ponko-primary-soft,#cc785c29)] transition-colors disabled:opacity-60'

export function getStrValue(value: FieldValue): string {
  return Array.isArray(value)
    ? typeof value[0] === 'string' ? value[0] : ''
    : value && typeof value === 'object'
      ? ''
      : String(value ?? '')
}

export function getArrValue(value: FieldValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function getAddressValue(value: FieldValue): AddressValue {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { country: 'Philippines', ...value }
    : { country: 'Philippines' }
}

export function getOptions(field: FieldConfig): FieldOption[] {
  return (field.options as FieldOption[] | null | undefined) ?? []
}

export function isImageUrl(path: string): boolean {
  return /^https?:\/\//i.test(path)
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function getMediaMeta(field: FieldConfig) {
  const options = getOptions(field)
  return {
    mediaType: options.find((option) => option.label === 'type')?.value ?? 'image',
    caption: options.find((option) => option.label === 'caption')?.value ?? '',
  }
}

export function getUploadMeta(field: FieldConfig) {
  const options = getOptions(field)
  const config = Object.fromEntries(options.map((option) => [option.label, option.value]))
  const accept =
    config.accept === 'image'
      ? 'image/*'
      : config.accept === 'document'
        ? '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv'
        : config.accept === 'custom'
          ? config.acceptCustom ?? ''
          : ''
  const multiple = config.multiple === 'true'
  return { config, accept, multiple }
}

export function getUploadFiles(value: FieldValue): UploadFileValue[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'object')
    ? (value as UploadFileValue[])
    : []
}

export function readFileDataUrl(file: File): Promise<UploadFileValue> {
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
