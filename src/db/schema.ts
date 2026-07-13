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
])
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

export const profiles = pgTable(
  'profiles',
  {
    id: serial().primaryKey(),
    clerkId: text('clerk_id').notNull().unique(),
    displayName: varchar('display_name', { length: 255 }),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('profiles_clerk_id_idx').on(table.clerkId)],
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
    options: jsonb('options').$type<{ label: string; value: string; price?: number | null }[]>(),
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
    }>(),
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
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('form_page_fields_page_id_position_idx').on(table.pageId, table.position)],
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
    status: submissionStatusEnum('status').default('completed').notNull(),
    formData: jsonb('form_data').$type<Record<string, unknown>>().notNull(),
    submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  },
  (table) => [index('form_submissions_form_id_idx').on(table.formId)],
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
    status: paymentStatusEnum('status').default('pending').notNull(),
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
    reminderCount: integer('reminder_count').notNull().default(0),
    lastReminderAt: timestamp('last_reminder_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('payments_gateway_payment_id_idx').on(table.gatewayPaymentId),
    uniqueIndex('payments_external_id_idx').on(table.externalId),
    index('payments_page_session_id_idx').on(table.pageSessionId),
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
      .$type<'processed' | 'ignored' | 'failed'>(),
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
  (table) => [index('flow_executions_flow_id_idx').on(table.flowId)],
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
