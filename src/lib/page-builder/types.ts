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
  | 'computation'
  | 'file_upload'
  | 'satisfaction'
  | 'recaptcha'
  | 'discount'

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
export type FormReferenceType = 'number' | 'percentage' | 'text' | 'boolean'
export type ReferenceValue = string | number | boolean
export type ReferenceMap = Record<string, ReferenceValue>
export type OptionPriceSource = 'direct' | 'reference'
export type PaymentAdjustmentType = 'add' | 'subtract' | 'multiply'
export type FormulaOperator = 'set' | 'add' | 'subtract' | 'multiply' | 'divide' | 'percent' | 'concat'
export type FormulaTermSource = 'field' | 'reference' | 'fixed'
export type FieldComputationMode = 'sum_priced_options' | 'sum_number_fields' | 'formula' | 'expression'

export interface FormReference {
  id: number
  formId: number
  key: string
  type: FormReferenceType
  value: string
  label: string | null
  description: string | null
  position: number
  createdAt?: Date
  updatedAt?: Date
}

export interface FieldComputation {
  mode: FieldComputationMode
  fieldBindings?: string[]
  adjustments?: { type: PaymentAdjustmentType; referenceKey: string }[]
  expression?: string | null
  /** Selects the active expression editor while preserving both representations. */
  editorMode?: 'visual' | 'syntax'
  terms?: {
    id?: string
    operator: FormulaOperator
    source: FormulaTermSource
    fieldBinding?: string | null
    referenceKey?: string | null
    fixedValue?: number | string | null
  }[]
  showBreakdown?: boolean
  /** When false, the computation still runs but the field is hidden from the respondent. */
  visible?: boolean
  /** Output type for the computed value. 'text' enables string concatenation via the `concat` operator. */
  outputMode?: 'number' | 'text'
  /** Numeric result shape. JavaScript stores both integer and decimal values as numbers. */
  numericType?: 'automatic' | 'integer' | 'decimal'
  /** Decimal places applied when numericType is decimal. */
  decimalPlaces?: number | null
}

export interface FieldValidationRules {
  computation?: FieldComputation | null
  optionPricesEnabled?: boolean | null
  addressRequired?: {
    currentAddress?: boolean
    apartment?: boolean
    city?: boolean
    stateProvince?: boolean
    zipPostalCode?: boolean
    country?: boolean
  } | null
  uploadAccept?: 'any' | 'image' | 'document' | 'custom' | null
  uploadAcceptCustom?: string | null
  uploadMultiple?: boolean | null
  allowedCharacters?: AllowedCharactersMode
  customPattern?: string | null
  minLength?: number | null
  maxLength?: number | null
  minValue?: number | null
  maxValue?: number | null
  /** Answer variable for an earlier field whose value this field must exactly match. */
  matchesFieldBinding?: string | null
  message?: string | null
}

export interface PageFieldOption {
  label: string
  value: string
  emoji?: string | null
  price?: number | null
  priceReference?: string | null
  additionalPrice?: number | null
  additionalPriceReference?: string | null
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
  /** How multiple conditional visibility rules are combined. Defaults to `all`. */
  conditionMatch?: 'all' | 'any'
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
  /** Optional support email shown on the thank-you page so respondents can reach out. */
  finalContactEmail: string | null
  hasPayment: boolean
  paymentGatewayId: number | null
  paymentAmountVariable: string | null
  paymentCurrency: string
  paymentComputation: PaymentComputation | null
  subscriptionConfig: SubscriptionConfig | null
  fields: PageField[]
}

export type SubscriptionIntervalPreset = 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual'

export interface SubscriptionConfig {
  enabled: true
  interval: SubscriptionIntervalPreset
  intervalUnit: 'WEEK' | 'MONTH'
  intervalCount: number
  trialPeriodDays: number
  maxCycles: number | null
  customerNameField: string
  customerEmailField: string
}

export type PaymentComputationMode = 'field' | 'sum_priced_options' | 'sum_number_fields' | 'fixed' | 'formula'

export interface PaymentComputation {
  mode: PaymentComputationMode
  fieldBindings?: string[]
  fixedAmount?: number | null
  adjustments?: { type: PaymentAdjustmentType; referenceKey: string }[]
  showBreakdown?: boolean
  /** Answer/calculation fields displayed as non-monetary details on the payment receipt. */
  receiptFieldBindings?: string[]
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
  references?: FormReference[]
  /** Public reCAPTCHA site key. The matching secret is never serialized. */
  recaptchaSiteKey?: string | null
}

export interface PageSubmissionSession {
  id: number
  formId: number
  formSubmissionId: number | null
  currentPageIndex: number
  collectedData: Record<string, unknown>
  status: 'in_progress' | 'payment_pending' | 'payment_failed' | 'completed' | 'cancelled'
}
