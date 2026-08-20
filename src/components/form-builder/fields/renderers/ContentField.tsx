import type { FieldConfig, FieldValue } from '../../../../lib/form-field-types'
import { contentFieldHtml } from '../FieldRendererUtils'

interface Props {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
}

export function ContentField({ field }: Props) {
  const html = contentFieldHtml(field.placeholder)
  return (
    <div className="content-field-transparent">
      {html && (
        <div
          className="rich-text-content text-sm leading-6 text-[var(--ponko-foreground-muted,#6c6a64)]"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  )
}
