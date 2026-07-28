import type { FieldConfig, FieldValue } from '../../../../lib/form-field-types'
import { getMediaMeta } from './utils'

interface Props {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
}

export function MediaField({ field }: Props) {
  const { mediaType, caption } = getMediaMeta(field)
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
