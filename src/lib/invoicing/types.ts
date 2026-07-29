import type {
  EmailDeliveryStatus,
  EmailTemplateKind,
  InvoiceLineItemField,
  ResponseEmailTemplate,
} from '../../db/schema'

export type TemplateVariableCategory = 'respondent' | 'form' | 'payment' | 'system'

export interface TemplateVariable {
  key: string
  label: string
  category: TemplateVariableCategory
  emailCandidate?: boolean
  sampleValue: string
}

export interface InvoiceConfigDraft {
  enabled: boolean
  respondentEmailField: string
  subjectTemplate: string
  bodyTemplate: string
  fromName: string
  logoUrl: string
  accentColor: string
  invoicePrefix: string
  invoiceStartNumber: number
  includePaymentDetails: boolean
  includeLineItems: boolean
  lineItemFields: InvoiceLineItemField[]
}

export interface ConfirmationConfigDraft {
  enabled: boolean
  respondentEmailField: string
  subjectTemplate: string
  bodyTemplate: string
  fromName: string
  ccRecipients: string[]
  templates: ResponseEmailTemplate[]
}

export interface DeliveryListItem {
  id: number
  templateKind: EmailTemplateKind
  templateName: string | null
  recipientEmail: string
  invoiceNumber: string | null
  subject: string
  status: EmailDeliveryStatus
  provider: string | null
  attemptCount: number
  errorMessage: string | null
  sentAt: Date | null
  createdAt: Date
  amount: number | null
  currency: string | null
}

export interface InvoiceTemplateContext {
  values: Record<string, unknown>
  formTitle: string
  submissionId: number
  submittedAt: Date
  paymentAmount?: string
  paymentCurrency?: string
  paymentDate?: string
  paymentGateway?: string
  paymentId?: string
  invoiceNumber?: string
}
