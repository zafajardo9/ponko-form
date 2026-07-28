import type { FieldConfig, FieldValue } from '../../../../lib/form-field-types'
import { richTextHtml } from '../FieldRendererUtils'

interface Props {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
}

export function ContentField({ field }: Props) {
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
