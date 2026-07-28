import type { FieldValidationRules } from './page-builder/types'

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
