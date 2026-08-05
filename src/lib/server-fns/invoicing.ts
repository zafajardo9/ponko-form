import { createServerFn } from '@tanstack/react-start'
import { currentAuth as auth } from '../auth.server'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index'
import {
  emailDeliveryLogs,
  flowNodes,
  flows,
  flowVariables,
  formConfirmationConfigs,
  formFields,
  formInvoiceConfigs,
  formPageFields,
  formPages,
  formReferences,
  payments,
  type EmailTemplateKind,
  type EmailTemplateSnapshot,
  type ResponseEmailTemplate,
} from '../../db/schema'
import { assertFormEditor as assertFormOwner } from './flow-helpers'
import { getTransactionalEmailAvailability, sendTransactionalEmail } from '../email/transactional'
import { attemptEmailDelivery } from '../invoicing/delivery'
import {
  SYSTEM_VARIABLES,
  renderTemplateMessage,
  sampleContext,
  sanitizeTemplateHtml,
  validateTemplateTokens,
} from '../invoicing/template'
import type {
  ConfirmationConfigDraft,
  InvoiceConfigDraft,
  TemplateVariable,
} from '../invoicing/types'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const bindingPattern = /^[a-z0-9][a-z0-9_]*$/
const ccRecipientsSchema = z
  .array(z.string().trim().toLowerCase().email().max(255))
  .max(20)
  .refine(
    (recipients) => new Set(recipients).size === recipients.length,
    'Remove duplicate CC recipients',
  )

const lineItemSchema = z.object({
  label: z.string().trim().min(1).max(100),
  variable: z.string().regex(bindingPattern),
}).strict()

const invoiceSchema = z.object({
  enabled: z.boolean(),
  respondentEmailField: z.string().max(100),
  subjectTemplate: z.string().trim().min(1).max(255).refine((value) => !/[\r\n]/.test(value)),
  bodyTemplate: z.string().min(1).max(50_000),
  fromName: z.string().trim().max(255).refine((value) => !/[\r\n]/.test(value)),
  logoUrl: z.string().max(2048).refine((value) => !value || /^https:\/\/[^\s]+$/i.test(value), 'Use an HTTPS logo URL'),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  invoicePrefix: z.string().max(20).refine((value) => !/[\r\n{}]/.test(value)),
  invoiceStartNumber: z.number().int().min(1).max(999_999_999),
  includePaymentDetails: z.boolean(),
  includeLineItems: z.boolean(),
  lineItemFields: z.array(lineItemSchema).max(20),
}).strict()

const confirmationSchema = z.object({
  enabled: z.boolean(),
  respondentEmailField: z.string().max(100),
  subjectTemplate: z.string().trim().min(1).max(255).refine((value) => !/[\r\n]/.test(value)),
  bodyTemplate: z.string().min(1).max(50_000),
  fromName: z.string().trim().max(255).refine((value) => !/[\r\n]/.test(value)),
  ccRecipients: ccRecipientsSchema,
  templates: z.array(z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/i),
    name: z.string().trim().min(1).max(100),
    enabled: z.boolean(),
    recipientMode: z.enum(['field', 'fixed']),
    respondentEmailField: z.string().max(100),
    recipientEmail: z.string().trim().toLowerCase().max(255),
    subjectTemplate: z.string().trim().min(1).max(255).refine((value) => !/[\r\n]/.test(value)),
    bodyTemplate: z.string().min(1).max(50_000),
    fromName: z.string().trim().max(255).refine((value) => !/[\r\n]/.test(value)),
    ccRecipients: ccRecipientsSchema,
  }).strict()).max(20).refine(
    (templates) => new Set(templates.map((template) => template.id)).size === templates.length,
    'Email rule identifiers must be unique',
  ),
}).strict()

const saveSchema = z.object({
  formId: z.number().int().positive(),
  invoice: invoiceSchema,
  confirmation: confirmationSchema,
}).strict()

function displayLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

async function templateVariables(formId: number): Promise<TemplateVariable[]> {
  const variables = new Map<string, TemplateVariable>()
  const add = (variable: TemplateVariable) => {
    if (!variables.has(variable.key)) variables.set(variable.key, variable)
  }
  const pages = await db.select({ id: formPages.id }).from(formPages).where(eq(formPages.formId, formId))
  if (pages.length) {
    const fields = await db
      .select({
        binding: formPageFields.bindVariable,
        label: formPageFields.label,
        fieldType: formPageFields.fieldType,
      })
      .from(formPageFields)
      .where(inArray(formPageFields.pageId, pages.map((page) => page.id)))
      .orderBy(asc(formPageFields.position))
    for (const field of fields) add({
      key: field.binding,
      label: field.label,
      category: 'respondent',
      emailCandidate: field.fieldType === 'email',
      sampleValue: field.fieldType === 'email' ? 'jane@example.com' : `Sample ${field.label}`,
    })
  }

  const references = await db
    .select()
    .from(formReferences)
    .where(eq(formReferences.formId, formId))
    .orderBy(asc(formReferences.position))
  for (const reference of references) add({
    key: reference.key,
    label: displayLabel(reference.key),
    category: 'form',
    sampleValue: reference.type === 'number' ? '42' : 'Sample value',
  })

  const [flow] = await db.select({ id: flows.id }).from(flows).where(eq(flows.formId, formId)).limit(1)
  if (flow) {
    const [declared, nodes] = await Promise.all([
      db.select().from(flowVariables).where(eq(flowVariables.flowId, flow.id)).orderBy(asc(flowVariables.id)),
      db.select().from(flowNodes).where(eq(flowNodes.flowId, flow.id)).orderBy(asc(flowNodes.id)),
    ])
    const emailBindings = new Set<string>()
    const labels = new Map<string, string>()
    for (const node of nodes) {
      const config = node.config as Record<string, unknown>
      if (node.type === 'form_field') {
        const binding = typeof config.bindToVariable === 'string' ? config.bindToVariable : ''
        if (binding) labels.set(binding, typeof config.label === 'string' ? config.label : displayLabel(binding))
        if (binding && config.fieldType === 'email') emailBindings.add(binding)
      }
      if (node.type === 'group' && Array.isArray(config.fields)) {
        for (const item of config.fields as Record<string, unknown>[]) {
          const binding = typeof item.bindToVariable === 'string' ? item.bindToVariable : ''
          if (binding) labels.set(binding, typeof item.label === 'string' ? item.label : displayLabel(binding))
          if (binding && item.fieldType === 'email') emailBindings.add(binding)
        }
      }
    }
    for (const variable of declared) add({
      key: variable.name,
      label: labels.get(variable.name) ?? displayLabel(variable.name),
      category: 'respondent',
      emailCandidate: emailBindings.has(variable.name),
      sampleValue: emailBindings.has(variable.name) ? 'jane@example.com' : variable.defaultValue || 'Sample value',
    })
  }

  const legacyFields = await db
    .select()
    .from(formFields)
    .where(eq(formFields.formId, formId))
    .orderBy(asc(formFields.order))
  for (const field of legacyFields) add({
    key: String(field.id),
    label: field.label,
    category: 'respondent',
    emailCandidate: field.type === 'email',
    sampleValue: field.type === 'email' ? 'jane@example.com' : `Sample ${field.label}`,
  })
  return [...variables.values()]
}

async function hasPaymentPath(formId: number) {
  const [pagePayment, flow] = await Promise.all([
    db.select({ id: formPages.id }).from(formPages)
      .where(and(eq(formPages.formId, formId), eq(formPages.hasPayment, true))).limit(1),
    db.select({ id: flows.id }).from(flows).where(eq(flows.formId, formId)).limit(1),
  ])
  if (pagePayment.length) return true
  if (!flow[0]) return false
  const [paymentNode] = await db.select({ id: flowNodes.id }).from(flowNodes)
    .where(and(eq(flowNodes.flowId, flow[0].id), eq(flowNodes.type, 'payment'))).limit(1)
  return Boolean(paymentNode)
}

function invoiceDraft(config: typeof formInvoiceConfigs.$inferSelect | undefined): InvoiceConfigDraft {
  return {
    enabled: config?.enabled ?? false,
    respondentEmailField: config?.respondentEmailField ?? '',
    subjectTemplate: config?.subjectTemplate ?? 'Invoice {{invoice_number}} for {{form_title}}',
    bodyTemplate: config?.bodyTemplate ?? '<h1>Invoice {{invoice_number}}</h1><p>Thank you for your payment.</p>',
    fromName: config?.fromName ?? '',
    logoUrl: config?.logoUrl ?? '',
    accentColor: config?.accentColor ?? '#cc785c',
    invoicePrefix: config?.invoicePrefix ?? 'INV-',
    invoiceStartNumber: config?.invoiceStartNumber ?? 1000,
    includePaymentDetails: config?.includePaymentDetails ?? true,
    includeLineItems: config?.includeLineItems ?? false,
    lineItemFields: config?.lineItemFields ?? [],
  }
}

function confirmationDraft(config: typeof formConfirmationConfigs.$inferSelect | undefined): ConfirmationConfigDraft {
  const legacyTemplate: ResponseEmailTemplate = {
    id: 'default',
    name: 'Response confirmation',
    enabled: config?.enabled ?? false,
    recipientMode: 'field',
    respondentEmailField: config?.respondentEmailField ?? '',
    recipientEmail: '',
    subjectTemplate: config?.subjectTemplate ?? 'Thanks for submitting {{form_title}}',
    bodyTemplate: config?.bodyTemplate ?? '<h1>Thank you</h1><p>Your response has been recorded.</p>',
    fromName: config?.fromName ?? '',
    ccRecipients: config?.ccRecipients ?? [],
  }
  const templates = config?.templates?.length ? config.templates : [legacyTemplate]
  return {
    enabled: templates.some((template) => template.enabled),
    respondentEmailField: templates[0]?.respondentEmailField ?? '',
    subjectTemplate: templates[0]?.subjectTemplate ?? legacyTemplate.subjectTemplate,
    bodyTemplate: templates[0]?.bodyTemplate ?? legacyTemplate.bodyTemplate,
    fromName: templates[0]?.fromName ?? '',
    ccRecipients: templates[0]?.ccRecipients ?? [],
    templates,
  }
}

async function ownedForm(formId: number) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  return assertFormOwner(formId, userId)
}

export const getInvoicingView = createServerFn({ method: 'GET', strict: false })
  .validator((data: { formId: number }) => z.object({ formId: z.number().int().positive() }).parse(data))
  .handler(async ({ data }) => {
    const form = await ownedForm(data.formId)
    const [invoiceRows, confirmationRows, variables, paymentPath, availability, deliveries] = await Promise.all([
      db.select().from(formInvoiceConfigs).where(eq(formInvoiceConfigs.formId, data.formId)).limit(1),
      db.select().from(formConfirmationConfigs).where(eq(formConfirmationConfigs.formId, data.formId)).limit(1),
      templateVariables(data.formId),
      hasPaymentPath(data.formId),
      getTransactionalEmailAvailability(form.profileId),
      db.select({
        id: emailDeliveryLogs.id,
        templateKind: emailDeliveryLogs.templateKind,
        templateName: emailDeliveryLogs.templateSnapshot,
        recipientEmail: emailDeliveryLogs.recipientEmail,
        invoiceNumber: emailDeliveryLogs.invoiceNumber,
        subject: emailDeliveryLogs.subject,
        status: emailDeliveryLogs.status,
        provider: emailDeliveryLogs.provider,
        attemptCount: emailDeliveryLogs.attemptCount,
        errorMessage: emailDeliveryLogs.errorMessage,
        sentAt: emailDeliveryLogs.sentAt,
        createdAt: emailDeliveryLogs.createdAt,
        amount: payments.paidAmount,
        fallbackAmount: payments.amount,
        currency: payments.currency,
      }).from(emailDeliveryLogs)
        .leftJoin(payments, eq(emailDeliveryLogs.paymentId, payments.id))
        .where(eq(emailDeliveryLogs.formId, data.formId))
        .orderBy(desc(emailDeliveryLogs.createdAt))
        .limit(25),
    ])
    return {
      form: { id: form.id, title: form.title, status: form.status },
      invoice: invoiceDraft(invoiceRows[0]),
      confirmation: confirmationDraft(confirmationRows[0]),
      invoiceNumberingLocked: Boolean(invoiceRows[0] && invoiceRows[0].nextInvoiceNumber !== invoiceRows[0].invoiceStartNumber),
      variables: [...variables, ...SYSTEM_VARIABLES],
      hasPaymentPath: paymentPath,
      emailAvailability: availability,
      deliveries: deliveries.map(({ fallbackAmount, templateName, ...delivery }) => ({
        ...delivery,
        templateName: templateName.templateName ?? null,
        amount: delivery.amount ?? fallbackAmount,
      })),
    }
  })

export const saveInvoicingConfig = createServerFn({ method: 'POST', strict: false })
  .validator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data }) => {
    const form = await ownedForm(data.formId)
    const variables = await templateVariables(data.formId)
    const emailCandidates = new Set(variables.filter((variable) => variable.emailCandidate).map((variable) => variable.key))
    const availability = await getTransactionalEmailAvailability(form.profileId)
    const hasEmail = availability.resend || availability.smtp
    const paymentPath = await hasPaymentPath(data.formId)
    const unknownTokens = validateTemplateTokens([
      data.invoice.subjectTemplate,
      data.invoice.bodyTemplate,
      ...data.confirmation.templates.flatMap((template) => [
        template.subjectTemplate,
        template.bodyTemplate,
      ]),
    ], variables)
    if (unknownTokens.length) throw new Error(`Unknown template variables: ${unknownTokens.join(', ')}`)
    if (data.invoice.enabled) {
      if (!paymentPath) throw new Error('Add a payment step before enabling invoices')
      if (!hasEmail) throw new Error('Configure Resend or SMTP before enabling invoices')
      if (!emailCandidates.has(data.invoice.respondentEmailField)) throw new Error('Choose a valid respondent email field')
    }
    for (const template of data.confirmation.templates.filter((item) => item.enabled)) {
      if (!hasEmail) throw new Error('Configure Resend or SMTP before enabling response emails')
      if (template.recipientMode === 'field' && !emailCandidates.has(template.respondentEmailField)) {
        throw new Error(`Choose a valid recipient field for “${template.name}”`)
      }
      if (template.recipientMode === 'fixed' && !emailPattern.test(template.recipientEmail)) {
        throw new Error(`Enter a valid recipient address for “${template.name}”`)
      }
    }
    const [existingInvoice] = await db.select().from(formInvoiceConfigs)
      .where(eq(formInvoiceConfigs.formId, data.formId)).limit(1)
    if (existingInvoice && existingInvoice.nextInvoiceNumber !== existingInvoice.invoiceStartNumber &&
      existingInvoice.invoiceStartNumber !== data.invoice.invoiceStartNumber) {
      throw new Error('The invoice start number cannot change after an invoice is reserved')
    }

    const sanitizedInvoiceBody = sanitizeTemplateHtml(data.invoice.bodyTemplate)
    const sanitizedTemplates = data.confirmation.templates.map((template) => ({
      ...template,
      bodyTemplate: sanitizeTemplateHtml(template.bodyTemplate),
    }))
    const primaryTemplate = sanitizedTemplates[0] ?? {
      respondentEmailField: '',
      subjectTemplate: 'Thanks for submitting {{form_title}}',
      bodyTemplate: '<h1>Thank you</h1><p>Your response has been recorded.</p>',
      fromName: '',
      ccRecipients: [],
    }
    const invoiceValues = {
      enabled: data.invoice.enabled,
      respondentEmailField: data.invoice.respondentEmailField || null,
      subjectTemplate: data.invoice.subjectTemplate,
      bodyTemplate: sanitizedInvoiceBody,
      fromName: data.invoice.fromName || null,
      logoUrl: data.invoice.logoUrl || null,
      accentColor: data.invoice.accentColor,
      invoicePrefix: data.invoice.invoicePrefix,
      invoiceStartNumber: data.invoice.invoiceStartNumber,
      includePaymentDetails: data.invoice.includePaymentDetails,
      includeLineItems: data.invoice.includeLineItems,
      lineItemFields: data.invoice.includeLineItems ? data.invoice.lineItemFields : [],
      updatedAt: new Date(),
    }
    await db.insert(formInvoiceConfigs)
      .values({ formId: data.formId, nextInvoiceNumber: data.invoice.invoiceStartNumber, ...invoiceValues })
      .onConflictDoUpdate({ target: formInvoiceConfigs.formId, set: invoiceValues })
    const confirmationValues = {
      enabled: sanitizedTemplates.some((template) => template.enabled),
      respondentEmailField: primaryTemplate.respondentEmailField || null,
      subjectTemplate: primaryTemplate.subjectTemplate,
      bodyTemplate: primaryTemplate.bodyTemplate,
      fromName: primaryTemplate.fromName || null,
      ccRecipients: primaryTemplate.ccRecipients,
      templates: sanitizedTemplates,
      updatedAt: new Date(),
    }
    await db.insert(formConfirmationConfigs)
      .values({ formId: data.formId, ...confirmationValues })
      .onConflictDoUpdate({ target: formConfirmationConfigs.formId, set: confirmationValues })
    return {
      invoice: invoiceDraft({ ...existingInvoice, ...invoiceValues } as typeof formInvoiceConfigs.$inferSelect),
      confirmation: confirmationDraft({
        ...confirmationValues,
        formId: data.formId,
      } as typeof formConfirmationConfigs.$inferSelect),
    }
  })

export const sendTestTemplate = createServerFn({ method: 'POST', strict: false })
  .validator((data: unknown) => z.object({
    formId: z.number().int().positive(),
    kind: z.enum(['invoice', 'confirmation']),
    recipientEmail: z.string().email().max(255),
    templateId: z.string().max(80).optional(),
  }).strict().parse(data))
  .handler(async ({ data }) => {
    const form = await ownedForm(data.formId)
    const variables = await templateVariables(data.formId)
    const now = new Date()
    let snapshot: EmailTemplateSnapshot
    if (data.kind === 'invoice') {
      const [config] = await db.select().from(formInvoiceConfigs).where(eq(formInvoiceConfigs.formId, data.formId)).limit(1)
      if (!config) throw new Error('Save the invoice template before sending a test')
      if (config.lastTestSentAt && now.getTime() - config.lastTestSentAt.getTime() < 10_000) throw new Error('Wait a few seconds before sending another test')
      snapshot = { ...config, lineItemFields: config.lineItemFields }
      await db.update(formInvoiceConfigs).set({ lastTestSentAt: now }).where(eq(formInvoiceConfigs.id, config.id))
    } else {
      const [config] = await db.select().from(formConfirmationConfigs).where(eq(formConfirmationConfigs.formId, data.formId)).limit(1)
      if (!config) throw new Error('Save the confirmation template before sending a test')
      if (config.lastTestSentAt && now.getTime() - config.lastTestSentAt.getTime() < 10_000) throw new Error('Wait a few seconds before sending another test')
      const selectedTemplate = config.templates?.find((template) => template.id === data.templateId)
        ?? config.templates?.[0]
      snapshot = selectedTemplate
        ? {
            templateName: selectedTemplate.name,
            subjectTemplate: selectedTemplate.subjectTemplate,
            bodyTemplate: selectedTemplate.bodyTemplate,
            fromName: selectedTemplate.fromName,
          }
        : config
      await db.update(formConfirmationConfigs).set({ lastTestSentAt: now }).where(eq(formConfirmationConfigs.id, config.id))
    }
    if (!emailPattern.test(data.recipientEmail)) throw new Error('Enter a valid test email address')
    const message = renderTemplateMessage(data.kind, snapshot, sampleContext(variables))
    const result = await sendTransactionalEmail(form.profileId, { recipient: data.recipientEmail, fromName: snapshot.fromName, ...message })
    return { success: true, provider: result.provider }
  })

export const retryEmailDelivery = createServerFn({ method: 'POST', strict: false })
  .validator((data: unknown) => z.object({ formId: z.number().int().positive(), deliveryId: z.number().int().positive() }).strict().parse(data))
  .handler(async ({ data }) => {
    await ownedForm(data.formId)
    const [delivery] = await db.select().from(emailDeliveryLogs).where(and(
      eq(emailDeliveryLogs.id, data.deliveryId),
      eq(emailDeliveryLogs.formId, data.formId),
    )).limit(1)
    if (!delivery) throw new Error('Delivery not found')
    if (delivery.status !== 'failed') throw new Error('Only failed deliveries can be retried')
    if (delivery.attemptCount >= 5) throw new Error('Maximum retry attempts reached')
    if (delivery.lastAttemptAt && Date.now() - delivery.lastAttemptAt.getTime() < 10_000) throw new Error('Wait a few seconds before retrying')
    const result = await attemptEmailDelivery(delivery.id)
    if (!result) throw new Error('Delivery is already being retried')
    return result
  })

export type InvoicingTemplateKind = EmailTemplateKind
