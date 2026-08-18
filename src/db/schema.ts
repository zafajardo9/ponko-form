import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  varchar,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { TemplatePageData } from '../lib/form-templates/types'
import type { SubscriptionConfig } from '../lib/page-builder/types'

export const formStatusEnum = pgEnum('form_status', ['draft', 'published'])
export const fieldTypeEnum = pgEnum('field_type', [
  'text',
  'email',
  'number',
  'textarea',
  'select',
  'checkbox',
  'radio',
  'payment',
  'date',
  'time',
  'datetime',
  'content',
  'media',
  'address',
  'computation',
  'file_upload',
  'satisfaction',
  'recaptcha',
  'discount',
])
export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'fixed'])
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'completed',
  'failed',
  'refunded',
])
export const submissionStatusEnum = pgEnum('submission_status', [
  'pending_payment',
  'incomplete',
  'completed',
  'payment_failed',
])
export const collaboratorRoleEnum = pgEnum('collaborator_role', [
  'editor',
  'viewer',
])
export const collaborationActionEnum = pgEnum('collaboration_action', [
  'invited',
  'role_changed',
  'removed',
  'accepted',
])

export const profiles = pgTable(
  'profiles',
  {
    id: serial().primaryKey(),
    authId: text('auth_id').notNull().unique(),
    email: text('email'),
    name: text('name'),
    displayName: varchar('display_name', { length: 255 }),
    avatarUrl: text('avatar_url'),
    authProvider: text('auth_provider').notNull().default('better-auth'),
    dashboardCurrency: varchar('dashboard_currency', { length: 3 })
      .notNull()
      .default('USD'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('profiles_auth_id_idx').on(table.authId),
    uniqueIndex('profiles_email_idx')
      .on(table.email)
      .where(sql`email IS NOT NULL`),
  ],
)

/**
 * INTEGRATION SETTINGS
 * Per-user (per-profile) credentials for external services: payment gateways
 * (Xendit, PayPal) and outbound email (SMTP). Each `*Config` column holds an
 * AES-256-GCM-encrypted JSON blob (see `src/lib/crypto.ts`) — the plaintext
 * secrets are NEVER stored. A null column means that integration is not
 * configured for this user. The non-secret presence/metadata needed by the UI
 * is derived server-side after decryption and never exposes raw secrets to the
 * client.
 *
 * Decrypted shapes:
 *   xenditConfig: { secretKey: string, webhookToken?: string }
 *   paypalConfig: { clientId: string, clientSecret: string, mode: 'sandbox' | 'live' }
 *   smtpConfig:   { host: string, port: number, secure: boolean, user: string,
 *                   password: string, fromEmail: string, fromName?: string }
 */
export const integrationSettings = pgTable('integration_settings', {
  id: serial().primaryKey(),
  profileId: integer('profile_id')
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  xenditConfig: text('xendit_config'), // encrypted JSON, null = not configured
  paypalConfig: text('paypal_config'), // encrypted JSON, null = not configured
  smtpConfig: text('smtp_config'), // encrypted JSON, null = not configured
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const forms = pgTable(
  'forms',
  {
    id: serial().primaryKey(),
    profileId: integer('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: formStatusEnum('status').default('draft').notNull(),
    publicId: varchar('public_id', { length: 32 }).notNull(),
    // Per-form theming for the respondent-facing form (accent/background/corners).
    // See src/lib/theme.ts (FormTheme). Null = house default.
    theme: jsonb('theme').$type<{
      primaryColor?: string
      backgroundColor?: string
      radius?: 'sharp' | 'rounded' | 'pill'
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('forms_profile_id_idx').on(table.profileId),
    uniqueIndex('forms_public_id_idx').on(table.publicId),
  ],
)

export const formCollaborators = pgTable(
  'form_collaborators',
  {
    id: serial().primaryKey(),
    formId: integer('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    profileId: integer('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: collaboratorRoleEnum('role').notNull().default('editor'),
    invitedBy: integer('invited_by')
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('form_collaborators_form_profile_idx').on(
      table.formId,
      table.profileId,
    ),
    index('form_collaborators_profile_idx').on(table.profileId),
  ],
)

export const collaborationLogs = pgTable(
  'collaboration_logs',
  {
    id: serial().primaryKey(),
    formId: integer('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    actorId: integer('actor_id')
      .notNull()
      .references(() => profiles.id),
    targetId: integer('target_id')
      .notNull()
      .references(() => profiles.id),
    action: collaborationActionEnum('action').notNull(),
    oldRole: collaboratorRoleEnum('old_role'),
    newRole: collaboratorRoleEnum('new_role'),
    details: text('details'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('collaboration_logs_form_idx').on(table.formId),
    index('collaboration_logs_actor_idx').on(table.actorId),
    index('collaboration_logs_created_at_idx').on(table.createdAt),
  ],
)

export type InvoiceLineItemField = {
  label: string
  variable: string
}

export type ResponseEmailRecipientMode = 'field' | 'fixed'

export type ResponseEmailTemplate = {
  id: string
  name: string
  enabled: boolean
  recipientMode: ResponseEmailRecipientMode
  respondentEmailField: string
  recipientEmail: string
  subjectTemplate: string
  bodyTemplate: string
  fromName: string
  ccRecipients: string[]
}

export const formInvoiceConfigs = pgTable(
  'form_invoice_configs',
  {
    id: serial().primaryKey(),
    formId: integer('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(false),
    respondentEmailField: varchar('respondent_email_field', { length: 100 }),
    subjectTemplate: varchar('subject_template', { length: 255 })
      .notNull()
      .default('Invoice {{invoice_number}} for {{form_title}}'),
    bodyTemplate: text('body_template')
      .notNull()
      .default('<h1>Invoice {{invoice_number}}</h1><p>Thank you for your payment.</p>'),
    bodyTemplatePlain: text('body_template_plain'),
    fromName: varchar('from_name', { length: 255 }),
    logoUrl: text('logo_url'),
    accentColor: varchar('accent_color', { length: 7 }).notNull().default('#cc785c'),
    invoicePrefix: varchar('invoice_prefix', { length: 20 }).notNull().default('INV-'),
    invoiceStartNumber: integer('invoice_start_number').notNull().default(1000),
    nextInvoiceNumber: integer('next_invoice_number').notNull().default(1000),
    includePaymentDetails: boolean('include_payment_details').notNull().default(true),
    includeLineItems: boolean('include_line_items').notNull().default(false),
    lineItemFields: jsonb('line_item_fields')
      .$type<InvoiceLineItemField[]>()
      .notNull()
      .default([]),
    lastTestSentAt: timestamp('last_test_sent_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('form_invoice_configs_form_id_idx').on(table.formId)],
)

export const formConfirmationConfigs = pgTable(
  'form_confirmation_configs',
  {
    id: serial().primaryKey(),
    formId: integer('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(false),
    respondentEmailField: varchar('respondent_email_field', { length: 100 }),
    subjectTemplate: varchar('subject_template', { length: 255 })
      .notNull()
      .default('Thanks for submitting {{form_title}}'),
    bodyTemplate: text('body_template')
      .notNull()
      .default('<h1>Thank you</h1><p>Your response has been recorded.</p>'),
    bodyTemplatePlain: text('body_template_plain'),
    fromName: varchar('from_name', { length: 255 }),
    ccRecipients: jsonb('cc_recipients')
      .$type<string[]>()
      .notNull()
      .default([]),
    templates: jsonb('templates')
      .$type<ResponseEmailTemplate[]>()
      .notNull()
      .default([]),
    lastTestSentAt: timestamp('last_test_sent_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('form_confirmation_configs_form_id_idx').on(table.formId)],
)

export const formFields = pgTable(
  'form_fields',
  {
    id: serial().primaryKey(),
    formId: integer('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    type: fieldTypeEnum('type').notNull(),
    label: varchar('label', { length: 255 }).notNull(),
    placeholder: text('placeholder'),
    required: boolean('required').default(false).notNull(),
    options: jsonb('options').$type<{ label: string; value: string; emoji?: string | null; price?: number | null }[]>(),
    order: integer('order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('form_fields_form_id_order_idx').on(table.formId, table.order)],
)

// ── Page Builder (FT-007) ──

export const formReferences = pgTable(
  'form_references',
  {
    id: serial().primaryKey(),
    formId: integer('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 100 }).notNull(),
    type: varchar('type', { length: 20 }).notNull().$type<'number' | 'percentage' | 'text' | 'boolean'>(),
    value: text('value').notNull(),
    label: varchar('label', { length: 255 }),
    description: text('description'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('form_references_form_id_key_idx').on(table.formId, table.key),
    index('form_references_form_id_position_idx').on(table.formId, table.position),
  ],
)

export const formPages = pgTable(
  'form_pages',
  {
    id: serial().primaryKey(),
    formId: integer('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    position: integer('position').notNull().default(0),
    isFinal: boolean('is_final').notNull().default(false),
    finalTemplate: text('final_template'),
    finalRedirectUrl: varchar('final_redirect_url', { length: 500 }),
    finalContactEmail: varchar('final_contact_email', { length: 254 }),
    hasPayment: boolean('has_payment').notNull().default(false),
    paymentGatewayId: integer('payment_gateway_id').references(() => paymentGateways.id),
    paymentAmountVariable: varchar('payment_amount_variable', { length: 100 }),
    paymentCurrency: varchar('payment_currency', { length: 3 }).notNull().default('USD'),
    paymentComputation: jsonb('payment_computation').$type<{
      mode: 'field' | 'sum_priced_options' | 'sum_number_fields' | 'fixed' | 'formula'
      fieldBindings?: string[]
      fixedAmount?: number | null
      adjustments?: { type: 'add' | 'subtract' | 'multiply'; referenceKey: string }[]
      showBreakdown?: boolean
      receiptFieldBindings?: string[]
    }>(),
    subscriptionConfig: jsonb('subscription_config').$type<SubscriptionConfig>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('form_pages_form_id_position_idx').on(table.formId, table.position)],
)

export const formPageFields = pgTable(
  'form_page_fields',
  {
    id: serial().primaryKey(),
    pageId: integer('page_id')
      .notNull()
      .references(() => formPages.id, { onDelete: 'cascade' }),
    fieldType: fieldTypeEnum('field_type').notNull(),
    label: varchar('label', { length: 255 }).notNull(),
    placeholder: varchar('placeholder', { length: 255 }),
    required: boolean('required').notNull().default(false),
    options: jsonb('options').$type<{
      label: string
      value: string
      emoji?: string | null
      price?: number | null
      priceReference?: string | null
      additionalPrice?: number | null
      additionalPriceReference?: string | null
    }[]>(),
    bindVariable: varchar('bind_variable', { length: 100 }).notNull(),
    position: integer('position').notNull().default(0),
    width: varchar('width', { length: 20 })
      .notNull()
      .default('full')
      .$type<'full' | 'half'>(),
    validationRules: jsonb('validation_rules').$type<{
      allowedCharacters?: 'any' | 'letters' | 'numbers' | 'alphanumeric' | 'custom'
      customPattern?: string | null
      minLength?: number | null
      maxLength?: number | null
      minValue?: number | null
      maxValue?: number | null
      matchesFieldBinding?: string | null
      message?: string | null
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
    }>(),
    conditionMatch: varchar('condition_match', { length: 10 })
      .notNull()
      .default('all')
      .$type<'all' | 'any'>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('form_page_fields_page_id_position_idx').on(table.pageId, table.position)],
)

export const formTemplates = pgTable(
  'form_templates',
  {
    id: serial().primaryKey(),
    profileId: integer('profile_id').references(() => profiles.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 50 }).notNull().default('general'),
    pagesData: jsonb('pages_data').$type<TemplatePageData[]>().notNull().default([]),
    isBuiltin: boolean('is_builtin').notNull().default(false),
    usageCount: integer('usage_count').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('form_templates_profile_id_idx').on(table.profileId),
    index('form_templates_category_idx').on(table.category),
    uniqueIndex('form_templates_builtin_name_idx').on(table.isBuiltin, table.name),
  ],
)

export const fieldConditions = pgTable(
  'field_conditions',
  {
    id: serial().primaryKey(),
    fieldId: integer('field_id')
      .notNull()
      .references(() => formPageFields.id, { onDelete: 'cascade' }),
    sourceFieldBinding: varchar('source_field_binding', { length: 100 }).notNull(),
    operator: varchar('operator', { length: 20 })
      .notNull()
      .$type<
        | 'equals'
        | 'not_equals'
        | 'contains'
        | 'greater_than'
        | 'less_than'
        | 'is_empty'
        | 'is_not_empty'
      >(),
    value: text('value'),
    action: varchar('action', { length: 20 }).notNull().default('show').$type<'show' | 'hide'>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('field_conditions_field_id_idx').on(table.fieldId)],
)

export const formSubmissions = pgTable(
  'form_submissions',
  {
    id: serial().primaryKey(),
    formId: integer('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    clientToken: varchar('client_token', { length: 64 }),
    status: submissionStatusEnum('status').default('completed').notNull(),
    formData: jsonb('form_data').$type<Record<string, unknown>>().notNull(),
    submittedAt: timestamp('submitted_at').defaultNow().notNull(),
    archivedAt: timestamp('archived_at'),
  },
  (table) => [
    index('form_submissions_form_id_idx').on(table.formId),
    index('form_submissions_form_archived_idx').on(table.formId, table.archivedAt),
    index('form_submissions_form_archived_submitted_idx').on(
      table.formId,
      table.archivedAt,
      table.submittedAt,
    ),
    uniqueIndex('form_submissions_form_client_token_idx').on(
      table.formId,
      table.clientToken,
    ),
  ],
)

export const emailSurveyInvitations = pgTable(
  'email_survey_invitations',
  {
    id: serial().primaryKey(),
    formId: integer('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    fieldId: integer('field_id')
      .notNull()
      .references(() => formPageFields.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    recipientReference: varchar('recipient_reference', { length: 255 }),
    formSubmissionId: integer('form_submission_id').references(
      () => formSubmissions.id,
      { onDelete: 'set null' },
    ),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('email_survey_invitations_token_hash_idx').on(table.tokenHash),
    index('email_survey_invitations_form_id_idx').on(table.formId),
    index('email_survey_invitations_field_id_idx').on(table.fieldId),
  ],
)

export const formSubmissionSessions = pgTable(
  'form_submission_sessions',
  {
    id: serial().primaryKey(),
    formId: integer('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    formSubmissionId: integer('form_submission_id').references(
      () => formSubmissions.id,
      { onDelete: 'set null' },
    ),
    clientToken: varchar('client_token', { length: 64 }),
    emailSurveyInvitationId: integer('email_survey_invitation_id').references(
      () => emailSurveyInvitations.id,
      { onDelete: 'set null' },
    ),
    currentPageIndex: integer('current_page_index').notNull().default(0),
    collectedData: jsonb('collected_data').$type<Record<string, unknown>>().notNull().default({}),
    status: varchar('status', { length: 20 })
      .notNull()
      .default('in_progress')
      .$type<'in_progress' | 'payment_pending' | 'payment_failed' | 'completed' | 'cancelled'>(),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('form_submission_sessions_form_id_idx').on(table.formId),
    uniqueIndex('form_submission_sessions_form_id_client_token_idx').on(table.formId, table.clientToken),
    uniqueIndex('form_submission_sessions_email_survey_invitation_idx').on(table.emailSurveyInvitationId),
  ],
)

export const paymentGateways = pgTable('payment_gateways', {
  id: serial().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  isActive: boolean('is_active').default(true).notNull(),
})

export const formPaymentConfigs = pgTable('form_payment_configs', {
  id: serial().primaryKey(),
  formId: integer('form_id')
    .notNull()
    .unique()
    .references(() => forms.id, { onDelete: 'cascade' }),
  paymentGatewayId: integer('payment_gateway_id')
    .notNull()
    .references(() => paymentGateways.id),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  gatewaySettings: jsonb('gateway_settings').$type<Record<string, string>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const payments = pgTable(
  'payments',
  {
    id: serial().primaryKey(),
    formSubmissionId: integer('form_submission_id').references(
      () => formSubmissions.id,
      { onDelete: 'set null' },
    ),
    pageSessionId: integer('page_session_id').references(
      () => formSubmissionSessions.id,
      { onDelete: 'set null' },
    ),
    paymentGatewayId: integer('payment_gateway_id')
      .notNull()
      .references(() => paymentGateways.id),
    flowExecutionId: integer('flow_execution_id').references(
      () => flowExecutions.id,
      { onDelete: 'set null' },
    ),
    amount: integer('amount').notNull(),
    paidAmount: integer('paid_amount'),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    paymentKind: varchar('payment_kind', { length: 20 })
      .notNull()
      .default('one_time')
      .$type<'one_time' | 'subscription'>(),
    status: paymentStatusEnum('status').default('pending').notNull(),
    checkoutKey: varchar('checkout_key', { length: 255 }),
    externalId: text('external_id'),
    paymentUrl: text('payment_url'),
    expiresAt: timestamp('expires_at'),
    gatewayPaymentId: text('gateway_payment_id'),
    paymentMethod: text('payment_method'),
    paymentChannel: text('payment_channel'),
    failureReason: text('failure_reason'),
    verificationSource: varchar('verification_source', { length: 20 })
      .$type<'webhook' | 'return' | 'reconciliation' | 'manual'>(),
    gatewayResponse: jsonb('gateway_response').$type<Record<string, unknown>>(),
    paidAt: timestamp('paid_at'),
    failedAt: timestamp('failed_at'),
    refundedAt: timestamp('refunded_at'),
    lastVerifiedAt: timestamp('last_verified_at'),
    respondentName: varchar('respondent_name', { length: 255 }),
    respondentEmail: varchar('respondent_email', { length: 255 }),
    subscriptionPlanId: text('subscription_plan_id'),
    subscriptionStatus: varchar('subscription_status', { length: 30 })
      .$type<'pending' | 'active' | 'paused' | 'past_due' | 'completed' | 'cancelled' | 'deactivated' | 'failed'>(),
    subscriptionCheckoutStatus: varchar('subscription_checkout_status', { length: 30 }),
    subscriptionInterval: varchar('subscription_interval', { length: 10 }).$type<'WEEK' | 'MONTH'>(),
    subscriptionIntervalCount: integer('subscription_interval_count'),
    subscriptionMaxCycles: integer('subscription_max_cycles'),
    subscriptionTrialDays: integer('subscription_trial_days'),
    subscriptionAnchorDate: timestamp('subscription_anchor_date'),
    subscriptionNextChargeAt: timestamp('subscription_next_charge_at'),
    subscriptionEndedAt: timestamp('subscription_ended_at'),
    subscriptionLastSyncedAt: timestamp('subscription_last_synced_at'),
    reminderCount: integer('reminder_count').notNull().default(0),
    lastReminderAt: timestamp('last_reminder_at'),
    paymentLinkId: integer('payment_link_id').references(() => paymentLinks.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('payments_gateway_payment_id_idx').on(table.gatewayPaymentId),
    uniqueIndex('payments_checkout_key_idx').on(table.checkoutKey),
    uniqueIndex('payments_external_id_idx').on(table.externalId),
    index('payments_form_submission_id_idx').on(table.formSubmissionId),
    index('payments_page_session_id_idx').on(table.pageSessionId),
    index('payments_flow_execution_id_idx').on(table.flowExecutionId),
    index('payments_created_at_idx').on(table.createdAt),
    index('payments_status_created_idx').on(table.status, table.createdAt),
    uniqueIndex('payments_subscription_plan_id_idx').on(table.subscriptionPlanId),
    index('payments_subscription_status_sync_idx').on(table.subscriptionStatus, table.subscriptionLastSyncedAt),
    index('payments_payment_link_id_idx').on(table.paymentLinkId),
  ],
)

export const discountCodes = pgTable(
  'discount_codes',
  {
    id: serial().primaryKey(),
    profileId: integer('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    formId: integer('form_id').references(() => forms.id, { onDelete: 'set null' }),
    code: varchar('code', { length: 50 }).notNull(),
    description: varchar('description', { length: 500 }).notNull().default(''),
    type: discountTypeEnum('type').notNull(),
    value: integer('value').notNull(),
    maxDiscount: integer('max_discount'),
    minAmount: integer('min_amount'),
    maxUses: integer('max_uses'),
    currentUses: integer('current_uses').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    startsAt: timestamp('starts_at'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('discount_codes_profile_id_code_idx').on(table.profileId, table.code),
    index('discount_codes_profile_id_active_idx').on(table.profileId, table.isActive),
  ],
)

export const discountCodeForms = pgTable(
  'discount_code_forms',
  {
    discountCodeId: integer('discount_code_id')
      .notNull()
      .references(() => discountCodes.id, { onDelete: 'cascade' }),
    formId: integer('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('discount_code_forms_code_form_idx').on(table.discountCodeId, table.formId),
    index('discount_code_forms_form_id_idx').on(table.formId),
  ],
)

export const discountRedemptions = pgTable(
  'discount_redemptions',
  {
    id: serial().primaryKey(),
    discountCodeId: integer('discount_code_id')
      .notNull()
      .references(() => discountCodes.id, { onDelete: 'cascade' }),
    formId: integer('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    paymentId: integer('payment_id').references(() => payments.id, { onDelete: 'set null' }),
    pageSessionId: integer('page_session_id').references(() => formSubmissionSessions.id, { onDelete: 'set null' }),
    formSubmissionId: integer('form_submission_id').notNull().references(() => formSubmissions.id, { onDelete: 'cascade' }),
    respondentEmail: varchar('respondent_email', { length: 255 }),
    currency: varchar('currency', { length: 3 }).notNull(),
    originalAmount: integer('original_amount').notNull(),
    discountAmount: integer('discount_amount').notNull(),
    finalAmount: integer('final_amount').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('discount_redemptions_payment_id_idx').on(table.paymentId),
    index('discount_redemptions_code_id_idx').on(table.discountCodeId),
    index('discount_redemptions_form_id_idx').on(table.formId),
    index('discount_redemptions_session_id_idx').on(table.pageSessionId),
  ],
)

export const subscriptionCycles = pgTable(
  'subscription_cycles',
  {
    id: serial().primaryKey(),
    paymentId: integer('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    gatewayCycleId: text('gateway_cycle_id').notNull(),
    cycleNumber: integer('cycle_number'),
    status: varchar('status', { length: 30 })
      .notNull()
      .$type<'scheduled' | 'pending' | 'retrying' | 'paid' | 'failed' | 'cancelled' | 'skipped'>(),
    amount: integer('amount').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    scheduledAt: timestamp('scheduled_at'),
    paidAt: timestamp('paid_at'),
    failedAt: timestamp('failed_at'),
    failureCode: varchar('failure_code', { length: 100 }),
    verificationSource: varchar('verification_source', { length: 20 })
      .$type<'webhook' | 'reconciliation' | 'manual'>(),
    lastVerifiedAt: timestamp('last_verified_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('subscription_cycles_gateway_cycle_id_idx').on(table.gatewayCycleId),
    index('subscription_cycles_payment_scheduled_idx').on(table.paymentId, table.scheduledAt),
  ],
)

export type EmailTemplateKind = 'invoice' | 'confirmation'
export type EmailDeliveryStatus = 'queued' | 'sending' | 'sent' | 'failed'
export type EmailTemplateSnapshot = {
  templateName?: string
  subjectTemplate: string
  bodyTemplate: string
  bodyTemplatePlain?: string | null
  fromName?: string | null
  ccRecipients?: string[]
  logoUrl?: string | null
  accentColor?: string | null
  includePaymentDetails?: boolean
  includeLineItems?: boolean
  lineItemFields?: InvoiceLineItemField[]
}

export const emailDeliveryLogs = pgTable(
  'email_delivery_logs',
  {
    id: serial().primaryKey(),
    formId: integer('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    formSubmissionId: integer('form_submission_id')
      .notNull()
      .references(() => formSubmissions.id, { onDelete: 'cascade' }),
    paymentId: integer('payment_id').references(() => payments.id, { onDelete: 'set null' }),
    templateKind: varchar('template_kind', { length: 20 }).notNull().$type<EmailTemplateKind>(),
    templateKey: varchar('template_key', { length: 80 }).notNull().default('default'),
    recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
    invoiceNumber: varchar('invoice_number', { length: 50 }),
    subject: varchar('subject', { length: 255 }).notNull(),
    templateSnapshot: jsonb('template_snapshot').$type<EmailTemplateSnapshot>().notNull(),
    status: varchar('status', { length: 20 })
      .notNull()
      .default('queued')
      .$type<EmailDeliveryStatus>(),
    provider: varchar('provider', { length: 20 }),
    messageId: varchar('message_id', { length: 255 }),
    errorMessage: text('error_message'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastAttemptAt: timestamp('last_attempt_at'),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('email_delivery_logs_submission_kind_idx').on(
      table.formSubmissionId,
      table.templateKind,
      table.templateKey,
    ),
    uniqueIndex('email_delivery_logs_form_invoice_number_idx').on(
      table.formId,
      table.invoiceNumber,
    ),
    index('email_delivery_logs_form_created_at_idx').on(table.formId, table.createdAt),
    index('email_delivery_logs_status_idx').on(table.status),
    index('email_delivery_logs_payment_id_idx').on(table.paymentId),
  ],
)

export const paymentEvents = pgTable(
  'payment_events',
  {
    id: serial().primaryKey(),
    paymentId: integer('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    eventKey: varchar('event_key', { length: 64 }).notNull(),
    gatewayEventId: text('gateway_event_id'),
    eventType: varchar('event_type', { length: 80 }).notNull(),
    providerStatus: varchar('provider_status', { length: 40 }),
    normalizedStatus: paymentStatusEnum('normalized_status'),
    source: varchar('source', { length: 20 })
      .notNull()
      .$type<'webhook' | 'return' | 'reconciliation' | 'manual'>(),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    processingStatus: varchar('processing_status', { length: 20 })
      .notNull()
      .default('processed')
      .$type<'processing' | 'processed' | 'ignored' | 'failed'>(),
    error: text('error'),
    receivedAt: timestamp('received_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
  },
  (table) => [
    uniqueIndex('payment_events_event_key_idx').on(table.eventKey),
    index('payment_events_payment_id_received_at_idx').on(table.paymentId, table.receivedAt),
  ],
)

// ── Flow Builder (FT001) ──

/**
 * FLOWS
 * Links a flow definition to a form.
 * A form can have one flow. If no flow exists, the form behaves as a
 * traditional linear form (backward compatibility per REQ-4.1).
 */
export const flows = pgTable(
  'flows',
  {
    id: serial().primaryKey(),
    formId: integer('form_id')
      .notNull()
      .unique() // One flow per form
      .references(() => forms.id, { onDelete: 'cascade' }),
    startNodeId: integer('start_node_id'), // FK to flow_nodes, set after node creation
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('flows_form_id_idx').on(table.formId)],
)

/**
 * FLOW VARIABLES
 * Typed variable declarations scoped to a flow.
 * Variables are accessible to any node in the flow at runtime.
 */
export const flowVariables = pgTable(
  'flow_variables',
  {
    id: serial().primaryKey(),
    flowId: integer('flow_id')
      .notNull()
      .references(() => flows.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(), // snake_case identifier
    type: varchar('type', { length: 20 })
      .notNull()
      .$type<'string' | 'number' | 'boolean' | 'money' | 'date' | 'time' | 'datetime'>(),
    defaultValue: text('default_value'), // Stored as string, parsed by type
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('flow_variables_flow_id_name_idx').on(table.flowId, table.name),
  ],
)

/**
 * FLOW NODES
 * Each node in the flow graph. The `config` JSONB holds type-specific configuration.
 *
 * Config shape per node type:
 *
 * FormField:
 *   { fieldType: string, label: string, placeholder?: string, required: boolean,
 *     options?: {label:string,value:string}[], bindToVariable?: string }
 *   fieldType values: text, email, number, textarea, select, checkbox, radio, date, time, datetime
 *
 * Group (several fields rendered together on one step):
 *   { title?: string, fields: { id: string, fieldType: string, label: string,
 *     placeholder?: string, required?: boolean,
 *     options?: {label:string,value:string}[], bindToVariable?: string }[] }
 *   // Single in / single out, like FormField.
 *
 * Decision:
 *   { sourceVariable: string, branches: { value: string, label: string }[] }
 *   // Edges from this node determine which branch leads where.
 *   // Each edge carries metadata: { matchValue: string }.
 *
 * Calculator:
 *   { targetVariable: string, expression: string, label?: string }
 *   // expression example: "{{subtotal}} * 0.12"
 *
 * Payment:
 *   { amountVariable: string, currency: string, gatewayId: number, label?: string }
 *   // Edges: first = success path, second (optional) = failure path
 *
 * Summary:
 *   { title: string, template: string }
 *   // template example: "Thank you {{customer_name}}! Total: {{total_cost}}"
 *
 * Redirect:
 *   { urlTemplate: string }
 *   // urlTemplate example: "https://example.com/course-access?ref={{payment_ref}}"
 */
export const flowNodes = pgTable(
  'flow_nodes',
  {
    id: serial().primaryKey(),
    flowId: integer('flow_id')
      .notNull()
      .references(() => flows.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 30 })
      .notNull()
      .$type<
        | 'start'
        | 'form_field'
        | 'group'
        | 'decision'
        | 'calculator'
        | 'payment'
        | 'summary'
        | 'redirect'
      >(),
    label: varchar('label', { length: 255 }),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    positionX: integer('position_x').notNull().default(0), // Canvas X position
    positionY: integer('position_y').notNull().default(0), // Canvas Y position
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('flow_nodes_flow_id_idx').on(table.flowId)],
)

/**
 * FLOW EDGES
 * Directed connections between nodes. Each edge belongs to a flow.
 * For Decision nodes, edges carry a `matchValue` in their metadata to
 * indicate which branch they represent.
 */
export const flowEdges = pgTable(
  'flow_edges',
  {
    id: serial().primaryKey(),
    flowId: integer('flow_id')
      .notNull()
      .references(() => flows.id, { onDelete: 'cascade' }),
    sourceNodeId: integer('source_node_id')
      .notNull()
      .references(() => flowNodes.id, { onDelete: 'cascade' }),
    targetNodeId: integer('target_node_id')
      .notNull()
      .references(() => flowNodes.id, { onDelete: 'cascade' }),
    metadata: jsonb('metadata')
      .$type<{
        matchValue?: string // For Decision node edges — which option triggers this path
        label?: string // Optional display label on the edge
      }>()
      .default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('flow_edges_flow_id_idx').on(table.flowId)],
)

/**
 * FLOW EXECUTIONS
 * Records a single run of a flow by an end user.
 * Stores the entire execution context at completion.
 */
export const flowExecutions = pgTable(
  'flow_executions',
  {
    id: serial().primaryKey(),
    flowId: integer('flow_id')
      .notNull()
      .references(() => flows.id, { onDelete: 'cascade' }),
    formSubmissionId: integer('form_submission_id').references(
      () => formSubmissions.id,
      { onDelete: 'set null' },
    ),
    clientToken: varchar('client_token', { length: 64 }),
    status: varchar('status', { length: 20 })
      .notNull()
      .default('in_progress')
      .$type<
        | 'in_progress'
        | 'completed'
        | 'payment_pending'
        | 'payment_failed'
        | 'cancelled'
      >(),
    currentNodeId: integer('current_node_id').references(() => flowNodes.id),
    variables: jsonb('variables').$type<Record<string, unknown>>().default({}),
    history: jsonb('history')
      .$type<
        {
          nodeId: number
          nodeType: string
          enteredAt: string // ISO timestamp
          data?: unknown // Snapshot of data at this step
        }[]
      >()
      .default([]),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('flow_executions_flow_id_idx').on(table.flowId),
    uniqueIndex('flow_executions_client_token_idx').on(table.clientToken),
  ],
)

// ── Integrations (FT-002) ──

/**
 * INTEGRATIONS
 * Per-profile third-party service credentials. One row per (profile, provider).
 * The `config` column holds an AES-256-GCM-encrypted JSON blob (see
 * `src/lib/crypto.ts`) — plaintext secrets are NEVER stored. A null config
 * means that provider is not configured for this user.
 */
export const integrations = pgTable(
  'integrations',
  {
    id: serial().primaryKey(),
    profileId: integer('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).notNull(),
    config: text('config'), // encrypted JSON; null = not configured
    webhookEndpointKey: varchar('webhook_endpoint_key', { length: 64 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('integrations_profile_provider_idx').on(table.profileId, table.provider),
    uniqueIndex('integrations_webhook_endpoint_key_idx').on(table.webhookEndpointKey),
  ],
)

// ── Payment Links (FT-018) ──

export const paymentLinks = pgTable(
  'payment_links',
  {
    id: serial().primaryKey(),
    profileId: integer('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    publicId: varchar('public_id', { length: 16 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    amount: integer('amount').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('PHP'),
    paymentGatewayId: integer('payment_gateway_id')
      .notNull()
      .references(() => paymentGateways.id),
    allowCustomAmount: boolean('allow_custom_amount').notNull().default(false),
    minAmount: integer('min_amount'),
    maxAmount: integer('max_amount'),
    redirectUrl: text('redirect_url'),
    successMessage: text('success_message'),
    isActive: boolean('is_active').notNull().default(true),
    totalPayments: integer('total_payments').notNull().default(0),
    totalRevenue: integer('total_revenue').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('payment_links_public_id_idx').on(table.publicId),
    index('payment_links_profile_id_idx').on(table.profileId),
  ],
)

// ── Popups (FT-026) ──

export const popups = pgTable(
  'popups',
  {
    id: serial().primaryKey(),
    profileId: integer('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    status: formStatusEnum('status').default('draft').notNull(),
    publicId: varchar('public_id', { length: 32 }).notNull(),
    /** Design canvas size in px — the box the creator lays out in. */
    width: integer('width').notNull().default(420),
    height: integer('height').notNull().default(380),
    /** Where the popup sits on the host page. */
    placement: varchar('placement', { length: 20 })
      .notNull()
      .default('center')
      .$type<
        | 'center'
        | 'top-left'
        | 'top-right'
        | 'bottom-left'
        | 'bottom-right'
        | 'fullscreen'
      >(),
    /** When it appears (discriminated union — see PopupTriggerConfig). */
    trigger: jsonb('trigger')
      .$type<import('../lib/popup-builder/types').PopupTriggerConfig>()
      .notNull()
      .default({ type: 'on-load', delayMs: 0 }),
    /** How often it may appear to the same visitor. */
    frequency: varchar('frequency', { length: 20 })
      .notNull()
      .default('once-per-session')
      .$type<import('../lib/popup-builder/types').PopupFrequency>(),
    /** Optional campaign date bounds and visitor-local daily display window. */
    schedule: jsonb('schedule')
      .$type<import('../lib/popup-builder/types').PopupSchedule>()
      .notNull()
      .default({}),
    /** Popup-level look & feel (overlay, animation, fonts, closable). */
    style: jsonb('style')
      .$type<import('../lib/popup-builder/types').PopupStyle>()
      .notNull()
      .default({}),
    /** The canvas content — absolutely positioned elements. */
    elements: jsonb('elements')
      .$type<import('../lib/popup-builder/types').PopupElement[]>()
      .notNull()
      .default([]),
    /** Lead stats (v1 counters; a time-series table is a later enhancement). */
    viewCount: integer('view_count').notNull().default(0),
    clickCount: integer('click_count').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('popups_profile_id_idx').on(table.profileId),
    uniqueIndex('popups_public_id_idx').on(table.publicId),
  ],
)
