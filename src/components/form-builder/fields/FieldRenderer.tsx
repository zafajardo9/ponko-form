import type { AddressValue, FieldConfig, FieldOption, FieldValue, UploadFileValue } from '../../../lib/form-field-types'

import {
  TextField,
  EmailField,
  NumberField,
  TextareaField,
  SelectField,
  CheckboxField,
  RadioField,
  PaymentField,
  DateField,
  TimeField,
  DateTimeField,
  ContentField,
  MediaField,
  AddressField,
  ComputationField,
  FileUploadField,
  SatisfactionField,
  RecaptchaField,
  DiscountCodeField,
  type DiscountFieldContext,
} from './renderers'

// Utilities re-exported for external consumers (PageBuilderWorkspace, etc.)
export { richTextHtml, formatDateValue } from './FieldRendererUtils'

export type { AddressValue, FieldConfig, FieldOption, FieldValue, UploadFileValue }

interface FieldRendererProps {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
  /** Hides the label/legend — used by read-only previews that render their own heading. */
  hideLabel?: boolean
  context?: DiscountFieldContext
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const renderers = {
  text: TextField,
  email: EmailField,
  number: NumberField,
  textarea: TextareaField,
  select: SelectField,
  checkbox: CheckboxField,
  radio: RadioField,
  payment: PaymentField,
  date: DateField,
  time: TimeField,
  datetime: DateTimeField,
  content: ContentField,
  media: MediaField,
  address: AddressField,
  computation: ComputationField,
  file_upload: FileUploadField,
  satisfaction: SatisfactionField,
  recaptcha: RecaptchaField,
  discount: DiscountCodeField,
} as const

export function FieldRenderer({ field, value, onChange, error, readOnly, hideLabel, context }: FieldRendererProps) {
  const Renderer = renderers[field.type as keyof typeof renderers]

  if (!Renderer) {
    // eslint-disable-next-line no-console
    console.warn(`FieldRenderer: unknown field type "${field.type}"`)
    return null
  }

  return (
    <Renderer
      field={field}
      value={value}
      onChange={onChange}
      error={error}
      readOnly={readOnly}
      hideLabel={hideLabel}
      context={context}
    />
  )
}
