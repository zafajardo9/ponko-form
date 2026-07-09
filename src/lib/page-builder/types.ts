export type PageFieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'payment'
  | 'date'
  | 'time'
  | 'datetime'
  | 'content'
  | 'media'
  | 'address'

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'

export type ConditionAction = 'show' | 'hide'

export type AllowedCharactersMode = 'any' | 'letters' | 'numbers' | 'alphanumeric' | 'custom'

export interface FieldValidationRules {
  optionPricesEnabled?: boolean | null
  addressRequired?: {
    currentAddress?: boolean
    apartment?: boolean
    city?: boolean
    stateProvince?: boolean
    zipPostalCode?: boolean
    country?: boolean
  } | null
  allowedCharacters?: AllowedCharactersMode
  customPattern?: string | null
  minLength?: number | null
  maxLength?: number | null
  minValue?: number | null
  maxValue?: number | null
  message?: string | null
}

export interface PageFieldOption {
  label: string
  value: string
  price?: number | null
}

export interface FieldCondition {
  id: number
  fieldId: number
  sourceFieldBinding: string
  operator: ConditionOperator
  value: string | null
  action: ConditionAction
}

export interface PageField {
  id: number
  pageId: number
  fieldType: PageFieldType
  label: string
  placeholder: string | null
  required: boolean
  options: PageFieldOption[] | null
  bindVariable: string
  position: number
  width: 'full' | 'half'
  validationRules: FieldValidationRules | null
  conditions: FieldCondition[]
}

export interface FormPage {
  id: number
  formId: number
  title: string
  description: string | null
  position: number
  isFinal: boolean
  finalTemplate: string | null
  finalRedirectUrl: string | null
  hasPayment: boolean
  paymentGatewayId: number | null
  paymentAmountVariable: string | null
  paymentCurrency: string
  paymentComputation: PaymentComputation | null
  fields: PageField[]
}

export type PaymentComputationMode = 'field' | 'sum_priced_options' | 'sum_number_fields' | 'fixed'

export interface PaymentComputation {
  mode: PaymentComputationMode
  fieldBindings?: string[]
  fixedAmount?: number | null
}

export interface PageForm {
  form: {
    id: number
    title: string
    description: string | null
    status: 'draft' | 'published'
    theme?: unknown
  }
  pages: FormPage[]
}

export interface PageSubmissionSession {
  id: number
  formId: number
  formSubmissionId: number | null
  currentPageIndex: number
  collectedData: Record<string, unknown>
  status: 'in_progress' | 'payment_pending' | 'payment_failed' | 'completed' | 'cancelled'
}
